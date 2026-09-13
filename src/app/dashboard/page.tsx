'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';

import { ApprovalRow } from '@/components/approval-row';
import { IncidentPanel } from '@/components/incident-panel';
import {
  fetchApprovals,
  fetchIncident,
  mergeWithHistory,
  type HistoryEntry,
} from '@/lib/approvals/client';
import { useRevoke } from '@/lib/hooks/use-revoke';
import {
  NETWORK_NAMES,
  SUPPORTED_CHAINS,
  isSupportedChainId,
  type Approval,
  type Incident,
  type ScanCoverage,
} from '@/types/approval';

const CHAIN_IDS = [11155111, 1, 8453, 42161, 10] as const;
const WALLETS = [
  { name: 'MetaMask', id: 'metamask', url: 'https://metamask.io' },
  { name: 'Coinbase Wallet', id: 'coinbase', url: 'https://www.coinbase.com/wallet' },
  { name: 'Phantom', id: 'phantom', url: 'https://phantom.app' },
];

function chainBadge(chainId: number) {
  return chainId === 11155111
    ? { label: 'Testnet', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
    : { label: 'Mainnet', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
}

/*
 * Deep-link parsing.
 *
 * The query string has to be read during the first render, not in an effect: Next
 * normalises the URL of a static route during hydration and the parameters are gone
 * by the time effects run. Reading it here is a pure read plus a per-page-load cache,
 * so every later render sees the same value and the markup the server sent still
 * matches the markup the client renders.
 */
interface DeepLink {
  address: string;
  chainId: number;
  view: 'approvals' | 'incident';
}

let deepLinkCache: DeepLink | null | undefined;

function deepLinkOnce(): DeepLink | null {
  if (deepLinkCache !== undefined) return deepLinkCache;
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('address')?.trim().toLowerCase() ?? '';
  if (!/^0x[0-9a-f]{40}$/.test(raw)) {
    deepLinkCache = null;
    return deepLinkCache;
  }
  const requested = Number(params.get('chain'));
  deepLinkCache = {
    address: raw,
    chainId: isSupportedChainId(requested) ? requested : 1,
    view: params.get('view') === 'incident' ? 'incident' : 'approvals',
  };
  return deepLinkCache;
}

function Backdrop() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 25%, #0f2847 50%, #0a1628 75%, #050a14 100%)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 800px 600px at 25% 35%, rgba(26,115,232,0.12) 0%, transparent 70%), radial-gradient(ellipse 600px 400px at 75% 65%, rgba(74,158,255,0.08) 0%, transparent 60%)' }} />
    </div>
  );
}

