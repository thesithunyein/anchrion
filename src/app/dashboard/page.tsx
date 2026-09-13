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
  { name: 'MetaMask', id: 'metamask', icon: '/metamask.png', url: 'https://metamask.io' },
  {
    name: 'Coinbase Wallet',
    id: 'coinbase',
    icon: '/coinbase.png',
    url: 'https://www.coinbase.com/wallet',
  },
  { name: 'Phantom', id: 'phantom', icon: '/phantom.png', url: 'https://phantom.app' },
];

const FILTER_LABELS: Record<'all' | 'critical' | 'high' | 'medium' | 'low', string> = {
  all: 'All',
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  /** The bucket is everything under 30, which is the Low band and the Safe band. */
  low: 'Low or safe',
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function chainBadge(chainId: number) {
  return chainId === 11155111
    ? { label: 'Testnet', color: '#b45309', bg: '#fdf3e3' }
    : { label: 'Mainnet', color: '#15803d', bg: '#e9f8ef' };
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

/*
 * The page canvas. The graph paper is painted once for the whole app by
 * body::before in globals.css, so this adds only the soft wash that keeps a tall
 * page from reading as flat grey — an indigo bloom top-left, a gold one
 * bottom-right, both far too faint to compete with the content.
 */
function Backdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background:
          'radial-gradient(ellipse 900px 620px at 22% 10%, rgba(60,86,240,0.06) 0%, transparent 68%), radial-gradient(ellipse 700px 480px at 84% 80%, rgba(245,166,35,0.05) 0%, transparent 62%)',
      }}
    />
  );
}

