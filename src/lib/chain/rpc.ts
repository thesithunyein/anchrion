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

/** Ascending ladder of probe windows. The first rejection ends the probe. */
const LOG_WINDOW_LADDER = [100, 500, 2_000, 10_000, 50_000, 250_000, 2_000_000] as const;

interface WindowProbe {
  window: number | null;
  at: number;
}

const windowProbeCache = new Map<string, WindowProbe>();
const WINDOW_PROBE_TTL_MS = 10 * 60 * 1000;

/**
 * Largest log window this endpoint will actually answer for this chain.
 *
 * Probes with a real query against a high-volume token so the answer reflects
 * what the node will accept in practice, then caches it per chain. Returns null
 * when even the smallest window is refused — the caller must then report approval
 * event history as unmeasured rather than as empty.
 */
export async function probeLogWindow(
  urls: string[],
  probeToken: string,
  owner: string,
  latestBlock: number,
): Promise<number | null> {
  const pinned = configuredLogWindow();
  if (pinned !== null) return pinned;

  const cacheKey = urls[0] ?? '';
  const cached = windowProbeCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.at < WINDOW_PROBE_TTL_MS) return cached.window;

  const ownerTopic = `0x${pad32(owner)}`;
  let best: number | null = null;
  for (const window of LOG_WINDOW_LADDER) {
    try {
      // Mirror the shape of the real query (token-scoped + owner-filtered) so the
      // probe measures the same limit the scan will hit, not a looser one.
      await rpc<unknown[]>(
        urls,
        'eth_getLogs',
        [
          {
            address: probeToken,
            fromBlock: `0x${Math.max(0, latestBlock - window).toString(16)}`,
            toBlock: 'latest',
            topics: [APPROVAL_EVENT_TOPIC, ownerTopic],
          },
        ],
        12_000,
      );
      best = window;
    } catch {
      break;
    }
  }

  windowProbeCache.set(cacheKey, { window: best, at: now });
  return best;
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
  const ownerTopic = `0x${pad32(owner)}`;
  // Two attempts: transient endpoint failures are common, and giving up after one
  // silently drops a real permission out of the report.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const rows = await rpc<ApprovalLogRow[]>(
        urls,
        'eth_getLogs',
        [
          {
            address: tokenAddress,
            fromBlock: `0x${Math.max(0, latestBlock - windowBlocks).toString(16)}`,
            toBlock: 'latest',
            topics: [APPROVAL_EVENT_TOPIC, ownerTopic],
          },
        ],
        12_000,
      );
      if (!Array.isArray(rows)) continue;
      return { rows, windowBlocks };
    } catch {
      continue;
    }
  }
  return { rows: [], windowBlocks: null };
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
