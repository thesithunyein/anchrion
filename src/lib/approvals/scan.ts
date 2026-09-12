/**
 * Approval discovery.
 *
 * How a permission is found, in order of authority:
 *
 *   1. `approve(address,uint256)` / `increaseAllowance` calls decoded from the
 *      wallet's own explorer history. These name the spender explicitly, so they
 *      find permissions granted to a contract nobody has ever heard of — the ones
 *      that actually drain wallets. A hardcoded allowlist can never do this.
 *   2. `Approval` events for each token the wallet has touched, filtered to this
 *      owner. This is the only path that finds a permission granted *inside* a
 *      contract call, and the window it can reach is probed rather than assumed
 *      (see probeLogWindow) — on an endpoint that refuses wide ranges the scan
 *      says so instead of reporting "nothing".
 *   3. Live `allowance(owner, spender)` reads over every candidate pair. This is
 *      the authoritative current state: a pair this reports as zero was granted
 *      and later revoked, and that is counted rather than hidden.
 *
 * Candidate spenders come from decoded approvals, from every contract the wallet
 * has called, and from a small bundled seed list — so a permission to an unknown
 * contract the wallet has interacted with is found even when no approval event is
 * readable.
 *
 * Every step degrades to "not measured" and says so in `coverage.notes`.
 */

import {
  APPROVE_SELECTOR,
  INCREASE_ALLOWANCE_SELECTOR,
  formatUnits,
  isUnlimitedAllowance,
  readAddressArg,
} from '@/lib/abi/erc20';
import {
  callAllowance,
  hasBytecode,
  latestBlockNumber,
  mapLimit,
  probeLogWindow,
  readApprovalLogsForToken,
  rpc,
  rpcUrlsFor,
} from '@/lib/chain/rpc';
import {
  explorerApiFor,
  fetchContractAgeDays,
  fetchContractCreator,
  fetchContractInfo,
  fetchNormalTransactions,
  fetchTokenTransfers,
} from '@/lib/explorer/blockscout';
import { getUsdPrices, priceFor } from '@/lib/prices';
import { calculateRiskScore } from '@/lib/risk/scorer';
import {
  SUPPORTED_CHAINS,
  isSupportedChainId,
  type Approval,
  type ChainId,
  type ScanCoverage,
  type TokenMeta,
} from '@/types/approval';

/* ── Scan budgets. Chosen so a scan stays interactive on public endpoints. ── */

/** Spenders we resolve contract facts for (verification, deployer, age, flag). */
const MAX_SPENDERS_ENRICHED = 30;
/** Distinct spenders carried into the allowance cross-product. */
const MAX_SPENDER_CANDIDATES = 35;
/** Tokens whose approvals are read. */
const MAX_TOKENS_SCANNED = 10;
/** Total (token, spender) pairs checked on chain. */
const MAX_PAIRS_CHECKED = 400;
/** Approval events decoded per token before we stop adding pairs. */
const MAX_LOG_PAIRS_PER_TOKEN = 25;
/** Wall-clock budget for the log phase, so a slow endpoint cannot stall a scan. */
const LOG_SCAN_BUDGET_MS = 20_000;
/**
 * Every token's wide read is re-checked against this narrower read, and the wide
 * one is discarded unless it contains everything the narrow one found.
 *
 * Truncation is token-specific, so a single probe is not enough. Measured on
 * 2026-09-12 with an owner-filtered USDC query for a busy approver: 5,000 blocks
 * returned 12,530 rows, while 50,000 and 2,000,000 blocks both returned 70 —
 * answered without error, most rows silently missing. A light wallet returns the
 * same rows at every window and passes. Only a per-token comparison catches it.
 */
const LOG_VERIFY_WINDOW_BLOCKS = 2_000;

