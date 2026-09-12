/**
 * Minimal JSON-RPC primitives with endpoint failover.
 *
 * Everything here returns null (or throws for `rpc`) rather than guessing, so
 * callers can distinguish "measured false" from "not measured".
 */

import { APPROVAL_EVENT_TOPIC } from '@/lib/abi/erc20';
import { SUPPORTED_CHAINS, isSupportedChainId } from '@/types/approval';

export function rpcUrlsFor(chainId: number): string[] {
  if (!isSupportedChainId(chainId)) return [];
  const chain = SUPPORTED_CHAINS[chainId];
  return [chain.rpcUrl, ...chain.rpcFallbacks];
}

export async function rpc<T>(
  urls: string[],
  method: string,
  params: unknown[],
  timeoutMs = 15_000,
): Promise<T> {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      const payload = (await response.json()) as {
        result?: T;
        error?: { message: string };
      };
      if (payload.error) {
        lastError = new Error(payload.error.message);
        continue;
      }
      if (payload.result !== undefined) return payload.result;
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All RPC endpoints failed');
}

/** Runs `fn` over `items` in fixed-size chunks to stay inside public rate limits. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += limit) {
    const chunk = items.slice(index, index + limit);
    const settled = await Promise.all(chunk.map((item) => fn(item)));
    results.push(...settled);
  }
  return results;
}

export function pad32(address: string): string {
  return address.slice(2).toLowerCase().padStart(64, '0');
}

/** Reads the live ERC-20 allowance. null means the call failed — not zero. */
export async function callAllowance(
  urls: string[],
  tokenAddress: string,
  owner: string,
  spender: string,
): Promise<bigint | null> {
  const data = `0xdd62ed3e${pad32(owner)}${pad32(spender)}`;
  try {
    const hex = await rpc<string>(urls, 'eth_call', [{ to: tokenAddress, data }, 'latest']);
    return BigInt(hex);
  } catch {
    return null;
  }
}

/** null means the RPC did not answer — not "no code". */
export async function hasBytecode(urls: string[], address: string): Promise<boolean | null> {
  try {
    const code = await rpc<string>(urls, 'eth_getCode', [address, 'latest']);
    if (typeof code !== 'string') return null;
    return code !== '0x' && code !== '0x0' && code.length > 2;
  } catch {
    return null;
  }
}

/**
 * How far back a token's approval history can be read, measured rather than
 * assumed.
 *
 * `eth_getLogs` over a wide range is an archive query, and keyless public RPC
 * endpoints increasingly refuse those. Measured on Sep 12, 2026 with a
 * owner-filtered USDC query, which is the heaviest realistic case:
 *
 *   endpoint                       100 blocks   300 blocks
 *   ethereum-rpc.publicnode.com    ok           400 ("archive requests require
 *                                                a personal token")
 *   eth.drpc.org                   ok           rejected (code 35)
 *   1rpc.io/eth                    rejected      rejected
 *
 * So the honest position is: the accepted window is unknown per endpoint and can
 * change without notice, and it is discovered by probing rather than hardcoded.
 * A deployment that configures its own archive-capable RPC through
 * NEXT_PUBLIC_RPC_* can pin the window with NEXT_PUBLIC_LOG_WINDOW_BLOCKS.
 */
function configuredLogWindow(): number | null {
  const raw = Number(process.env.NEXT_PUBLIC_LOG_WINDOW_BLOCKS);
  if (Number.isFinite(raw) && raw >= 100 && raw <= 20_000_000) return Math.floor(raw);
  return null;
}

/**
 * Ascending ladder of probe windows. Each step must be *verifiably* complete
 * before it is accepted — see probeLogWindow.
 */
const LOG_WINDOW_LADDER = [500, 2_000, 10_000, 50_000, 200_000] as const;

/**
 * A window returning more rows than this is not worth climbing past: the scan
 * only uses the newest few pairs per token, and a huge response costs more than
 * the reach is worth.
 */
const MAX_ROWS_PER_LOG_WINDOW = 3_000;

interface WindowProbe {
  window: number | null;
  /**
   * Cached alongside the window: dropping it made a re-scan of the same wallet
   * inside the TTL report the same window with the "wider ranges rejected"
   * warning silently missing.
   */
  truncated: boolean;
  at: number;
}

const windowProbeCache = new Map<string, WindowProbe>();
const WINDOW_PROBE_TTL_MS = 10 * 60 * 1000;

/** Identifies a log row so two windows' results can be compared as sets. */
function logRowKey(row: { transactionHash?: string; logIndex?: string; blockNumber?: string }): string {
  return `${row.transactionHash ?? ''}:${row.logIndex ?? row.blockNumber ?? ''}`;
}

/**
 * Largest log window this endpoint will actually answer for this chain.
 *
 * Probes with a real query against a high-volume token so the answer reflects
 * what the node will accept in practice, then caches it per chain. Returns null
 * when even the smallest window is refused — the caller must then report approval
 * event history as unmeasured rather than as empty.
 */
export interface LogWindowProbe {
  /** Widest window whose answer was verified complete. null = none usable. */
  window: number | null;
  /**
   * True when a wider range was *answered but incomplete*. Endpoints do this
   * silently, and reporting that window as coverage would overstate what we saw.
   */
  truncated: boolean;
}

