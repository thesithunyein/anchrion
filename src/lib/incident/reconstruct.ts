/**
 * Post-drain reconstruction.
 *
 * Every mainstream tool in this category is preventive: simulate before you sign.
 * Nothing answers the question you actually have at 2am — *how did this happen,
 * and can they still reach me?* — so this module reconstructs the incident from
 * on-chain facts:
 *
 *   1. Find token transfers OUT of the wallet that were sent by somebody else.
 *      If funds left in a transaction the owner did not sign, a permission was
 *      used, not a wallet key.
 *   2. Resolve the sender of each such transaction — that is the address that
 *      exercised the permission.
 *   3. Match it against the wallet's live approvals to show the authorisation.
 *   4. Group every remaining approval that shares a deployer with the attacker,
 *      so related contracts are not left live.
 *
 * Honest limits are returned as narrative lines, not hidden. This is a
 * reconstruction from what public data could return, and it says so.
 */

import { formatUnits } from '@/lib/abi/erc20';
import { getTransactionByHash, rpcUrlsFor } from '@/lib/chain/rpc';
import { scanApprovals } from '@/lib/approvals/scan';
import { explorerTxUrl, fetchTokenTransfers } from '@/lib/explorer/blockscout';
import { getUsdPrices, priceFor } from '@/lib/prices';
import type { Incident, IncidentTransfer, TokenMeta } from '@/types/approval';

const MAX_TRANSFERS_INSPECTED = 6;

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function usd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  return `$${Math.round(value).toLocaleString()}`;
}