/**
 * Bundled protocol labels, used for display and as spender seeds.
 *
 * This is *not* a threat feed and not a substitute for scanning: it exists so a
 * wallet that approved a major router long ago still gets that router checked
 * even if the approving transaction has scrolled out of its history.
 *
 * `chains` is measured, not assumed. Every address below was checked with
 * `eth_getCode` on 2026-09-12 and is only offered as a seed on a chain where it
 * actually has bytecode — an address with no code can never hold a permission,
 * so seeding it is a fabricated coverage claim and costs a real slot.
 *
 * Reproduce the per-chain measurement:
 *   for a in 0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45 ... ; do
 *     curl -s -X POST https://gateway.tenderly.co/public/mainnet \
 *       -H 'content-type: application/json' \
 *       -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getCode\",\"params\":[\"$a\",\"latest\"]}";
 *   done
 *
 * One entry that used to be here does not survive that check:
 * 0x3bfa4769fb075c4a5fb0ec02e73249f2c16438b3, labelled "Uniswap V3 Router
 * (Sepolia)", returns `0x` on all five supported chains. It was also the only
 * entry the old chain filter allowed on Sepolia, so a Sepolia scan advertised a
 * bundled router that does not exist. It is gone, and the real Sepolia
 * SwapRouter02 — 0x3bFA4769FB09eefC5a80d6E87c3B9c650f7Ae48E — replaces it.
 */
export interface BundledSpender {
  address: string;
  label: string;
  /** Chains where this address was measured to have deployed bytecode. */
  chains: ChainId[];
}