function CoveragePanel({ coverage }: { coverage: ScanCoverage }) {
  return (
    <div className="dash-enter-delay-4" style={{ marginTop: 24, padding: '16px 18px', borderRadius: 18, background: 'var(--card)', border: '1px dashed var(--line-strong)', boxShadow: 'var(--sh-card)' }}>
      <h4 className="kicker" style={{ marginBottom: 10 }}>
        What this scan actually covered
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px 24px', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        <span>Transactions read: {coverage.transactionsScanned}</span>
        <span>Token transfers read: {coverage.transfersScanned}</span>
        <span>approve() calls decoded: {coverage.approveCallsParsed}</span>
        <span>Approval events decoded: {coverage.approvalLogsParsed}</span>
        <span>Tokens history-scanned: {coverage.tokensScanned}</span>
        <span>Allowance pairs read on chain: {coverage.pairsChecked}</span>
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

  /*
   * Connecting silently changes which address is being scanned: the header changes
   * and a button becomes clickable, but the list a person was already reading stays
   * where it was. That is invisible enough that it reads as "nothing happened". So
   * the transition is stated once, in the slot the read-only banner occupies, and
   * only for a connection made while this page was open.
   */
  const [connectionNotice, setConnectionNotice] = useState<{
    address: string;
    replaced: string | null;
  } | null>(null);
  const previousConnected = useRef<string | null>(null);
  const firstConnectionCheck = useRef(true);
  useEffect(() => {
    const current = isConnected && connectedSupported ? connectedAddress : null;
    const before = previousConnected.current;
    previousConnected.current = current;
    if (firstConnectionCheck.current) {
      firstConnectionCheck.current = false;
      return;
    }
    if (current === null || before !== null) return;
    const replaced = watchAddress && watchAddress !== current ? watchAddress : null;
    setConnectionNotice({ address: current, replaced });
  }, [isConnected, connectedSupported, connectedAddress, watchAddress]);

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
    const unlimited = approvals.filter((approval) => approval.isUnlimited).length;
    /*
     * Capped permissions only, and only where a figure was actually measured. An
     * unlimited permission has no cap to price, and its short-term reach is the
     * wallet's balance — counting that here would put a number on the card that the
     * hint underneath does not describe.
     */
    const valueAtRisk = approvals
      .filter(
        (approval) =>
          approval.riskScore >= 50 && !approval.isUnlimited && approval.valueAtRiskUsd !== null,
      )
      .reduce((sum, approval) => sum + (approval.valueAtRiskUsd ?? 0), 0);
    const healthScore = total === 0 ? 100 : Math.round(((total - risky) / total) * 100);
    /*
     * Band counts for the distribution strip. They are derived from the same score
     * the filters and the published model use, so the strip and the list below it
     * cannot disagree.
     */
    const bands = {
      critical: approvals.filter((approval) => approval.riskScore >= 70).length,
      high: approvals.filter(
        (approval) => approval.riskScore >= 50 && approval.riskScore < 70,
      ).length,
      medium: approvals.filter(
        (approval) => approval.riskScore >= 30 && approval.riskScore < 50,
      ).length,
      low: approvals.filter((approval) => approval.riskScore < 30).length,
    };
    return { total, risky, critical, unlimited, valueAtRisk, healthScore, bands };
  }, [approvals]);

  /*
   * The value-at-risk figure has two limits of its own and a card has no room to
   * hide them: it prices capped permissions only, because an unlimited permission
   * has no dollar cap, and it counts only permissions scoring 50 or more.
   */
  const valueAtRiskHint =
    stats.total === 0
      ? 'nothing measured yet'
      : stats.unlimited > 0
        ? stats.valueAtRisk > 0
          ? `capped permissions scoring 50+ · plus ${stats.unlimited} unlimited`
          : `${stats.unlimited} unlimited permission${stats.unlimited === 1 ? '' : 's'} — no cap to price`
        : 'capped permissions scoring 50 or more';

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
          <img src="/logo.svg" alt="Anchrion" style={{ width: 56, height: 56 }} />
          <div>
            <h1 className="display" style={{ fontSize: 'clamp(24px,3vw,32px)', marginBottom: 10 }}>
              See how a drain happened
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 470, lineHeight: 1.6 }}>
              Paste any address to see the permission that took the funds — and what is still
              reachable.
            </p>
          </div>
          {connectError && (
            <div style={{ padding: '12px 16px', borderRadius: 18, background: '#fdecec', border: '1px solid #f4c9c9', color: '#b91c1c', fontSize: 13, maxWidth: 400, width: '100%' }}>
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
              className="field"
              style={{ flex: 1, minWidth: 220, padding: '12px 16px', borderRadius: 12, fontSize: 14, fontFamily: 'var(--font-mono)' }}
            />
            <select
              value={watchChainId}
              onChange={(event) => setWatchChainId(Number(event.target.value))}
              aria-label="Network to inspect"
              className="field"
              style={{ padding: '12px 14px', borderRadius: 12, fontSize: 13, color: 'var(--text-secondary)' }}
            >
              {CHAIN_IDS.map((id) => (
                <option key={id} value={id} style={{ background: '#fff' }}>
                  {SUPPORTED_CHAINS[id].name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '12px 22px' }}
            >
              Inspect
            </button>
          </form>
          {watchError && (
            <p style={{ fontSize: 13, color: '#b91c1c', maxWidth: 470 }}>{watchError}</p>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 470, lineHeight: 1.6 }}>
            Read-only. Anchrion cannot sign anything — revoking needs the wallet that owns the
            address.
          </p>

          <div style={{ width: '100%', maxWidth: 470, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-tertiary)', fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            or connect a wallet to revoke
            <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
            {WALLETS.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => handleConnect(wallet.id)}
                disabled={isPending}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 18, background: '#fff', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: isPending ? 'wait' : 'pointer', textAlign: 'left' }}
              >
                <img
                  src={wallet.icon}
                  alt=""
                  width={24}
                  height={24}
                  style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
                />
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
          <div style={{ width: 56, height: 56, borderRadius: 18, background: '#fdf3e3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>!</div>
          <div>
            <h1 className="display" style={{ fontSize: 'clamp(22px,3vw,28px)', marginBottom: 10 }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 18, background: '#fff', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
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
    /* No background of its own: the paper and its graph grid come from the document,
       so an opaque layer here would hide the grid the landing page is built on. */
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <Backdrop />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header className="dash-header" style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 clamp(20px,4vw,48px)', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.svg" alt="Anchrion" style={{ width: 28, height: 28, display: 'block' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400 }}>Anchrion</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {chainId !== undefined && badge &&
              (readOnly ? (
                <select
                  value={chainId}
                  onChange={(event) => setWatchChainId(Number(event.target.value))}
                  aria-label="Network to inspect"
                  style={{ padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`, outline: 'none' }}
                >
                  {CHAIN_IDS.map((id) => (
                    <option key={id} value={id} style={{ background: '#fff' }}>
                      {SUPPORTED_CHAINS[id].name}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => switchChain({ chainId: chainId === 11155111 ? 1 : 11155111 })}
                  title="Switch between Sepolia and Ethereum mainnet"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`, cursor: 'pointer' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.color }} />
                  {NETWORK_NAMES[chainId] ?? chain?.name}
                </button>
              ))}
            <button
              onClick={() => activeAddress && chainId !== undefined && void loadApprovals(activeAddress, chainId)}
              disabled={loading}
              style={{ padding: '7px 14px', borderRadius: 999, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid var(--line)', background: 'transparent', cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? 'Scanning…' : 'Rescan'}
            </button>
            <span style={{ padding: '5px 14px', borderRadius: 999, fontSize: 13, fontFamily: 'var(--font-mono)', background: '#fff', border: '1px solid var(--line)' }}>
              {shortAddress(activeAddress)}
            </span>
            {readOnly ? (
              <button
                onClick={stopReadOnly}
                title="Connect the wallet that owns this address to revoke"
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 999, fontSize: 13, color: '#b45309', border: '1px solid #f0dcb8', background: '#fdf3e3', cursor: 'pointer' }}
              >
                Connect wallet
              </button>
            ) : (
              <button onClick={() => disconnect()} style={{ padding: '7px 16px', borderRadius: 999, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid var(--line)', background: 'transparent' }}>
                Disconnect
              </button>
            )}
          </div>
        </header>

        <main style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(24px,4vh,40px) clamp(20px,4vw,48px)' }}>
          {readOnly && (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 18, background: 'var(--indigo-wash)', border: '1px solid #cdd6fb', fontSize: 13, color: 'var(--blue-light)', lineHeight: 1.55 }}>
              <strong>Read-only view.</strong> Showing public chain data for{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>{activeAddress}</span> on{' '}
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

          {!readOnly && connectionNotice && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, padding: '12px 16px', borderRadius: 18, background: '#e9f8ef', border: '1px solid #bfe6cd', fontSize: 13, color: '#15803d', lineHeight: 1.55 }}>
              <span>
                <strong>Connected.</strong>{' '}
                {connectionNotice.replaced ? (
                  <>
                    Switched from{' '}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {shortAddress(connectionNotice.replaced)}
                    </span>{' '}
                    to your connected wallet.{' '}
                  </>
                ) : null}
                Scanning <span style={{ fontFamily: 'var(--font-mono)' }}>{connectionNotice.address}</span> on{' '}
                {NETWORK_NAMES[chainId ?? 1]}. Revoking is enabled for this address.
              </span>
              <button
                onClick={() => setConnectionNotice(null)}
                aria-label="Dismiss"
                style={{ background: 'none', border: 'none', color: '#15803d', fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: 0 }}
              >
                ×
              </button>
            </div>
          )}

          {chainId === 11155111 && (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 18, background: '#fdf3e3', border: '1px solid #f0dcb8', fontSize: 13, color: '#b45309', lineHeight: 1.5 }}>
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
            <p style={{ marginTop: 8, fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              {activeAddress}
            </p>
          </div>

          <div className="dash-enter-delay-1 stat-grid" style={{ marginBottom: 24 }}>
            {[
              {
                label: 'Live permissions',
                value: String(stats.total),
                hint: stats.total === 0 ? 'nothing live to revoke' : undefined,
              },
              {
                label: 'Risky (≥50)',
                value: String(stats.risky),
                color: 'var(--risk-high)',
                hint:
                  stats.critical > 0
                    ? `${stats.critical} critical`
                    : stats.total === 0
                      ? 'nothing measured yet'
                      : undefined,
              },
              {
                label: 'Value at risk',
                value: `$${stats.valueAtRisk.toLocaleString()}`,
                color: 'var(--risk-medium)',
                hint: valueAtRiskHint,
              },
              {
                /*
                 * With nothing measured there is no health to report. Printing 100%
                 * there would read as a clean bill of health for a wallet nobody
                 * looked at, which is the one thing this score must never imply.
                 */
                label: 'Health score',
                value: stats.total === 0 ? '—' : `${stats.healthScore}%`,
                color:
                  stats.total === 0
                    ? 'var(--text-tertiary)'
                    : stats.healthScore >= 70
                      ? 'var(--risk-safe)'
                      : 'var(--risk-high)',
                /*
                 * The score is the share of permissions that are not risky, and
                 * saying so under the number stops it reading as "this wallet is
                 * safe": a wallet can hold nine unlimited permissions to a router
                 * and still show 100% here, which is the model's arithmetic, not a
                 * clean bill of health.
                 */
                hint:
                  stats.total === 0
                    ? 'no permissions to measure'
                    : `${stats.total - stats.risky} of ${stats.total} permission${
                        stats.total === 1 ? '' : 's'
                      } score under 50`,
              },
            ].map((item) => (
              <div key={item.label} style={{ padding: '18px 20px', borderRadius: 18, background: 'var(--card)', border: '1px solid var(--line)', boxShadow: 'var(--sh-card)' }}>
                <p className="kicker" style={{ marginBottom: 6, color: 'var(--muted)' }}>
                  {item.label}
                </p>
                <p style={{ fontSize: 24, fontWeight: 600, color: item.color ?? 'var(--text)' }}>{item.value}</p>
                {item.hint && (
                  <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
                    {item.hint}
                  </p>
                )}
              </div>
            ))}
          </div>

          {stats.total > 0 && (
            <div className="dash-enter-delay-1" style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 9 }}>
                <p className="kicker">
                  Risk distribution
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {stats.total} live permission{stats.total === 1 ? '' : 's'}
                </p>
              </div>
              <div className="risk-bar" role="img" aria-label={`${stats.total} live permissions: ${stats.bands.critical} critical, ${stats.bands.high} high, ${stats.bands.medium} medium, ${stats.bands.low} low or safe`}>
                {([
                  ['critical', 'var(--risk-critical)'],
                  ['high', 'var(--risk-high)'],
                  ['medium', 'var(--risk-medium)'],
                  ['low', 'var(--risk-safe)'],
                ] as const).map(([band, color]) =>
                  stats.bands[band] > 0 ? (
                    <span
                      key={band}
                      style={{ width: `${(stats.bands[band] / stats.total) * 100}%`, background: color }}
                    />
                  ) : null,
                )}
              </div>
              <div className="risk-legend">
                {([
                  ['Critical ≥70', stats.bands.critical, 'var(--risk-critical)'],
                  ['High 50–69', stats.bands.high, 'var(--risk-high)'],
                  ['Medium 30–49', stats.bands.medium, 'var(--risk-medium)'],
                  ['Low or safe <30', stats.bands.low, 'var(--risk-safe)'],
                ] as const).map(([label, count, color]) => (
                  <span key={label}>
                    <i className="risk-dot" style={{ background: color }} />
                    {label} <b>{count}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          {(revokedSinceLastScan.length > 0 || degraded) && (
            <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {revokedSinceLastScan.length > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 18, background: '#e9f8ef', border: '1px solid #bfe6cd', fontSize: 13, color: '#15803d' }}>
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
                <div style={{ padding: '10px 14px', borderRadius: 18, background: '#fdf3e3', border: '1px solid #f0dcb8', fontSize: 13, color: '#b45309' }}>
                  Partial scan: no block-explorer history was available for this address, so findings come
                  from live allowance reads against a bundled spender list only. Treat the results as
                  incomplete and read the coverage panel below.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {(['approvals', 'incident'] as const).map((entry) => (
              <button
                key={entry}
                onClick={() => setTab(entry)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 500,
                  background: tab === entry ? 'var(--blue)' : '#fff',
                  color: tab === entry ? 'white' : 'var(--text-secondary)',
                  border: tab === entry ? 'none' : '1px solid var(--line)',
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
                  className="field"
                  style={{ flex: 1, minWidth: 200, padding: '11px 16px', borderRadius: 12, fontSize: 14 }}
                />
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map((entry) => (
                  <button
                    key={entry}
                    onClick={() => setFilter(entry)}
                    style={{ padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500, ...(filter === entry ? { background: 'var(--blue)', color: 'white' } : { background: '#fff', color: 'var(--text-secondary)', border: '1px solid var(--line)' }) }}
                  >
                    {FILTER_LABELS[entry]}
                  </button>
                ))}
              </div>

              {selected.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, padding: '12px 16px', borderRadius: 18, background: 'var(--indigo-wash)', border: '1px solid #cdd6fb', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selected.length} selected</span>
                  <button
                    onClick={() => void onRevokeSelected()}
                    disabled={batchRunning || !canRevoke}
                    title={canRevoke ? undefined : 'Connect the wallet that owns this address to revoke'}
                    style={{ padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, color: 'white', background: 'var(--risk-critical)', border: 'none', opacity: canRevoke ? 1 : 0.5, cursor: batchRunning ? 'wait' : canRevoke ? 'pointer' : 'not-allowed' }}
                  >
                    {revoke.batch && batchRunning ? `Revoking ${revoke.batch.done + 1} of ${revoke.batch.total}…` : 'Revoke selected'}
                  </button>
                  <button
                    onClick={() => setSelected([])}
                    style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--line)' }}
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="dash-enter-delay-3">
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[1, 2, 3, 4].map((row) => (
                      <div key={row} style={{ height: 64, borderRadius: 18, background: 'var(--skeleton)', animation: 'pulse 2s infinite' }} />
                    ))}
                  </div>
                ) : error ? (
                  <div style={{ textAlign: 'center', padding: '64px 0' }}>
                    <p style={{ marginBottom: 16, color: 'var(--risk-critical)' }}>{error}</p>
                    <button
                      onClick={() => activeAddress && chainId !== undefined && void loadApprovals(activeAddress, chainId)}
                      className="btn-primary"
                    >
                      Try again
                    </button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: 16, marginBottom: 12, color: 'var(--text)' }}>
                      {approvals.length === 0
                        ? 'No live permissions on this address'
                        : 'Nothing matches this filter'}
                    </p>
                    {approvals.length === 0 ? (
                      <>
                        <p style={{ fontSize: 14, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
                          {coverage && coverage.revokedFound > 0
                            ? `${coverage.pairsChecked} allowance pairs were read on chain and none of them are still granted. ${coverage.revokedFound} permission${coverage.revokedFound === 1 ? '' : 's'} this address granted ${coverage.revokedFound === 1 ? 'has' : 'have'} since been revoked, so nothing is spendable right now.`
                            : 'Permissions appear here once this address approves a token to a contract. Anchrion found no approval from this address on this network.'}
                        </p>
                        <p style={{ fontSize: 13, maxWidth: 560, margin: '12px auto 0', lineHeight: 1.6, color: 'var(--text-tertiary)' }}>
                          An empty list is a measurement, not a failure — the coverage panel below names every
                          check that ran and everything it could not see.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
                          <button
                            onClick={() => setTab('incident')}
                            className="btn-primary"
                            style={{ padding: '9px 18px', fontSize: 13 }}
                          >
                            Reconstruct its history
                          </button>
                          {readOnly && (
                            <button
                              onClick={stopReadOnly}
                              style={{ padding: '9px 18px', borderRadius: 999, fontSize: 13, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--line)', cursor: 'pointer' }}
                            >
                              Inspect another address
                            </button>
                          )}
                          <a
                            href="/method"
                            style={{ padding: '9px 18px', borderRadius: 999, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid var(--line)' }}
                          >
                            What this cannot see
                          </a>
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: 14, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
                        Try clearing the search or switching back to the All filter.
                      </p>
                    )}
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
                    className="btn-primary"
                  >
                    Run reconstruction
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="app-footer" style={{ padding: 'clamp(24px,3vh,32px) clamp(20px,4vw,48px)' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo.svg" alt="Anchrion" style={{ width: 22, height: 22, display: 'block' }} />
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