async function fetchLogs(
  urls: string[],
  address: string,
  fromBlock: number,
  topics: string[],
): Promise<ApprovalLogRow[] | null> {
  // Two attempts: an empty answer from a flaky endpoint must not be mistaken for
  // "this wallet has no approvals".
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const rows = await rpc<ApprovalLogRow[]>(
        urls,
        'eth_getLogs',
        [
          {
            address,
            fromBlock: `0x${Math.max(0, fromBlock).toString(16)}`,
            toBlock: 'latest',
            topics,
          },
        ],
        15_000,
      );
      if (Array.isArray(rows)) return rows;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Widest log window this endpoint will answer *completely*, measured.
 *
 * Accepting a window merely because the endpoint did not error is wrong, and this
 * is not theoretical. Measured 2026-09-12 against Tenderly's public gateway with
 * an owner-filtered USDC query for a busy approver:
 *
 *   window      rows returned
 *   5,000       12,530
 *   50,000      70      <-- answered, no error, most rows missing
 *   2,000,000   70      <-- same silent truncation
 *
 * A wider range that returns *fewer* rows than a narrower one cannot be right, and
 * a wider range that is missing rows the narrower one contained is incomplete.
 * So each rung is validated against the rung below it before being accepted, and
 * the first failure ends the climb at the last verified window.
 */
export async function probeLogWindow(
  urls: string[],
  probeToken: string,
  owner: string,
  latestBlock: number,
): Promise<LogWindowProbe> {
  const pinned = configuredLogWindow();
  if (pinned !== null) return { window: pinned, truncated: false };

  const cacheKey = `${urls[0] ?? ''}|${probeToken}`;
  const cached = windowProbeCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.at < WINDOW_PROBE_TTL_MS) {
    return { window: cached.window, truncated: cached.truncated };
  }

  const ownerTopic = `0x${pad32(owner)}`;
  const topics = [APPROVAL_EVENT_TOPIC, ownerTopic];

  let verifiedWindow: number | null = null;
  let verifiedKeys: Set<string> | null = null;
  let truncated = false;

  for (const window of LOG_WINDOW_LADDER) {
    const rows = await fetchLogs(urls, probeToken, latestBlock - window, topics);
    if (rows === null) {
      // Refused outright: stop climbing, keep the last verified window.
      break;
    }

    const keys = new Set(rows.map(logRowKey));

    if (verifiedKeys !== null) {
      // Completeness test: everything in the smaller window must still be here.
      const missing = Array.from(verifiedKeys).filter((key) => !keys.has(key));
      if (missing.length > 0 || keys.size < verifiedKeys.size) {
        truncated = true;
        break;
      }
    }

    verifiedWindow = window;
    verifiedKeys = keys;

    // Enough rows already: climbing further costs more than it can add.
    if (keys.size > MAX_ROWS_PER_LOG_WINDOW) break;
  }

  windowProbeCache.set(cacheKey, { window: verifiedWindow, truncated, at: now });
  return { window: verifiedWindow, truncated };
}

/**
 * Approval events for one token where this owner is the approver, inside a
 * window the endpoint was measured to accept.
 *
 * Reporting `windowBlocks: null` means no window was answered at all — callers
 * must surface that as a coverage gap, never as "there were no approvals".
 */
export async function readApprovalLogsForToken(
  urls: string[],
  tokenAddress: string,
  owner: string,
  latestBlock: number,
  windowBlocks: number,
): Promise<{ rows: ApprovalLogRow[]; windowBlocks: number | null }> {
  const rows = await fetchLogs(urls, tokenAddress, latestBlock - windowBlocks, [
    APPROVAL_EVENT_TOPIC,
    `0x${pad32(owner)}`,
  ]);
  if (rows === null) return { rows: [], windowBlocks: null };
  return { rows, windowBlocks };
}

export async function latestBlockNumber(urls: string[]): Promise<number | null> {
  try {
    const hex = await rpc<string>(urls, 'eth_blockNumber', []);
    return Number(BigInt(hex));
  } catch {
    return null;
  }
}

export async function blockTimestamp(
  urls: string[],
  blockNumber: number,
): Promise<number | null> {
  try {
    const block = await rpc<{ timestamp?: string }>(urls, 'eth_getBlockByNumber', [
      `0x${blockNumber.toString(16)}`,
      false,
    ]);
    return block.timestamp ? Number(BigInt(block.timestamp)) : null;
  } catch {
    return null;
  }
}

export interface ApprovalLogRow {
  address: string;
  topics: string[];
  transactionHash: string;
  blockNumber: string;
  /** Present on every real log; used to identify a row when comparing windows. */
  logIndex?: string;
}

/**
 * Approval events emitted by any token where this wallet is the owner.
 * Only a bounded recent window is scanned: public RPC endpoints reject deep ranges.
 */
export async function getTransactionByHash(
  urls: string[],
  hash: string,
): Promise<{ from: string; to: string | null; blockNumber: number | null } | null> {
  try {
    const tx = await rpc<{ from?: string; to?: string | null; blockNumber?: string }>(
      urls,
      'eth_getTransactionByHash',
      [hash],
    );
    const from = (tx.from ?? '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(from)) return null;
    const to = (tx.to ?? '').toLowerCase();
    return {
      from,
      to: /^0x[0-9a-f]{40}$/.test(to) ? to : null,
      blockNumber: tx.blockNumber ? Number(BigInt(tx.blockNumber)) : null,
    };
  } catch {
    return null;
  }
}