function CoveragePanel({ coverage }: { coverage: ScanCoverage }) {
  return (
    <div className="dash-enter-delay-4" style={{ marginTop: 24, padding: '16px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
      <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
        What this scan actually covered
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px 24px', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        <span>Transactions read: {coverage.transactionsScanned}</span>
        <span>Token transfers read: {coverage.transfersScanned}</span>
        <span>approve() calls decoded: {coverage.approveCallsParsed}</span>
        <span>Approval events decoded: {coverage.approvalLogsParsed}</span>
        <span>Tokens history-scanned: {coverage.tokensScanned}</span>
        <span>Permissions checked on chain: {coverage.pairsChecked}</span>
        <span>Granted then revoked: {coverage.revokedFound}</span>
        {coverage.notGrantedFound ? (
          <span>Candidate pairs never granted: {coverage.notGrantedFound}</span>
        ) : null}
        <span>
          Log window: {coverage.logsWindowBlocks ? `${coverage.logsWindowBlocks.toLocaleString()} blocks` : 'not read'}
          {coverage.logsWindowBlocks && coverage.logsWindowTruncated ? ' (wider ranges rejected as incomplete)' : ''}
        </span>
        <span>Prices: {coverage.priceSource}</span>
      </div>
      <ul style={{ paddingLeft: 18, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {coverage.notes.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
      <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
        Full methodology:{' '}
        <a href="/method" style={{ color: 'var(--blue-light)' }}>
          risk model and limits
        </a>
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors, isPending } = useConnect();
  const { switchChain } = useSwitchChain();
  const revoke = useRevoke();

  const connectedChainId = chain?.id;
  const connectedSupported =
    connectedChainId !== undefined && isSupportedChainId(connectedChainId);
  const connectedAddress = address?.toLowerCase() ?? null;

  /*
   * Read-only mode.
   *
   * A wallet is the right way to *revoke*, but it is a terrible way to *evaluate*
   * a tool: a reviewer with no wallet installed, or one holding nothing, would
   * otherwise see only a connect prompt. Any address can be inspected without
   * connecting; signing is enabled only when the connected account is that same
   * address on that same network.
   */
  const [watchAddress, setWatchAddress] = useState<string | null>(null);
  const [watchInput, setWatchInput] = useState('');
  const [watchError, setWatchError] = useState<string | null>(null);
  const [watchChainId, setWatchChainId] = useState<number>(1);

  const chainId =
    isConnected && connectedSupported
      ? connectedChainId
      : watchAddress !== null
        ? watchChainId
        : undefined;
  const supported = chainId !== undefined && isSupportedChainId(chainId);
  const activeAddress = isConnected && connectedSupported ? connectedAddress : watchAddress;
  const accountKey = activeAddress && supported ? `${activeAddress}:${chainId}` : null;
  /** Signing is offered only for the address the connected wallet actually controls. */
  const canRevoke = Boolean(
    isConnected &&
      connectedAddress !== null &&
      activeAddress !== null &&
      connectedAddress === activeAddress &&
      connectedChainId === chainId &&
      supported,
  );
  const readOnly = activeAddress !== null && !canRevoke;

  const startReadOnly = useCallback((raw: string, network: number) => {
    const candidate = raw.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(candidate)) {
      setWatchError('That does not look like an address. Paste a 0x… address with 40 hex characters.');
      return;
    }
    setWatchError(null);
    setWatchChainId(network);
    setWatchAddress(candidate);
  }, []);

  const stopReadOnly = useCallback(() => {
    setWatchAddress(null);
    setWatchInput('');
    setWatchError(null);
  }, []);

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [coverage, setCoverage] = useState<ScanCoverage | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [tab, setTab] = useState<'approvals' | 'incident'>('approvals');
  const [selected, setSelected] = useState<string[]>([]);
  const [revokedSinceLastScan, setRevokedSinceLastScan] = useState<HistoryEntry[]>([]);
  const [previousScanAt, setPreviousScanAt] = useState<string | null>(null);

  // The incident belongs to an account: storing it with its key means switching
  // accounts cannot show a stale reconstruction, with no reset effect needed.
  const [incidentRun, setIncidentRun] = useState<{ key: string; incident: Incident } | null>(null);
  const [incidentAttempted, setIncidentAttempted] = useState<string | null>(null);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  const incident = incidentRun && incidentRun.key === accountKey ? incidentRun.incident : null;

  /*
   * Deep links.
   *
   * A scan is only useful if it can be handed to someone else, so
   * /dashboard?address=0x…&chain=11155111&view=incident opens straight onto the
   * reconstruction with the scan already running. This is how the project is meant
   * to be shared: one click from the README, from a submission page, or from a
   * message to whoever needs to see it. Nothing else about the URL is read, and a
   * malformed link falls back to the normal empty state rather than an error.
   */
  const deepLink = deepLinkOnce();

  useEffect(() => {
    if (!deepLink) return;
    const timer = setTimeout(() => {
      setWatchInput(deepLink.address);
      startReadOnly(deepLink.address, deepLink.chainId);
      if (deepLink.view === 'incident') setTab('incident');
    }, 0);
    return () => clearTimeout(timer);
  }, [deepLink, startReadOnly]);

  /*
   * Keep the URL in step with what is on screen, so any view can be shared.
   *
   * The first run is skipped on purpose: on mount the incoming link is the source of
   * truth, and rewriting it before applyDeepLink has settled would strip the address
   * out of a URL that was just pasted in.
   */
  const urlReady = useRef(false);
  useEffect(() => {
    if (!urlReady.current) {
      urlReady.current = true;
      return;
    }
    const params = new URLSearchParams();
    if (activeAddress) {
      params.set('address', activeAddress);
      if (chainId !== undefined) params.set('chain', String(chainId));
      if (tab === 'incident') params.set('view', 'incident');
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
  }, [activeAddress, chainId, tab]);

  const loadApprovals = useCallback(async (wallet: string, network: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchApprovals(wallet, network);
      const merged = mergeWithHistory(wallet, network, result.approvals);
      setApprovals(merged.approvals);
      setCoverage(result.coverage);
      setDegraded(result.degraded);
      setRevokedSinceLastScan(merged.revokedSinceLastScan);
      setPreviousScanAt(merged.previousScanAt);
      setSelected([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to scan approvals.');
    } finally {
      setLoading(false);
    }
  }, []);

  const runIncident = useCallback(async (wallet: string, network: number) => {
    const key = `${wallet.toLowerCase()}:${network}`;
    setIncidentAttempted(key);
    setIncidentLoading(true);
    setIncidentError(null);
    try {
      const result = await fetchIncident(wallet, network);
      setIncidentRun({ key, incident: result });
    } catch (cause) {
      setIncidentError(
        cause instanceof Error ? cause.message : 'Failed to reconstruct the incident.',
      );
    } finally {
      setIncidentLoading(false);
    }
  }, []);

  /**
   * Scan whenever the connected account or network changes.
   *
   * The work is deferred to a task rather than started synchronously inside the
   * effect: a scan resolves into several pieces of state at once, and React's
   * rules discourage kicking that off during the effect flush.
   */
  useEffect(() => {
    if (!activeAddress || !supported || chainId === undefined) return;
    const timer = setTimeout(() => {
      void loadApprovals(activeAddress, chainId);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeAddress, supported, chainId, loadApprovals]);

  /** Reconstruct once per account, the first time the incident tab is opened. */
  useEffect(() => {
    if (tab !== 'incident') return;
    if (!activeAddress || chainId === undefined || !supported) return;
    if (incidentAttempted === accountKey || incidentLoading) return;
    const timer = setTimeout(() => {
      void runIncident(activeAddress, chainId);
    }, 0);
    return () => clearTimeout(timer);
  }, [tab, activeAddress, chainId, supported, accountKey, incidentAttempted, incidentLoading, runIncident]);

  const refreshAfterRevoke = useCallback(
    (wallet: string, network: number) => {
      setTimeout(() => {
        void loadApprovals(wallet, network);
        void runIncident(wallet, network);
      }, 900);
    },
    [loadApprovals, runIncident],
  );

  const handleConnect = useCallback(
    (walletId: string) => {
      setConnectError(null);
      try {
        const connector =
          walletId === 'phantom'
            ? connectors.find((entry) => entry.name === 'Phantom' || entry.id === 'injected.phantom')
            : connectors.find((entry) => entry.name.toLowerCase().includes(walletId));
        if (connector) {
          connect(
            { connector },
            { onError: (err) => setConnectError(`Failed to connect: ${err.message}`) },
          );
        } else {
          const wallet = WALLETS.find((entry) => entry.id === walletId);
          setConnectError(
            `${wallet?.name ?? walletId} is not installed. Visit ${wallet?.url ?? ''}`,
          );
        }
      } catch (cause) {
        setConnectError(cause instanceof Error ? cause.message : 'Connection failed');
      }
    },
    [connect, connectors],
  );

  const stats = useMemo(() => {
    const total = approvals.length;
    const risky = approvals.filter((approval) => approval.riskScore >= 50).length;
    const critical = approvals.filter((approval) => approval.riskScore >= 70).length;
    const valueAtRisk = approvals
      .filter((approval) => approval.riskScore >= 50)
      .reduce((sum, approval) => sum + approval.valueAtRiskUsd, 0);
    const healthScore = total === 0 ? 100 : Math.round(((total - risky) / total) * 100);
    return { total, risky, critical, valueAtRisk, healthScore };
  }, [approvals]);

  const filtered = useMemo(
    () =>
      approvals.filter((approval) => {
        const haystack = [
          approval.token.name,
          approval.token.symbol,
          approval.spenderAddress,
          approval.spenderLabel ?? '',
        ];
        const matchesSearch = haystack.some((value) =>
          value.toLowerCase().includes(search.trim().toLowerCase()),
        );
        if (!matchesSearch) return false;
        if (filter === 'all') return true;
        if (filter === 'critical') return approval.riskScore >= 70;
        if (filter === 'high') return approval.riskScore >= 50 && approval.riskScore < 70;
        if (filter === 'medium') return approval.riskScore >= 30 && approval.riskScore < 50;
        return approval.riskScore < 30;
      }),
    [approvals, search, filter],
  );

  const selectedApprovals = filtered.filter((approval) => selected.includes(approval.id));
  const batchRunning = revoke.batch !== null && revoke.batch.done < revoke.batch.total;

  const onRevoke = useCallback(
    async (approval: Approval) => {
      if (!canRevoke) return;
      await revoke.revoke({
        id: approval.id,
        tokenAddress: approval.token.address,
        spenderAddress: approval.spenderAddress,
        chainId: approval.chainId,
        owner: approval.walletAddress,
      });
      if (activeAddress && chainId !== undefined) refreshAfterRevoke(activeAddress, chainId);
    },
    [revoke, canRevoke, activeAddress, chainId, refreshAfterRevoke],
  );

  const onRevokeSelected = useCallback(async () => {
    if (!canRevoke) return;
    await revoke.revokeMany(
      selectedApprovals.map((approval) => ({
        id: approval.id,
        tokenAddress: approval.token.address,
        spenderAddress: approval.spenderAddress,
        chainId: approval.chainId,
        owner: approval.walletAddress,
      })),
    );
    if (activeAddress && chainId !== undefined) refreshAfterRevoke(activeAddress, chainId);
  }, [revoke, canRevoke, selectedApprovals, activeAddress, chainId, refreshAfterRevoke]);

  const onRevokeFamily = useCallback(async () => {
    if (!incident || !canRevoke) return;
    const targets = incident.familyApprovals
      .filter((approval) => revoke.statuses[approval.id] !== 'confirmed')
      .map((approval) => ({
        id: approval.id,
        tokenAddress: approval.token.address,
        spenderAddress: approval.spenderAddress,
        chainId: approval.chainId,
        owner: approval.walletAddress,
      }));
    await revoke.revokeMany(targets);
    if (activeAddress && chainId !== undefined) refreshAfterRevoke(activeAddress, chainId);
  }, [incident, revoke, canRevoke, activeAddress, chainId, refreshAfterRevoke]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }, []);

  /* ── Nothing to inspect yet ── */
  if (!activeAddress) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <Backdrop />
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: 32, textAlign: 'center' }}>
          <img src="/logo.png" alt="Anchrion" style={{ width: 56, height: 56, borderRadius: 14 }} />
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 400, marginBottom: 10 }}>
              See how a drain happened
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 470, lineHeight: 1.6 }}>
              Paste any address to see the permission that took the funds — and what is still
              reachable.
            </p>
          </div>
          {connectError && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 13, maxWidth: 400, width: '100%' }}>
              {connectError}
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startReadOnly(watchInput, watchChainId);
            }}
            style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 470, flexWrap: 'wrap' }}
          >
            <input
              type="text"
              value={watchInput}
              onChange={(event) => setWatchInput(event.target.value)}
              placeholder="0x… any wallet or smart account"
              spellCheck={false}
              style={{ flex: 1, minWidth: 220, padding: '12px 16px', borderRadius: 10, fontSize: 14, fontFamily: 'monospace', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)', outline: 'none' }}
            />
            <select
              value={watchChainId}
              onChange={(event) => setWatchChainId(Number(event.target.value))}
              aria-label="Network to inspect"
              style={{ padding: '12px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)', outline: 'none' }}
            >
              {CHAIN_IDS.map((id) => (
                <option key={id} value={id} style={{ background: '#0d1f3c' }}>
                  {SUPPORTED_CHAINS[id].name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              style={{ padding: '12px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'white', background: 'var(--blue)', border: 'none', cursor: 'pointer' }}
            >
              Inspect
            </button>
          </form>
          {watchError && (
            <p style={{ fontSize: 13, color: '#fca5a5', maxWidth: 470 }}>{watchError}</p>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 470, lineHeight: 1.6 }}>
            Read-only. Anchrion cannot sign anything — revoking needs the wallet that owns the
            address.
          </p>

          <div style={{ width: '100%', maxWidth: 470, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-tertiary)', fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            or connect a wallet to revoke
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
            {WALLETS.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => handleConnect(wallet.id)}
                disabled={isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: isPending ? 'wait' : 'pointer', textAlign: 'left' }}
              >
                {wallet.name}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {isPending ? 'Connecting…' : '→'}
                </span>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 430, lineHeight: 1.6 }}>
            No wallet? Install{' '}
            <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)' }}>
              MetaMask
            </a>{' '}
            and get free Sepolia test ETH from the{' '}
            <a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)' }}>
              Google Cloud faucet
            </a>{' '}
            to run the full flow without risking funds.
          </p>
          <a href="/" style={{ marginTop: 8, fontSize: 13, color: 'var(--text-tertiary)' }}>
            ← Back to home
          </a>
        </div>
      </div>
    );
  }

  /* ── Unsupported network (only meaningful for a connected wallet) ── */
  if (isConnected && chain && !isSupportedChainId(chain.id)) {
    return (
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <Backdrop />
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>!</div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px,3vw,28px)', fontWeight: 400, marginBottom: 10 }}>
              Unsupported network
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 420, lineHeight: 1.6 }}>
              You are connected to <strong style={{ color: 'var(--text)' }}>{chain.name}</strong>. Anchrion
              reads approvals on the networks below.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
            {CHAIN_IDS.map((id) => {
              const config = SUPPORTED_CHAINS[id];
              const badge = chainBadge(id);
              return (
                <button
                  key={id}
                  onClick={() => switchChain({ chainId: id })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
                >
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                  {config.name}
                </button>
              );
            })}
          </div>
          <button onClick={() => disconnect()} style={{ marginTop: 8, fontSize: 13, color: 'var(--text-tertiary)', background: 'none' }}>
            Disconnect and try again
          </button>
        </div>
      </div>
    );
  }

  const badge = chainId !== undefined ? chainBadge(chainId) : null;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', position: 'relative' }}>
      <Backdrop />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 56, display: 'flex', alignItems: 'center', padding: '0 clamp(20px,4vw,48px)', justifyContent: 'space-between', backdropFilter: 'blur(40px) saturate(1.4)', WebkitBackdropFilter: 'blur(40px) saturate(1.4)', background: 'rgba(8,9,13,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="Anchrion" style={{ width: 28, height: 28, borderRadius: 7 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400 }}>Anchrion</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {chainId !== undefined && badge &&
              (readOnly ? (
                <select
                  value={chainId}
                  onChange={(event) => setWatchChainId(Number(event.target.value))}
                  aria-label="Network to inspect"
                  style={{ padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`, outline: 'none' }}
                >
                  {CHAIN_IDS.map((id) => (
                    <option key={id} value={id} style={{ background: '#0d1f3c' }}>
                      {SUPPORTED_CHAINS[id].name}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => switchChain({ chainId: chainId === 11155111 ? 1 : 11155111 })}
                  title="Switch between Sepolia and Ethereum mainnet"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`, cursor: 'pointer' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.color }} />
                  {NETWORK_NAMES[chainId] ?? chain?.name}
                </button>
              ))}
            <button
              onClick={() => activeAddress && chainId !== undefined && void loadApprovals(activeAddress, chainId)}
              disabled={loading}
              style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? 'Scanning…' : 'Rescan'}
            </button>
            <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 13, fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {activeAddress.slice(0, 6)}…{activeAddress.slice(-4)}
            </span>
            {readOnly ? (
              <button
                onClick={stopReadOnly}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 8, fontSize: 13, color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.08)', cursor: 'pointer' }}
              >
                Read-only · connect wallet
              </button>
            ) : (
              <button onClick={() => disconnect()} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent' }}>
                Disconnect
              </button>
            )}
          </div>
        </header>

        <main style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(24px,4vh,40px) clamp(20px,4vw,48px)' }}>
          {readOnly && (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: 'rgba(26,115,232,0.08)', border: '1px solid rgba(26,115,232,0.2)', fontSize: 13, color: 'var(--blue-light)', lineHeight: 1.55 }}>
              <strong>Read-only view.</strong> Showing public chain data for{' '}
              <span style={{ fontFamily: 'monospace' }}>{activeAddress}</span> on{' '}
              {NETWORK_NAMES[chainId ?? 1]}. Every finding below is measured the same way it would be for
              your own wallet. Revoking needs the wallet that owns this address —{' '}
              <button
                onClick={() => {
                  stopReadOnly();
                  setConnectError(null);
                }}
                style={{ color: 'var(--blue-light)', textDecoration: 'underline', background: 'none', padding: 0, fontSize: 13, cursor: 'pointer' }}
              >
                connect a wallet
              </button>
              .
            </div>
          )}

          {chainId === 11155111 && (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 13, color: '#fbbf24', lineHeight: 1.5 }}>
              <strong>Sepolia testnet</strong> — grant a permission on a test dApp, then revoke it here. No
              real funds at risk.
            </div>
          )}

          <div className="dash-enter" style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--blue-light)', marginBottom: 8 }}>
              Dashboard
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 400, lineHeight: 1.2 }}>
              {tab === 'incident' ? (
                <>
                  Incident <span style={{ color: 'var(--blue-light)' }}>reconstruction</span>
                </>
              ) : (
                <>
                  Wallet <span style={{ color: 'var(--blue-light)' }}>permissions</span>
                </>
              )}
            </h1>
            <p style={{ marginTop: 8, fontSize: 13, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
              {activeAddress}
            </p>
          </div>

          <div className="dash-enter-delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Live permissions', value: String(stats.total) },
              { label: 'Risky (≥50)', value: String(stats.risky), color: 'var(--risk-high)' },
              { label: 'Value at risk', value: `$${stats.valueAtRisk.toLocaleString()}`, color: 'var(--risk-medium)' },
              { label: 'Health score', value: `${stats.healthScore}%`, color: stats.healthScore >= 70 ? 'var(--risk-safe)' : 'var(--risk-high)' },
            ].map((item) => (
              <div key={item.label} style={{ padding: '18px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                  {item.label}
                </p>
                <p style={{ fontSize: 24, fontWeight: 600, color: item.color ?? 'var(--text)' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {(revokedSinceLastScan.length > 0 || degraded) && (
            <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {revokedSinceLastScan.length > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 13, color: '#86efac' }}>
                  {revokedSinceLastScan.length} permission{revokedSinceLastScan.length === 1 ? '' : 's'} gone
                  since your last scan{previousScanAt ? ` (${new Date(previousScanAt).toLocaleString()})` : ''}:{' '}
                  {revokedSinceLastScan
                    .slice(0, 4)
                    .map((entry) => `${entry.tokenSymbol} → ${entry.spenderLabel ?? entry.spenderAddress.slice(0, 10)}`)
                    .join(', ')}
                  {revokedSinceLastScan.length > 4 ? '…' : ''}
                </div>
              )}
              {degraded && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 13, color: '#fbbf24' }}>
                  Partial scan: no block-explorer history was available for this address, so findings come
                  from live allowance reads against a bundled spender list only. Treat the results as
                  incomplete and read the coverage panel below.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['approvals', 'incident'] as const).map((entry) => (
              <button
                key={entry}
                onClick={() => setTab(entry)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  background: tab === entry ? 'var(--blue)' : 'rgba(255,255,255,0.03)',
                  color: tab === entry ? 'white' : 'var(--text-secondary)',
                  border: tab === entry ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {entry === 'approvals' ? 'Approvals' : 'Incident reconstruction'}
              </button>
            ))}
          </div>

          {tab === 'approvals' ? (
            <>
              <div className="dash-enter-delay-2" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search by token or spender…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  style={{ flex: 1, minWidth: 200, padding: '11px 16px', borderRadius: 8, fontSize: 14, outline: 'none', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)' }}
                />
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map((entry) => (
                  <button
                    key={entry}
                    onClick={() => setFilter(entry)}
                    style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, ...(filter === entry ? { background: 'var(--blue)', color: 'white' } : { background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.06)' }) }}
                  >
                    {entry.charAt(0).toUpperCase() + entry.slice(1)}
                  </button>
                ))}
              </div>

              {selected.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(26,115,232,0.08)', border: '1px solid rgba(26,115,232,0.2)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selected.length} selected</span>
                  <button
                    onClick={() => void onRevokeSelected()}
                    disabled={batchRunning || !canRevoke}
                    title={canRevoke ? undefined : 'Connect the wallet that owns this address to revoke'}
                    style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', background: 'var(--risk-critical)', border: 'none', opacity: canRevoke ? 1 : 0.5, cursor: batchRunning ? 'wait' : canRevoke ? 'pointer' : 'not-allowed' }}
                  >
                    {revoke.batch && batchRunning ? `Revoking ${revoke.batch.done + 1} of ${revoke.batch.total}…` : 'Revoke selected'}
                  </button>
                  <button
                    onClick={() => setSelected([])}
                    style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="dash-enter-delay-3">
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[1, 2, 3, 4].map((row) => (
                      <div key={row} style={{ height: 64, borderRadius: 10, background: 'rgba(255,255,255,0.02)', animation: 'pulse 2s infinite' }} />
                    ))}
                  </div>
                ) : error ? (
                  <div style={{ textAlign: 'center', padding: '64px 0' }}>
                    <p style={{ marginBottom: 16, color: 'var(--risk-critical)' }}>{error}</p>
                    <button
                      onClick={() => activeAddress && chainId !== undefined && void loadApprovals(activeAddress, chainId)}
                      style={{ padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'white', background: 'var(--blue)', border: 'none' }}
                    >
                      Try again
                    </button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: 16, marginBottom: 12, color: 'var(--text)' }}>
                      {approvals.length === 0 ? 'No live permissions found' : 'Nothing matches this filter'}
                    </p>
                    <p style={{ fontSize: 14, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
                      {approvals.length === 0
                        ? coverage && coverage.revokedFound > 0
                          ? `Nothing is live right now. ${coverage.revokedFound} permission(s) this address granted have been revoked, and ${coverage.pairsChecked} candidate permissions were read on chain. The coverage panel below names exactly what was inspected and what could not be.`
                          : 'Permissions appear here once this address approves a token to a contract. If you expected to see something, read the coverage panel below — it names what the scan could not see.'
                        : 'Try clearing the search or switching back to the All filter.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtered.map((approval) => (
                      <ApprovalRow
                        key={approval.id}
                        approval={approval}
                        status={revoke.statuses[approval.id] ?? 'idle'}
                        txHash={revoke.hashes[approval.id]}
                        error={revoke.errors[approval.id]}
                        selected={selected.includes(approval.id)}
                        canRevoke={canRevoke}
                        onToggleSelect={toggleSelect}
                        onRevoke={(entry) => void onRevoke(entry)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {coverage && <CoveragePanel coverage={coverage} />}
            </>
          ) : (
            <div className="dash-enter">
              {incident ? (
                <IncidentPanel
                  incident={incident}
                  loading={incidentLoading}
                  error={incidentError}
                  onRun={() => activeAddress && chainId !== undefined && void runIncident(activeAddress, chainId)}
                  onRevoke={(approval) => void onRevoke(approval)}
                  statuses={revoke.statuses}
                  hashes={revoke.hashes}
                  canRevoke={canRevoke}
                  onRevokeFamily={() => void onRevokeFamily()}
                  batch={revoke.batch}
                />
              ) : (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: 16, color: 'var(--text)', marginBottom: 10 }}>
                    {incidentLoading ? 'Reconstructing…' : 'Nothing reconstructed yet'}
                  </p>
                  <p style={{ fontSize: 14, maxWidth: 470, margin: '0 auto 18px', lineHeight: 1.6 }}>
                    {incidentError ??
                      'Anchrion will look for token transfers out of this wallet inside transactions you did not send, then trace them back to the permission that made them possible.'}
                  </p>
                  <button
                    onClick={() => activeAddress && chainId !== undefined && void runIncident(activeAddress, chainId)}
                    style={{ padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'white', background: 'var(--blue)', border: 'none' }}
                  >
                    Run reconstruction
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        <footer style={{ backdropFilter: 'blur(40px) saturate(1.4)', background: 'rgba(8,9,13,0.75)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: 'clamp(24px,3vh,32px) clamp(20px,4vw,48px)' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo.png" alt="Anchrion" style={{ width: 22, height: 22, borderRadius: 5 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>© 2026 Anchrion</span>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                GitHub
              </a>
              <a href="/method" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Risk model
              </a>
              <a href="/" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Home
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
