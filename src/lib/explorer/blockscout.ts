/**
 * Keyless block-explorer client.
 *
 * Why an explorer instead of an indexer: Anchrion must work from a fresh clone
 * with no API keys and no signup.
 *
 * Which endpoint, and why: Blockscout's v1 (Etherscan-compatible) endpoint now
 * rejects unkeyed traffic with "Too many requests", so the v2 REST API is the
 * primary path — it answers without a key and returns verification status,
 * deployer, creation transaction and the public reputation flag in a single
 * address lookup. `NEXT_PUBLIC_EXPLORER_API_*` can point at your own
 * Etherscan-compatible endpoint instead, in which case the v1 path is used.
 *
 * Contract: every function returns null / [] on failure, and callers must treat
 * that as "not measured" — never as "safe".
 */

import { blockTimestamp, getTransactionByHash, rpcUrlsFor } from '@/lib/chain/rpc';
import { SUPPORTED_CHAINS, type ChainId } from '@/types/approval';

export interface ExplorerTokenTransfer {
  hash: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  tokenDecimal: number | null;
  value: string;
  timeStamp: number | null;
  blockNumber: number | null;
}

export interface ExplorerTx {
  hash: string;
  from: string;
  to: string;
  input: string;
  timeStamp: number | null;
  blockNumber: number | null;
  isError: boolean;
}

export interface ExplorerContractInfo {
  verified: boolean | null;
  name: string | null;
  proxy: boolean | null;
  /** Explorer's own public scam/reputation flag. null = not reported. */
  isScam: boolean | null;
}

/** In-process cache so one scan does not re-query the same contract. */
const cache = new Map<string, unknown>();

const ENV_OVERRIDES: Record<number, string | undefined> = {
  1: process.env.NEXT_PUBLIC_EXPLORER_API_MAINNET,
  11155111: process.env.NEXT_PUBLIC_EXPLORER_API_SEPOLIA,
  8453: process.env.NEXT_PUBLIC_EXPLORER_API_BASE,
  42161: process.env.NEXT_PUBLIC_EXPLORER_API_ARBITRUM,
  10: process.env.NEXT_PUBLIC_EXPLORER_API_OPTIMISM,
};

export function explorerApiFor(chainId: number): string | null {
  const override = ENV_OVERRIDES[chainId];
  if (override) return override.replace(/\/$/, '');
  if (chainId in SUPPORTED_CHAINS) {
    return SUPPORTED_CHAINS[chainId as ChainId].explorerApi;
  }
  return null;
}

/** Blockscout v2 root, derived from the configured endpoint. */
function v2Base(chainId: number): string | null {
  const base = explorerApiFor(chainId);
  if (!base) return null;
  return `${base.replace(/\/api$/, '')}/api/v2`;
}