export const BUNDLED_SPENDERS: BundledSpender[] = [
  { address: '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', label: 'Uniswap Universal Router', chains: [1, 8453, 42161, 10] },
  { address: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', label: 'Uniswap V2 Router', chains: [1, 42161, 10] },
  { address: '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', label: 'Uniswap Universal Router', chains: [1, 11155111, 8453, 42161, 10] },
  { address: '0xe592427a0aece92de3edee1f18e0157c05861564', label: 'Uniswap V3 SwapRouter', chains: [1, 8453, 42161, 10] },
  { address: '0xc36442b4a4522e871399cd717abdd847ab11fe88', label: 'Uniswap V3 Position Manager', chains: [1, 8453, 42161, 10] },
  { address: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af', label: 'Uniswap Universal Router', chains: [1, 8453, 42161, 10] },
  { address: '0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b', label: 'Uniswap Universal Router (v1)', chains: [1, 42161, 10] },
  // Canonical form 0x3bFA4769FB09eefC5a80d6E87c3B9c650f7Ae48E. Sepolia only.
  { address: '0x3bfa4769fb09eefc5a80d6e87c3b9c650f7ae48e', label: 'Uniswap V3 SwapRouter02 (Sepolia)', chains: [11155111] },
  { address: '0x111111125421ca6dc452d289314280a0f8842a65', label: '1inch Router', chains: [1, 11155111, 8453, 42161, 10] },
  { address: '0x1111111254eeb25477b68fb85ed929f73a960582', label: '1inch Router (v6)', chains: [1, 8453, 42161, 10] },
  { address: '0xdef1c0ded9bec7f1a1670819833240f027b25eff', label: '0x Exchange Proxy', chains: [1, 11155111, 8453, 42161] },
  { address: '0x881d40237659c251811cec9c364ef91dc08d300c', label: 'MetaMask Swap Router', chains: [1] },
  { address: '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', label: 'SushiSwap Router', chains: [1] },
  { address: '0x000000000022d473030f116ddee9f6b43ac78ba3', label: 'Uniswap Permit2', chains: [1, 11155111, 8453, 42161, 10] },
  { address: '0x00000000000000adc04c56bf30ac9d3c0aaf14dc', label: 'Seaport (OpenSea)', chains: [1, 11155111, 8453, 42161, 10] },
];

export function bundledSpendersFor(chainId: number): BundledSpender[] {
  return BUNDLED_SPENDERS.filter((entry) => entry.chains.includes(chainId as ChainId));
}

/** Display label for a bundled protocol, matched case-insensitively. */
export function bundledLabelFor(address: string | null | undefined): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  return BUNDLED_SPENDERS.find((entry) => entry.address === lower)?.label ?? null;
}

/** High-liquidity tokens per chain, always included as approval candidates. */
const SEED_TOKENS: Record<number, string[]> = {
  1: [
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    '0xdac17f958d2ee523a2206206994597c13d831ec7',
    '0x6b175474e89094c44da98b954eedeac495271d0f',
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  ],
  11155111: [
    '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
    '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
    '0x7b79995e5f793a07bc00c21412e50ecae098e7f9',
  ],
  8453: [
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    '0x4200000000000000000000000000000000000006',
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
  ],
  42161: [
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
  ],
  10: [
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    '0x4200000000000000000000000000000000000006',
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
  ],
};

export interface ScanOutput {
  approvals: Approval[];
  coverage: ScanCoverage;
  degraded: boolean;
}

interface Pair {
  tokenAddress: string;
  spenderAddress: string;
  source: 'approve-call' | 'approval-log' | 'seed';
  txHash: string | null;
  blockNumber: number | null;
  timestamp: number | null;
}

function decodeStringResult(hex: string): string | null {
  if (!hex || hex === '0x') return null;
  const body = hex.slice(2);
  if (body.length >= 128) {
    try {
      const length = Number(BigInt(`0x${body.slice(64, 128)}`));
      if (length > 0 && length <= 64) {
        const decoded = Buffer.from(body.slice(128, 128 + length * 2), 'hex')
          .toString('utf8')
          .replace(/\0/g, '');
        if (/^[\x20-\x7e]+$/.test(decoded)) return decoded;
      }
    } catch {
      /* fall through to bytes32 decoding */
    }
  }
  try {
    const decoded = Buffer.from(body.slice(0, 64), 'hex').toString('utf8').replace(/\0/g, '');
    return decoded || null;
  } catch {
    return null;
  }
}

async function readTokenMeta(
  urls: string[],
  tokenAddress: string,
  fallback?: { symbol: string | null; decimals: number | null; name: string | null },
): Promise<TokenMeta> {
  let symbol = fallback?.symbol ?? null;
  let decimals = fallback?.decimals ?? null;
  const name = fallback?.name ?? null;

  if (!symbol) {
    try {
      const hex = await rpc<string>(urls, 'eth_call', [
        { to: tokenAddress, data: '0x95d89b41' },
        'latest',
      ]);
      symbol = decodeStringResult(hex);
    } catch {
      symbol = null;
    }
  }
  if (decimals === null) {
    try {
      const hex = await rpc<string>(urls, 'eth_call', [
        { to: tokenAddress, data: '0x313ce567' },
        'latest',
      ]);
      decimals = Number(BigInt(hex));
      if (!Number.isFinite(decimals)) decimals = null;
    } catch {
      decimals = null;
    }
  }

  return {
    address: tokenAddress,
    name: name ?? symbol ?? 'Unknown token',
    symbol: symbol ?? 'TOKEN',
    decimals: decimals ?? 18,
  };
}

export async function scanApprovals(
  chainId: number,
  walletAddress: string,
): Promise<ScanOutput> {
  if (!isSupportedChainId(chainId)) {
    throw new Error(`Unsupported chain ${chainId}.`);
  }
  const wallet = walletAddress.toLowerCase();
  const urls = rpcUrlsFor(chainId);
  const notes: string[] = [];
  const explorerReachable = explorerApiFor(chainId) !== null;
  const seedTokens = SEED_TOKENS[chainId] ?? [];

  const [transfers, transactions, latestBlock] = await Promise.all([
    fetchTokenTransfers(chainId, wallet, 5),
    fetchNormalTransactions(chainId, wallet, 5),
    latestBlockNumber(urls),
  ]);

  if (latestBlock === null) {
    notes.push(
      'No RPC endpoint answered a block-number request, so on-chain reads in this scan are incomplete.',
    );
  }

  const pairs = new Map<string, Pair>();
  const addPair = (pair: Pair) => {
    const key = `${pair.tokenAddress}:${pair.spenderAddress}`;
    const existing = pairs.get(key);
    if (!existing || (pair.timestamp ?? Infinity) < (existing.timestamp ?? Infinity)) {
      pairs.set(key, pair);
    }
  };

  /* ── 1. Decoded approvals, and every contract this wallet has called ───── */

  const approvedSpenders = new Set<string>();
  const calledContracts = new Set<string>();
  let approveCallsParsed = 0;

  for (const tx of transactions) {
    if (tx.isError) continue;
    const selector = tx.input.slice(0, 10).toLowerCase();

    // Which contract the wallet called is a spender candidate regardless of the
    // selector: routers grant permissions on the caller's behalf inside their own
    // call, so the permission can exist without an approve() in this history.
    if (/^0x[0-9a-f]{40}$/.test(tx.to) && tx.to !== wallet) {
      calledContracts.add(tx.to);
    }

    if (selector !== APPROVE_SELECTOR && selector !== INCREASE_ALLOWANCE_SELECTOR) continue;
    if (!/^0x[0-9a-f]{40}$/.test(tx.to)) continue;

    const spender = readAddressArg(tx.input, 0)?.toLowerCase();
    if (!spender) continue;
    if (spender === wallet) continue;
    if (spender === '0x0000000000000000000000000000000000000000') continue;

    approveCallsParsed += 1;
    approvedSpenders.add(spender);
    addPair({
      tokenAddress: tx.to,
      spenderAddress: spender,
      source: 'approve-call',
      txHash: tx.hash,
      blockNumber: tx.blockNumber,
      timestamp: tx.timeStamp,
    });
  }

  /* ── 2. Approval events, over a window the endpoint was measured to accept ── */

  const transferTokenList = transfers
    .map((transfer) => transfer.contractAddress)
    .filter((address) => /^0x[0-9a-f]{40}$/.test(address));

  const tokenCandidates = Array.from(
    new Set([...transferTokenList, ...Array.from(pairs.values()).map((pair) => pair.tokenAddress), ...seedTokens]),
  ).slice(0, MAX_TOKENS_SCANNED);

  let approvalLogsParsed = 0;
  let logsWindowUsed: number | null = null;
  let logsTruncated = false;
  /** Tokens whose approval-event history was actually read this scan. */
  let tokensLogRead = 0;
  /** Tokens left unread because the log phase ran out of time. */
  let tokensSkippedByBudget = 0;

  if (latestBlock !== null && tokenCandidates.length > 0) {
    // Probe against the highest-volume seed token: it is the worst case for
    // endpoint truncation, so a ceiling it passes is a reasonable starting point.
    const probeToken = seedTokens[0] ?? tokenCandidates[0];
    const probe = await probeLogWindow(urls, probeToken, wallet, latestBlock);
    logsTruncated = probe.truncated;

    if (probe.window === null) {
      notes.push(
        'No RPC endpoint answered an approval-event query, so permissions granted inside a contract call could not be read in this scan. Everything listed below was found from transaction history and live allowance reads.',
      );
    } else {
      const ceiling = probe.window;
      const logDeadline = Date.now() + LOG_SCAN_BUDGET_MS;
      let windowUsed: number | null = null;

      await mapLimit(tokenCandidates, 4, async (tokenAddress) => {
        if (Date.now() > logDeadline) {
          tokensSkippedByBudget += 1;
          return;
        }
        const { rows: wide, windowBlocks: used } = await readApprovalLogsForToken(
          urls,
          tokenAddress,
          wallet,
          latestBlock,
          ceiling,
        );
        if (used === null) return;
        tokensLogRead += 1;

        let rows = wide;
        let tokenWindow: number = ceiling;

        /*
         * Verify this token's wide read against a narrow one, and prefer the
         * narrow read when the wide one is missing anything the narrow one saw.
         * Reporting the wide window as coverage while it is silently incomplete
         * would be the exact kind of false confidence this project exists to
         * remove, so the check runs even when the wide read returned plenty.
         */
        if (ceiling > LOG_VERIFY_WINDOW_BLOCKS) {
          const { rows: narrow } = await readApprovalLogsForToken(
            urls,
            tokenAddress,
            wallet,
            latestBlock,
            LOG_VERIFY_WINDOW_BLOCKS,
          );
          if (narrow.length > 0) {
            const wideKeys = new Set(
              wide.map((row) => `${row.transactionHash ?? ''}:${row.logIndex ?? row.blockNumber ?? ''}`),
            );
            const missing = narrow.filter(
              (row) => !wideKeys.has(`${row.transactionHash ?? ''}:${row.logIndex ?? row.blockNumber ?? ''}`),
            );
            if (missing.length > 0) {
              logsTruncated = true;
              rows = narrow;
              tokenWindow = LOG_VERIFY_WINDOW_BLOCKS;
            }
          }
        }

        // Coverage is only as good as the weakest token, so track the minimum.
        windowUsed = windowUsed === null ? tokenWindow : Math.min(windowUsed, tokenWindow);

        for (const row of rows.slice(0, MAX_LOG_PAIRS_PER_TOKEN)) {
          if (approvalLogsParsed >= MAX_LOG_PAIRS_PER_TOKEN * tokenCandidates.length) return;
          if (!row.topics || row.topics.length < 3) continue;
          const spender = `0x${row.topics[2].slice(26)}`.toLowerCase();
          if (!/^0x[0-9a-f]{40}$/.test(spender) || spender === wallet) continue;
          approvalLogsParsed += 1;
          approvedSpenders.add(spender);
          addPair({
            tokenAddress,
            spenderAddress: spender,
            source: 'approval-log',
            txHash: row.transactionHash ?? null,
            blockNumber: row.blockNumber ? Number(BigInt(row.blockNumber)) : null,
            timestamp: null,
          });
        }
      });

      logsWindowUsed = windowUsed;
      if (tokensLogRead === 0) {
        notes.push(
          'Approval-event history could not be read for any candidate token, so a permission granted inside a contract call is not covered by this result. Everything listed was found from transaction history and live allowance reads.',
        );
      }
    }
  }

  /* ── 3. Candidate spenders, then the allowance cross-product ───────────── */

  /*
   * Priority: spenders we know approved something, then contracts the wallet has
   * called (routers, dApps), then the bundled seeds — but the seeds get reserved
   * slots rather than whatever is left over.
   *
   * Appended, the bundle is silently emptied by a busy wallet: measured on a
   * 35-slot budget, a wallet whose history names more than 34 spenders pushed the
   * bundled list down to a single entry while the coverage panel still claimed the
   * list had been included. A floor that disappears under load is not a floor.
   */
  const bundledSeeds = bundledSpendersFor(chainId).map((entry) => entry.address);
  const reservedForBundle = Math.min(bundledSeeds.length, MAX_SPENDER_CANDIDATES);
  const walletSpenders = Array.from(new Set([...approvedSpenders, ...calledContracts]));
  const walletSlots = Math.max(0, MAX_SPENDER_CANDIDATES - reservedForBundle);
  const walletSpendersIncluded = walletSpenders.slice(0, walletSlots);

  if (walletSpenders.length > walletSpendersIncluded.length) {
    notes.push(
      `${walletSpenders.length - walletSpendersIncluded.length} contract(s) this wallet has called were left out of the spender cross-product to keep room for the bundled well-known routers; their live allowance may still be unread.`,
    );
  }

  const spenderCandidates = Array.from(
    new Set([...walletSpendersIncluded, ...bundledSeeds]),
  );

  for (const tokenAddress of tokenCandidates) {
    for (const spenderAddress of spenderCandidates) {
      addPair({
        tokenAddress,
        spenderAddress,
        source: 'seed',
        txHash: null,
        blockNumber: null,
        timestamp: null,
      });
    }
  }

  const allPairs = Array.from(pairs.values());
  const cappedPairs = allPairs.slice(0, MAX_PAIRS_CHECKED);
  if (allPairs.length > cappedPairs.length) {
    notes.push(
      `${allPairs.length - cappedPairs.length} candidate (token, spender) pair(s) were not checked on chain, to keep the scan inside its time budget.`,
    );
  }

  const prices = await getUsdPrices();

  const transferMetaByToken = new Map<
    string,
    { symbol: string | null; decimals: number | null; name: string | null; lastSeen: number | null }
  >();
  for (const transfer of transfers) {
    const existing = transferMetaByToken.get(transfer.contractAddress);
    transferMetaByToken.set(transfer.contractAddress, {
      symbol: existing?.symbol ?? transfer.tokenSymbol,
      decimals: existing?.decimals ?? transfer.tokenDecimal,
      name: existing?.name ?? transfer.tokenName,
      lastSeen: Math.max(existing?.lastSeen ?? 0, transfer.timeStamp ?? 0) || null,
    });
  }

  const allowanceResults = await mapLimit(cappedPairs, 10, async (pair) => ({
    pair,
    allowance: await callAllowance(urls, pair.tokenAddress, wallet, pair.spenderAddress),
  }));

  const active = allowanceResults.filter(
    (result) => result.allowance !== null && result.allowance > BigInt(0),
  );
  /*
   * A zero allowance means two different things, and conflating them would be a
   * lie. For a pair that an approval event or an approve() call proved existed,
   * zero means the permission was revoked. For a seed pair there may never have
   * been a permission at all, so it is counted as "no permission", not "revoked".
   */
  const revokedFound = allowanceResults.filter(
    (result) =>
      result.allowance !== null &&
      result.allowance === BigInt(0) &&
      result.pair.source !== 'seed',
  ).length;
  const unmeasured = allowanceResults.filter((result) => result.allowance === null).length;
  if (unmeasured > 0) {
    notes.push(
      `${unmeasured} permission(s) could not be read from any RPC endpoint, so their current state is unknown rather than revoked.`,
    );
  }

  const uniqueSpenders = Array.from(new Set(active.map((result) => result.pair.spenderAddress)));
  const enrichedSpenders = uniqueSpenders.slice(0, MAX_SPENDERS_ENRICHED);
  if (uniqueSpenders.length > MAX_SPENDERS_ENRICHED) {
    notes.push(
      `Contract details were resolved for the ${MAX_SPENDERS_ENRICHED} highest-ranked spenders; ${uniqueSpenders.length - MAX_SPENDERS_ENRICHED} further spender(s) are listed with detection-limited details.`,
    );
  }

  const spenderInfo = new Map<
    string,
    {
      hasBytecode: boolean | null;
      sourceVerified: boolean | null;
      contractName: string | null;
      isScamFlag: boolean | null;
      creatorAddress: string | null;
      contractAgeDays: number | null;
      label: string | null;
    }
  >();

  await mapLimit(enrichedSpenders, 5, async (spender) => {
    const [code, info, creator, ageDays] = await Promise.all([
      hasBytecode(urls, spender),
      fetchContractInfo(chainId, spender),
      fetchContractCreator(chainId, spender),
      fetchContractAgeDays(chainId, spender),
    ]);
    spenderInfo.set(spender, {
      hasBytecode: code,
      sourceVerified: info.verified,
      contractName: info.name,
      isScamFlag: info.isScam,
      creatorAddress: creator,
      contractAgeDays: ageDays,
      // A proxy's name is not a useful label for a person, so a recognised
      // protocol label wins, then the explorer name, then nothing.
      label: bundledLabelFor(spender) ?? (!/proxy/i.test(info.name ?? '') ? info.name : null),
    });
  });

  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenMetaCache = new Map<string, TokenMeta>();
  const approvals: Approval[] = [];

  for (const { pair, allowance } of active) {
    if (allowance === null) continue;

    let token = tokenMetaCache.get(pair.tokenAddress);
    if (!token) {
      const fallback = transferMetaByToken.get(pair.tokenAddress) ?? null;
      token = await readTokenMeta(urls, pair.tokenAddress, fallback ?? undefined);
      tokenMetaCache.set(pair.tokenAddress, token);
    }

    const isUnlimited = isUnlimitedAllowance(allowance);
    const price = priceFor(prices.prices, token.symbol);
    const humanAmount = isUnlimited
      ? Number.POSITIVE_INFINITY
      : Number(formatUnits(allowance, token.decimals));
    const valueAtRiskUsd =
      price === null
        ? 0
        : isUnlimited
          ? Math.round(price * 10_000)
          : Math.round(humanAmount * price);

    const info = spenderInfo.get(pair.spenderAddress);
    const lastSeen = transferMetaByToken.get(pair.tokenAddress)?.lastSeen ?? null;
    const lastTokenActivityDays =
      lastSeen === null ? null : Math.max(0, (nowSeconds - lastSeen) / 86_400);

    const provisional: Approval = {
      id: `${chainId}:${pair.tokenAddress}:${pair.spenderAddress}`,
      walletAddress: wallet,
      chainId,
      token,
      spenderAddress: pair.spenderAddress,
      spenderLabel: info?.label ?? bundledLabelFor(pair.spenderAddress),
      allowanceRaw: allowance.toString(),
      allowanceFormatted: isUnlimited ? 'Unlimited' : formatUnits(allowance, token.decimals),
      isUnlimited,
      valueAtRiskUsd,
      priceSource: prices.source,
      riskScore: 0,
      riskLevel: 'safe',
      riskFactors: [],
      family: info?.creatorAddress ?? null,
      discoverySource:
        pair.source === 'approve-call'
          ? 'approve-call'
          : pair.source === 'approval-log'
            ? 'approval-log'
            : 'allowance-read',
      createdAtBlock: pair.blockNumber,
      createdAtTxHash: pair.txHash,
      approvedAt: pair.timestamp ? new Date(pair.timestamp * 1000).toISOString() : null,
      signals: {
        hasBytecode: info?.hasBytecode ?? null,
        sourceVerified: info?.sourceVerified ?? null,
        contractName: info?.contractName ?? null,
        isScamFlag: info?.isScamFlag ?? null,
        creatorAddress: info?.creatorAddress ?? null,
        contractAgeDays: info?.contractAgeDays ?? null,
        lastTokenActivityDays,
        priceSource: prices.source,
      },
    };

    const assessment = calculateRiskScore(provisional);
    approvals.push({
      ...provisional,
      riskScore: assessment.score,
      riskLevel: assessment.level,
      riskFactors: assessment.factors,
    });
  }

  approvals.sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    return b.valueAtRiskUsd - a.valueAtRiskUsd;
  });

  if (!explorerReachable) {
    notes.push(
      'No block explorer is configured for this chain, so transaction history, contract verification and deployment age could not be read.',
    );
  }
  if (prices.source === 'static') {
    notes.push('USD values use a dated static price snapshot because live prices were unavailable.');
  }
  if (logsWindowUsed !== null) {
    /*
     * Reported as "read for N of M" rather than "read for M": a token skipped by
     * the log time budget was not read, and saying otherwise would inflate the
     * one number a reviewer is most likely to trust.
     */
    const skipped =
      tokensSkippedByBudget > 0
        ? ` ${tokensSkippedByBudget} further token(s) were not read before the log phase hit its time budget.`
        : '';
    notes.push(
      `Approval events were read for ${tokensLogRead} of ${tokenCandidates.length} candidate token(s) over the last ${logsWindowUsed.toLocaleString()} blocks. ${logsWindowUsed.toLocaleString()} is the narrowest window actually used, because each token's wide read was validated against a ${LOG_VERIFY_WINDOW_BLOCKS.toLocaleString()}-block read and rejected whenever it turned out to be incomplete. An approval older than that, which never appeared in this wallet's transaction history, would not be seen.${skipped}`,
    );
  }
  if (logsTruncated) {
    notes.push(
      'A wider approval-event range was answered with incomplete results, so it was rejected and the verified window above was used instead. This is an endpoint behaviour, not a wallet behaviour: it silently returns fewer events than exist for wide ranges, which is why this scan validates each window against a narrower one before trusting it.',
    );
  }
  notes.push(
    'Anchrion covers ERC-20 allowance approvals. ERC-721 / ERC-1155 approvals and off-chain permits (Permit2, ERC-2612, Seaport orders) are not covered.',
  );
  /*
   * What the bundle can honestly claim is limited to the bundled addresses whose
   * live allowance was actually read. Counting membership in the candidate list
   * instead would let the note claim routers the on-chain pair budget never
   * reached.
   */
  if (bundledSeeds.length > 0) {
    const bundledChecked = new Set(
      cappedPairs
        .filter((pair) => bundledSeeds.includes(pair.spenderAddress))
        .map((pair) => pair.spenderAddress),
    ).size;
    const bundledMissed = bundledSeeds.length - bundledChecked;
    notes.push(
      `${bundledChecked} of the ${bundledSeeds.length} bundled well-known router address(es) for ${SUPPORTED_CHAINS[chainId].name} had their live allowance read in this scan${bundledMissed > 0 ? `; the other ${bundledMissed} fell outside the on-chain pair budget` : ''}. The bundle is a floor, not the method — it exists so a router approved before this wallet's readable history is still checked. Anchrion ships no malicious-address list.`,
    );
  }

  const coverage: ScanCoverage = {
    approveCallsParsed,
    approvalLogsParsed,
    tokensScanned: tokenCandidates.length,
    pairsChecked: cappedPairs.length,
    revokedFound,
    notGrantedFound: allowanceResults.filter(
      (result) =>
        result.allowance !== null && result.allowance === BigInt(0) && result.pair.source === 'seed',
    ).length,
    transfersScanned: transfers.length,
    transactionsScanned: transactions.length,
    logsWindowBlocks: logsWindowUsed,
    logsWindowTruncated: logsTruncated,
    explorerReachable,
    priceSource: prices.source,
    notes,
  };

  // "Degraded" now means one specific thing: history could not be read, so the
  // scan leans entirely on live allowance reads and the bundled spender seeds.
  return { approvals, coverage, degraded: !explorerReachable };
}
