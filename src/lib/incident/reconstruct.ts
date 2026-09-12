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

  // Outflows: tokens that left this wallet. We then keep only the ones whose
  // transaction was NOT sent by the wallet itself.
  const outflows = allTransfers
    .filter((transfer) => transfer.from === wallet && /^0x[0-9a-f]{40}$/.test(transfer.contractAddress))
    .slice(0, MAX_TRANSFERS_INSPECTED);

  const transfers: IncidentTransfer[] = [];
  const attackers = new Set<string>();

  for (const outflow of outflows) {
    const tx = await getTransactionByHash(urls, outflow.hash);
    if (!tx) continue;

    // A transaction the owner did not send that moved their tokens: a permission was used.
    if (tx.from === wallet) continue;

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
  const attackerApprovals = scan.approvals.filter((approval) =>
    authorizingApprovals.some((match) => match.spenderAddress === approval.spenderAddress),
  );

  // Family: same deployer (preferred) or same attacker address.
  const familyCreators = new Set(
    authorizingApprovals
      .map((approval) => approval.signals.creatorAddress)
      .filter((creator): creator is string => Boolean(creator)),
  );
  const familyApprovals = scan.approvals.filter((approval) => {
    if (attackerApprovals.includes(approval)) return true;
    const creator = approval.signals.creatorAddress;
    return creator !== null && familyCreators.has(creator);
  });

  const stillExposedUsd = familyApprovals.reduce(
    (sum, approval) => sum + approval.valueAtRiskUsd,
    0,
  );

  const narrative: string[] = [];

  if (transfers.length === 0) {
    narrative.push(
      'No token transfer out of this wallet was sent by another address in the history Anchrion could read. That is good news, and it is not proof of safety — see the coverage note below.',
    );
  } else {
    narrative.push(
      `Found ${transfers.length} token transfer${
        transfers.length === 1 ? '' : 's'
      } out of this wallet inside transactions this wallet did not send. Funds only leave that way when a permission is used.`,
    );
    const first = transfers[0];
    narrative.push(
      `Most recent: ${first.amountFormatted} ${first.token.symbol} (≈ ${usd(
        first.valueAtRiskUsd,
      )}) moved out to ${shorten(first.recipient)}, initiated by ${shorten(first.initiatedBy)}.`,
    );
  }

  if (authorizingApprovals.length === 0 && attackerList.length > 0) {
    narrative.push(
      `The initiating address ${shorten(
        attackerList[0],
      )} no longer holds a live approval on this wallet — it was either revoked, spent, or granted with a smaller allowance than the amount moved. Permit-based authorisations would not appear here.`,
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
      `Estimated value still reachable through everything listed above: ${usd(stillExposedUsd)}.`,
    );
  }

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
    narrative,
    coverage: scan.coverage,
  };
}