export async function reconstructIncident(
  chainId: number,
  walletAddress: string,
  preferTxHash?: string,
): Promise<Incident> {
  const wallet = walletAddress.toLowerCase();
  const urls = rpcUrlsFor(chainId);

  const [scan, allTransfers, prices] = await Promise.all([
    scanApprovals(chainId, walletAddress),
    fetchTokenTransfers(chainId, wallet, 2),
    getUsdPrices(),
  ]);

  // Every recent outflow, whether or not this wallet sent it. Both kinds are
  // counted; only one kind is evidence of a permission being spent by someone else.
  const outflows = allTransfers
    .filter((transfer) => transfer.from === wallet && /^0x[0-9a-f]{40}$/.test(transfer.contractAddress))
    .slice(0, MAX_TRANSFERS_INSPECTED);

  const transfers: IncidentTransfer[] = [];
  const attackers = new Set<string>();
  let selfSignedOutflowCount = 0;

  for (const outflow of outflows) {
    const tx = await getTransactionByHash(urls, outflow.hash);
    if (!tx) continue;

    /*
     * A transfer the wallet sent itself is not evidence of a stolen key, but it is
     * also not proof of safety, and the earlier version of this module treated it
     * as neither — it skipped the row and then reported "no transfers sent by
     * another address", which reads as good news. A drainer that asks you to sign
     * a transaction moving your own tokens produces exactly this shape, so those
     * outflows are counted and surfaced instead of dropped.
     */
    if (tx.from === wallet) {
      selfSignedOutflowCount += 1;
      continue;
    }

    const decimals = outflow.tokenDecimal ?? 18;
    const amountFormatted = formatUnits(BigInt(outflow.value || '0'), decimals);
    const price = priceFor(prices.prices, outflow.tokenSymbol ?? '');
    const movedUsd = price === null ? 0 : Math.round(Number(amountFormatted) * price);

    const token: TokenMeta = {
      address: outflow.contractAddress,
      name: outflow.tokenName ?? outflow.tokenSymbol ?? 'Unknown token',
      symbol: outflow.tokenSymbol ?? 'TOKEN',
      decimals,
    };

    attackers.add(tx.from);
    transfers.push({
      txHash: outflow.hash,
      token,
      amountFormatted,
      valueAtRiskUsd: movedUsd,
      initiatedBy: tx.from,
      /*
       * Whether this is *proved* to be a spent permission. The submitting address
       * holding a live allowance is the proof; anything else gets named as one of
       * the two benign explanations rather than reported as a drain.
       */
      authorizedByLivePermission: scan.approvals.some(
        (approval) => approval.spenderAddress === tx.from,
      ),
      recipient: outflow.to,
      blockNumber: outflow.blockNumber,
      timestamp:
        outflow.timeStamp === null ? null : new Date(outflow.timeStamp * 1000).toISOString(),
      explorerUrl: explorerTxUrl(chainId, outflow.hash),
    });
  }

  // Prefer the transfer the user pointed at, if they pointed at one.
  if (preferTxHash) {
    transfers.sort((a, b) => {
      if (a.txHash.toLowerCase() === preferTxHash.toLowerCase()) return -1;
      if (b.txHash.toLowerCase() === preferTxHash.toLowerCase()) return 1;
      return (b.blockNumber ?? 0) - (a.blockNumber ?? 0);
    });
  }

  const attackerList = Array.from(attackers);
  const authorizingApprovals = scan.approvals.filter((approval) =>
    attackerList.includes(approval.spenderAddress),
  );

  // Family: same deployer (preferred) or the attacker address itself.
  const familyCreators = new Set(
    authorizingApprovals
      .map((approval) => approval.signals.creatorAddress)
      .filter((creator): creator is string => Boolean(creator)),
  );
  const familyApprovals = scan.approvals.filter((approval) => {
    if (authorizingApprovals.includes(approval)) return true;
    const creator = approval.signals.creatorAddress;
    return creator !== null && familyCreators.has(creator);
  });

  /*
   * Exposure is reported in two parts because they are two different facts. A
   * capped permission has a dollar figure. An unlimited one has no cap, so the
   * figure quoted for it would describe today's balance, not what the permission
   * allows — that is stated separately instead of folded into the capped total.
   */
  const cappedExposure = familyApprovals.filter((approval) => !approval.isUnlimited);
  const unboundedApprovalCount = familyApprovals.length - cappedExposure.length;
  const pricedCappedExposure = cappedExposure.filter(
    (approval) => approval.valueAtRiskUsd !== null,
  );
  const unpricedCappedCount = cappedExposure.length - pricedCappedExposure.length;
  const stillExposedUsd = pricedCappedExposure.reduce(
    (sum, approval) => sum + (approval.valueAtRiskUsd ?? 0),
    0,
  );

  const narrative: string[] = [];

  if (transfers.length === 0) {
    narrative.push(
      'No token transfer left this wallet inside a transaction submitted by another address, in the history Anchrion could read. That rules out one permission being spent by somebody else. It does not rule out a permit signature, which stays off chain until the moment it is redeemed, and it does not rule out a transfer this wallet signed itself, which is the next line.',
    );
  } else {
    narrative.push(
      `Found ${transfers.length} token transfer${
        transfers.length === 1 ? '' : 's'
      } out of this wallet inside transactions this wallet did not submit. That shape appears when somebody else spends a permission you granted, and it also appears when a relayer submits a transaction you signed yourself. The next lines separate the two cases rather than assuming the worse one.`,
    );
    const first = transfers[0];
    narrative.push(
      `Most recent: ${first.amountFormatted} ${first.token.symbol} (≈ ${usd(
        first.valueAtRiskUsd,
      )}) moved out to ${shorten(first.recipient)}, initiated by ${shorten(first.initiatedBy)}.`,
    );
  }

  if (selfSignedOutflowCount > 0) {
    narrative.push(
      `${selfSignedOutflowCount} token transfer(s) left this wallet inside transactions this wallet signed. A swap, a bridge, and a drain run by a contract you approved all look the same in that shape, so Anchrion does not label them either way. Open each one and check where it went.`,
    );
  }

  /*
   * Separating proved spends from unexplained ones is the difference between a
   * security report and an accusation. A transfer can leave a wallet with no live
   * permission to explain it for two ordinary reasons: a permit signature, which
   * only becomes on-chain state at the moment it is redeemed, and a transaction
   * the wallet signed that a relayer submitted (MEV protection and account
   * abstraction both do this). Neither is theft, so neither is labelled as theft.
   */
  const provedSpends = transfers.filter((transfer) => transfer.authorizedByLivePermission);
  const unexplained = transfers.length - provedSpends.length;

  if (provedSpends.length > 0) {
    narrative.push(
      `${provedSpends.length} of these transfer(s) were submitted by an address that still holds a live permission on this wallet, which is what proves a permission was spent rather than a key.`,
    );
  }

  if (unexplained > 0) {
    narrative.push(
      `${unexplained} transfer(s) were submitted by an address with no live permission on this wallet (${Array.from(
        new Set(
          transfers
            .filter((transfer) => !transfer.authorizedByLivePermission)
            .map((transfer) => shorten(transfer.initiatedBy)),
        ),
      ).join(', ')}). That has two ordinary explanations Anchrion cannot separate from the public record: a permit signature, which stays off chain until it is redeemed, or a transaction this wallet signed that a third-party relayer submitted — MEV protection and account abstraction both work that way. Open the transaction before treating it as a drain.`,
    );
  }

  for (const approval of authorizingApprovals) {
    narrative.push(
      `${shorten(approval.spenderAddress)} still holds a ${
        approval.isUnlimited
          ? 'unlimited'
          : `${approval.allowanceFormatted} ${approval.token.symbol}`
      } permission on this wallet (risk ${approval.riskScore}/100). Revoke this first.`,
    );
  }

  if (familyCreators.size > 0) {
    narrative.push(
      `${familyApprovals.length} of your remaining approvals share a deployer with the attacker (${Array.from(
        familyCreators,
      )
        .map(shorten)
        .join(', ')}), so they are likely part of the same contract family and should be revoked together.`,
    );
  }

  if (familyApprovals.length > 0) {
    narrative.push(
      `Value still reachable through the capped permissions listed above: ${usd(stillExposedUsd)}.${
        unpricedCappedCount > 0
          ? ` ${unpricedCappedCount} further capped permission(s) have no figure here because this wallet's balance of that token could not be read.`
          : ''
      }${
        unboundedApprovalCount > 0
          ? ` A further ${unboundedApprovalCount} permission(s) are unlimited, so there is no cap to price: assume everything of that token until they are revoked.`
          : ''
      }`,
    );
  }

  /*
   * What this reconstruction could and could not look at, held to the same
   * standard as the scan's coverage panel. A short window is a fact about the
   * tool, not about the wallet, and printing it is the difference between an
   * answer and a guess.
   */
  narrative.push(
    `This examined the ${outflows.length} most recent token outflow(s) from this wallet, drawn from the two most recent pages of its transfer history, alongside ${scan.coverage.pairsChecked} permission(s) read live on chain. A transfer older than that window was not examined.`,
  );

  narrative.push(
    'Reconstructed from the wallet’s recent token transfers, transaction history, and live allowance reads. Nothing about your keys is inferred: every line above is a public transaction you can open and verify.',
  );

  return {
    walletAddress: wallet,
    chainId,
    transfers,
    attackers: attackerList,
    authorizingApprovals,
    familyApprovals,
    stillExposedUsd,
    unboundedApprovalCount,
    selfSignedOutflowCount,
    outflowsInspected: outflows.length,
    narrative,
    coverage: scan.coverage,
  };
}
