/**
 * Browser-side data client.
 *
 * Approval records already carry server-computed risk, so nothing is rescored
 * here. The only thing this module does on top of fetching is keep a local
 * history of what Anchrion itself has observed, which is what makes "revoked
 * since your last scan" possible without a database.
 */

import type { Approval, Incident, ScanCoverage } from '@/types/approval';

export interface ScanResponse {
  approvals: Approval[];
  coverage: ScanCoverage;
  degraded: boolean;
}

export async function fetchApprovals(
  walletAddress: string,
  chainId: number,
): Promise<ScanResponse> {
  const response = await fetch('/api/approvals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, chainId }),
  });
  const data = (await response.json()) as Partial<ScanResponse> & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'Failed to scan approvals.');
  return {
    approvals: data.approvals ?? [],
    coverage: data.coverage as ScanCoverage,
    degraded: Boolean(data.degraded),
  };
}

export async function fetchIncident(
  walletAddress: string,
  chainId: number,
  txHash?: string,
): Promise<Incident> {
  const response = await fetch('/api/incident', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, chainId, txHash }),
  });
  const data = (await response.json()) as { incident?: Incident; error?: string };
  if (!response.ok || !data.incident) {
    throw new Error(data.error ?? 'Failed to reconstruct the incident.');
  }
  return data.incident;
}

/* ── Local observation history ───────────────────────────────────────────── */

export interface HistoryEntry {
  id: string;
  tokenSymbol: string;
  spenderAddress: string;
  spenderLabel: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Set once Anchrion observes the permission is gone. */
  goneAt?: string;
}

export interface LocalHistory {
  walletAddress: string;
  chainId: number;
  scans: string[];
  entries: HistoryEntry[];
}

const HISTORY_KEY = 'anchrion.history.v1';
const MAX_SCANS_REMEMBERED = 20;

function key(walletAddress: string, chainId: number): string {
  return `${chainId}:${walletAddress.toLowerCase()}`;
}

function readAll(): Record<string, LocalHistory> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LocalHistory>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, LocalHistory>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: history is a convenience, never a requirement */
  }
}

export interface HistoryMerge {
  approvals: Approval[];
  /** Permissions that were present at the previous scan and are gone now. */
  revokedSinceLastScan: HistoryEntry[];
  /** ISO timestamp of the previous scan, if any. */
  previousScanAt: string | null;
  scanCount: number;
}

export function mergeWithHistory(
  walletAddress: string,
  chainId: number,
  approvals: Approval[],
): HistoryMerge {
  const all = readAll();
  const entryKey = key(walletAddress, chainId);
  const previous = all[entryKey];
  const now = new Date().toISOString();

  const seen = new Set(approvals.map((approval) => approval.id));
  const entries: HistoryEntry[] = [];

  for (const approval of approvals) {
    const prior = previous?.entries.find((entry) => entry.id === approval.id && !entry.goneAt);
    entries.push({
      id: approval.id,
      tokenSymbol: approval.token.symbol,
      spenderAddress: approval.spenderAddress,
      spenderLabel: approval.spenderLabel,
      firstSeenAt: prior?.firstSeenAt ?? now,
      lastSeenAt: now,
    });
  }

  const revokedSinceLastScan: HistoryEntry[] = [];
  for (const prior of previous?.entries ?? []) {
    if (prior.goneAt) continue;
    if (seen.has(prior.id)) continue;
    const vanished = { ...prior, goneAt: now };
    revokedSinceLastScan.push(vanished);
    entries.push(vanished);
  }
  // Keep already-gone entries from earlier scans so the record stays honest.
  for (const prior of previous?.entries ?? []) {
    if (!prior.goneAt) continue;
    if (entries.some((entry) => entry.id === prior.id)) continue;
    entries.push(prior);
  }

  const scans = [...(previous?.scans ?? []), now].slice(-MAX_SCANS_REMEMBERED);
  all[entryKey] = { walletAddress, chainId, scans, entries };
  writeAll(all);

  const withHistory = approvals.map((approval) => ({
    ...approval,
    firstSeenByAnchrion:
      entries.find((entry) => entry.id === approval.id)?.firstSeenAt ?? null,
  }));

  return {
    approvals: withHistory,
    revokedSinceLastScan,
    previousScanAt: previous?.scans.at(-1) ?? null,
    scanCount: scans.length,
  };
}

export function clearHistory(walletAddress: string, chainId: number): void {
  const all = readAll();
  delete all[key(walletAddress, chainId)];
  writeAll(all);
}