async function getJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  const cached = cache.get(url);
  if (cached !== undefined) return cached as T | null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (!response.ok) {
      cache.set(url, null);
      return null;
    }
    const payload = (await response.json()) as T;
    cache.set(url, payload);
    return payload;
  } catch {
    return null;
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toUnixSeconds(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

function isAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/* ── v2 response shapes ──────────────────────────────────────────────────── */

interface V2AddressRef {
  hash?: string;
  is_scam?: boolean | null;
  name?: string | null;
}

interface V2Page<T> {
  items?: T[];
  next_page_params?: Record<string, string | number | null> | null;
}

interface V2TokenTransfer {
  transaction_hash?: string;
  block_number?: number | string;
  timestamp?: string;
  from?: V2AddressRef;
  to?: V2AddressRef;
  token?: {
    address_hash?: string;
    name?: string | null;
    symbol?: string | null;
    decimals?: string | number | null;
  } | null;
  total?: { value?: string; decimals?: string | number | null } | null;
}

interface V2Transaction {
  hash?: string;
  block_number?: number | string;
  timestamp?: string;
  from?: V2AddressRef;
  to?: V2AddressRef | null;
  raw_input?: string;
  input?: string;
  status?: string;
  result?: string;
}

function pageUrl(
  base: string,
  path: string,
  params: Record<string, string>,
  next?: Record<string, string | number | null> | null,
): string {
  const query = new URLSearchParams(params);
  if (next) {
    for (const [key, value] of Object.entries(next)) {
      if (value !== null && value !== undefined) query.set(key, String(value));
    }
  }
  return `${base}${path}?${query.toString()}`;
}

async function v2Pages<T>(
  chainId: number,
  path: string,
  params: Record<string, string>,
  pages: number,
): Promise<T[]> {
  const base = v2Base(chainId);
  if (!base) return [];
  const out: T[] = [];
  let next: Record<string, string | number | null> | null | undefined = null;
  for (let page = 0; page < pages; page += 1) {
    const body: V2Page<T> | null = await getJson<V2Page<T>>(pageUrl(base, path, params, next));
    const items = body?.items;
    if (!Array.isArray(items) || items.length === 0) break;
    out.push(...items);
    next = body?.next_page_params ?? null;
    if (!next) break;
  }
  return out;
}

/* ── Address info ────────────────────────────────────────────────────────── */

export interface ExplorerAddressInfo {
  /** true = verified source, false = explorer has no source, null = not measured. */
  verified: boolean | null;
  name: string | null;
  proxy: boolean | null;
  /** Explorer's public reputation flag. null = the explorer did not report one. */
  isScam: boolean | null;
  creator: string | null;
  creationTxHash: string | null;
  /** Unix seconds the contract was created, when the explorer reported it. */
  createdAt: number | null;
}

const UNKNOWN_ADDRESS_INFO: ExplorerAddressInfo = {
  verified: null,
  name: null,
  proxy: null,
  isScam: null,
  creator: null,
  creationTxHash: null,
  createdAt: null,
};

/**
 * One cached lookup per address covering verification, deployer, creation time
 * and reputation — replaces four separate explorer round-trips.
 */
export async function fetchAddressInfo(
  chainId: number,
  address: string,
): Promise<ExplorerAddressInfo> {
  if (!isAddress(address)) return UNKNOWN_ADDRESS_INFO;
  const key = `info:${chainId}:${address.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key) as ExplorerAddressInfo;

  const base = v2Base(chainId);
  if (!base) {
    cache.set(key, UNKNOWN_ADDRESS_INFO);
    return UNKNOWN_ADDRESS_INFO;
  }

  const row = await getJson<{
    name?: string | null;
    is_verified?: boolean | null;
    is_scam?: boolean | null;
    proxy_type?: string | null;
    creator_address_hash?: string | null;
    creation_transaction_hash?: string | null;
  }>(`${base}/addresses/${address}`);

  if (!row) {
    cache.set(key, UNKNOWN_ADDRESS_INFO);
    return UNKNOWN_ADDRESS_INFO;
  }

  const creator = isAddress(row.creator_address_hash)
    ? row.creator_address_hash.toLowerCase()
    : null;
  const creationTxHash = /^0x[0-9a-fA-F]{64}$/.test(asString(row.creation_transaction_hash))
    ? asString(row.creation_transaction_hash)
    : null;

  let createdAt: number | null = null;
  if (creationTxHash) {
    const tx = await getJson<{ timestamp?: string }>(`${base}/transactions/${creationTxHash}`);
    createdAt = toUnixSeconds(tx?.timestamp);
    if (createdAt === null) {
      // Last resort: the creation block timestamp straight from RPC.
      const urls = rpcUrlsFor(chainId);
      const txRpc = await getTransactionByHash(urls, creationTxHash);
      if (txRpc?.blockNumber !== null && txRpc?.blockNumber !== undefined) {
        createdAt = await blockTimestamp(urls, txRpc.blockNumber);
      }
    }
  }

  const info: ExplorerAddressInfo = {
    verified: typeof row.is_verified === 'boolean' ? row.is_verified : null,
    name: asString(row.name) || null,
    proxy: asString(row.proxy_type) === '' ? null : true,
    isScam: typeof row.is_scam === 'boolean' ? row.is_scam : null,
    creator,
    creationTxHash,
    createdAt,
  };
  cache.set(key, info);
  return info;
}

/* ── History ─────────────────────────────────────────────────────────────── */

export async function fetchTokenTransfers(
  chainId: number,
  address: string,
  pages = 2,
): Promise<ExplorerTokenTransfer[]> {
  const rows = await v2Pages<V2TokenTransfer>(
    chainId,
    `/addresses/${address}/token-transfers`,
    { type: 'ERC-20' },
    pages,
  );

  const out: ExplorerTokenTransfer[] = [];
  for (const row of rows) {
    const contractAddress = asString(row.token?.address_hash).toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(contractAddress)) continue;
    const value = asString(row.total?.value);
    out.push({
      hash: asString(row.transaction_hash),
      from: asString(row.from?.hash).toLowerCase(),
      to: asString(row.to?.hash).toLowerCase(),
      contractAddress,
      tokenName: asString(row.token?.name) || null,
      tokenSymbol: asString(row.token?.symbol) || null,
      tokenDecimal: toNumber(row.token?.decimals ?? row.total?.decimals),
      value: value === '' ? '0' : value,
      timeStamp: toUnixSeconds(row.timestamp),
      blockNumber: toNumber(row.block_number),
    });
  }
  return out;
}

export async function fetchNormalTransactions(
  chainId: number,
  address: string,
  pages = 2,
): Promise<ExplorerTx[]> {
  const [outgoing, incoming] = await Promise.all([
    v2Pages<V2Transaction>(chainId, `/addresses/${address}/transactions`, { filter: 'from' }, pages),
    v2Pages<V2Transaction>(chainId, `/addresses/${address}/transactions`, { filter: 'to' }, pages),
  ]);

  const seen = new Set<string>();
  const out: ExplorerTx[] = [];
  for (const row of [...outgoing, ...incoming]) {
    const hash = asString(row.hash);
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash) || seen.has(hash)) continue;
    seen.add(hash);
    out.push({
      hash,
      from: asString(row.from?.hash).toLowerCase(),
      to: asString(row.to?.hash).toLowerCase(),
      input: asString(row.raw_input) || asString(row.input),
      timeStamp: toUnixSeconds(row.timestamp),
      blockNumber: toNumber(row.block_number),
      // v2 reports "ok" / "error"; anything that is not explicitly ok counts as failed.
      isError: asString(row.status).toLowerCase() !== 'ok',
    });
  }
  out.sort((a, b) => (b.blockNumber ?? 0) - (a.blockNumber ?? 0));
  return out;
}

/* ── Contract facts (derived from the single address lookup) ─────────────── */

export async function fetchContractInfo(
  chainId: number,
  address: string,
): Promise<ExplorerContractInfo> {
  const info = await fetchAddressInfo(chainId, address);
  return {
    verified: info.verified,
    name: info.name,
    proxy: info.proxy,
    isScam: info.isScam,
  };
}

export async function fetchContractCreator(
  chainId: number,
  address: string,
): Promise<string | null> {
  return (await fetchAddressInfo(chainId, address)).creator;
}

/**
 * Age of a contract in days. null means we could not establish it — the risk
 * model treats unknown age as no signal at all rather than a penalty.
 */
export async function fetchContractAgeDays(
  chainId: number,
  address: string,
): Promise<number | null> {
  const info = await fetchAddressInfo(chainId, address);
  if (info.createdAt === null) return null;
  return Math.max(0, Date.now() / 1000 - info.createdAt) / 86_400;
}

/** Transaction lookup via the explorer, used as a fallback when RPC is silent. */
export async function fetchTransactionByHash(
  chainId: number,
  hash: string,
): Promise<{ from: string; to: string | null; blockNumber: number | null; input: string } | null> {
  const base = v2Base(chainId);
  if (!base) return null;
  const row = await getJson<V2Transaction>(`${base}/transactions/${hash}`);
  if (!row) return null;
  const from = asString(row.from?.hash).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(from)) return null;
  const to = asString(row.to?.hash).toLowerCase();
  return {
    from,
    to: /^0x[0-9a-f]{40}$/.test(to) ? to : null,
    blockNumber: toNumber(row.block_number),
    input: asString(row.raw_input) || asString(row.input),
  };
}

export function explorerTxUrl(chainId: number, hash: string): string {
  const base =
    chainId in SUPPORTED_CHAINS
      ? SUPPORTED_CHAINS[chainId as ChainId].blockExplorer
      : 'https://etherscan.io';
  return `${base}/tx/${hash}`;
}

export function explorerTokenUrl(
  chainId: number,
  tokenAddress: string,
  spenderAddress: string,
): string {
  const base =
    chainId in SUPPORTED_CHAINS
      ? SUPPORTED_CHAINS[chainId as ChainId].blockExplorer
      : 'https://etherscan.io';
  return `${base}/token/${tokenAddress}?a=${spenderAddress}`;
}
