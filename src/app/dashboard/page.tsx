'use client';

import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { useEffect, useState, useMemo } from 'react';
import { Approval, WalletStats } from '@/types/approval';
import { calculateRiskScore, getRiskLabel } from '@/lib/risk/scorer';
import { fetchApprovals, getTokenPrice } from '@/lib/graph/client';

export default function Dashboard() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors, isPending } = useConnect();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { if (isConnected && address && chain) loadApprovals(); }, [isConnected, address, chain]);

  async function loadApprovals() {
    if (!address || !chain) return;
    setLoading(true); setError(null);
    try {
      const raw = await fetchApprovals(address, chain.id as any);
      const enriched = await Promise.all(raw.map(async (a) => {
        const { score, level, factors } = calculateRiskScore(a);
        const price = await getTokenPrice(a.tokenSymbol);
        return { ...a, riskScore: score, riskLevel: level, riskFactors: factors, allowanceUsd: parseFloat(a.allowanceFormatted) * price };
      }));
      enriched.sort((a, b) => b.riskScore - a.riskScore);
      setApprovals(enriched);
    } catch { setError('Failed to load approvals.'); }
    finally { setLoading(false); }
  }

  const stats: WalletStats = useMemo(() => {
    const total = approvals.length;
    const risky = approvals.filter(a => a.riskScore >= 50).length;
    const valueAtRisk = approvals.filter(a => a.riskScore >= 50).reduce((s, a) => s + a.allowanceUsd, 0);
    const healthScore = total === 0 ? 100 : Math.round(((total - risky) / total) * 100);
    return { totalApprovals: total, riskyApprovals: risky, criticalApprovals: 0, valueAtRisk, healthScore, chainId: chain?.id || 1 };
  }, [approvals]);

  const filtered = useMemo(() => approvals.filter(a => {
    const matchSearch = [a.tokenName, a.tokenSymbol, a.spenderAddress, a.spenderLabel].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === 'all' || (filter === 'critical' && a.riskScore >= 70) || (filter === 'high' && a.riskScore >= 50) || (filter === 'medium' && a.riskScore >= 30) || (filter === 'low' && a.riskScore < 30);
    return matchSearch && matchFilter;
  }), [approvals, search, filter]);

  /* ── Wallet logo helper ── */
  function walletLogo(name: string) {
    const imgBase: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, objectFit: 'contain' };
    if (name.includes('MetaMask')) return <img src="/metamask.png" alt="MetaMask" style={{ ...imgBase, mixBlendMode: 'screen' }} />;
    if (name.includes('Coinbase')) return <img src="/coinbase.png" alt="Coinbase" style={imgBase} />;
    if (name.includes('Phantom')) return <img src="/phantom.png" alt="Phantom" style={imgBase} />;
    if (name.includes('WalletConnect')) return <img src="/walletconnect.png" alt="WalletConnect" style={imgBase} />;
    return <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(26,115,232,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--blue-light)' }}><span>W</span></div>;
  }

  /* ── Not connected ── */
  if (!isConnected) return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 25%, #0f2847 50%, #0a1628 75%, #050a14 100%)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 800px 600px at 25% 35%, rgba(26,115,232,0.12) 0%, transparent 70%), radial-gradient(ellipse 600px 400px at 75% 65%, rgba(74,158,255,0.08) 0%, transparent 60%)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, padding: 32, textAlign: 'center' }}>
        <img src="/logo.png" alt="Anchrion" style={{ width: 56, height: 56, borderRadius: 14 }} />
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 400, marginBottom: 10 }}>Connect Your Wallet</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 380, lineHeight: 1.6 }}>
            Scan your approvals and check your wallet risk score.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
          {connectors.filter(c => {
            const n = c.name.toLowerCase();
            return n.includes('metamask') || n.includes('coinbase') || n.includes('phantom') || n.includes('walletconnect');
          }).map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: isPending ? 'wait' : 'pointer', transition: 'all .2s', textAlign: 'left' }}
            >
              {walletLogo(connector.name)}
              {connector.name}
            </button>
          ))}
        </div>
        <a href="/" style={{ marginTop: 8, fontSize: 13, color: 'var(--text-tertiary)', transition: 'color .2s' }}>
          &larr; Back to home
        </a>
      </div>
    </div>
  );

  /* ── Main dashboard ── */
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', position: 'relative' }}>

      {/* Animated background — same as landing */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 25%, #0f2847 50%, #0a1628 75%, #050a14 100%)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 800px 600px at 25% 35%, rgba(26,115,232,0.12) 0%, transparent 70%), radial-gradient(ellipse 600px 400px at 75% 65%, rgba(74,158,255,0.08) 0%, transparent 60%)' }} />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Glass Header ── */}
        <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 56, display: 'flex', alignItems: 'center', padding: '0 clamp(20px,4vw,48px)', justifyContent: 'space-between', backdropFilter: 'blur(40px) saturate(1.4)', WebkitBackdropFilter: 'blur(40px) saturate(1.4)', background: 'rgba(8,9,13,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="Anchrion" style={{ width: 28, height: 28, borderRadius: 7 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400 }}>Anchrion</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {chain && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--risk-safe)' }} />
                {chain.name}
              </span>
            )}
            <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 13, fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <button onClick={() => disconnect()} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', transition: 'all .2s' }}>
              Disconnect
            </button>
          </div>
        </header>

        <main style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(24px,4vh,40px) clamp(20px,4vw,48px)' }}>

          {/* ── Page Title ── */}
          <div className="dash-enter" style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--blue-light)', marginBottom: 8 }}>Dashboard</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 400, lineHeight: 1.2 }}>
              Wallet <span style={{ color: 'var(--blue-light)' }}>Overview</span>
            </h1>
          </div>

          {/* ── Stats Grid ── */}
          <div className="dash-enter-delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total Approvals', value: stats.totalApprovals },
              { label: 'Risky', value: stats.riskyApprovals, color: 'var(--risk-high)' },
              { label: 'Value at Risk', value: `$${stats.valueAtRisk.toLocaleString()}`, color: 'var(--risk-medium)' },
              { label: 'Health Score', value: `${stats.healthScore}%`, color: stats.healthScore >= 70 ? 'var(--risk-safe)' : 'var(--risk-high)' },
            ].map(s => (
              <div key={s.label} style={{ padding: '18px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
                <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 600, color: s.color || 'var(--text)', fontFamily: 'var(--font-body)' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Search + Filter ── */}
          <div className="dash-enter-delay-2" style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="Search approvals..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '11px 16px', borderRadius: 8, fontSize: 14, outline: 'none', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, transition: 'all .2s', ...(filter === f ? { background: 'var(--blue)', color: 'white' } : { background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.06)' }) }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Approval List ── */}
          <div className="dash-enter-delay-3">
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 64, borderRadius: 10, background: 'rgba(255,255,255,0.02)', animation: 'pulse 2s infinite' }} />)}
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <p style={{ marginBottom: 16, color: 'var(--risk-critical)' }}>{error}</p>
                <button onClick={loadApprovals} className="btn-primary">Try Again</button>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)' }}>
                {approvals.length === 0 ? 'No approvals found for this wallet.' : 'No approvals match your search.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(a => <ApprovalRow key={a.id} approval={a} />)}
              </div>
            )}
          </div>
        </main>

        {/* ── Glass Footer ── */}
        <footer style={{ backdropFilter: 'blur(40px) saturate(1.4)', WebkitBackdropFilter: 'blur(40px) saturate(1.4)', background: 'linear-gradient(180deg, rgba(8,9,13,0.6) 0%, rgba(8,9,13,0.85) 100%)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: 'clamp(24px,3vh,32px) clamp(20px,4vw,48px)' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo.png" alt="Anchrion" style={{ width: 22, height: 22, borderRadius: 5 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>&copy; 2026 Anchrion</span>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text-secondary)', transition: 'opacity .2s' }}>GitHub</a>
              <a href="/" style={{ fontSize: 13, color: 'var(--text-secondary)', transition: 'opacity .2s' }}>Home</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── Approval Row ── */
function ApprovalRow({ approval: a }: { approval: Approval }) {
  const [open, setOpen] = useState(false);
  const borderColor = a.riskScore >= 70 ? 'rgba(239,68,68,0.25)' : a.riskScore >= 50 ? 'rgba(249,115,22,0.2)' : a.riskScore >= 30 ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.06)';
  const bgColor = a.riskScore >= 70 ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)';

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', background: bgColor, border: `1px solid ${borderColor}`, transition: 'border-color .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: 'rgba(26,115,232,0.1)', color: 'var(--blue-light)', border: '1px solid rgba(26,115,232,0.15)', flexShrink: 0, letterSpacing: '-0.02em' }}>
            {a.tokenSymbol.slice(0, 2)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.tokenName}</p>
            <p style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-tertiary)' }}>{a.spenderLabel || a.spenderAddress.slice(0, 14) + '…'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, marginLeft: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>${a.allowanceUsd.toLocaleString()}</p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.allowanceFormatted} {a.tokenSymbol}</p>
          </div>
          <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: a.riskScore >= 70 ? 'rgba(239,68,68,0.12)' : a.riskScore >= 50 ? 'rgba(249,115,22,0.12)' : a.riskScore >= 30 ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)', color: a.riskScore >= 70 ? '#fca5a5' : a.riskScore >= 50 ? '#fdba74' : a.riskScore >= 30 ? '#fde047' : '#86efac' }}>
            {getRiskLabel(a.riskLevel)}
          </span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }}>
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {open && (
        <div style={{ padding: '14px 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Risk Factors</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {a.riskFactors.map((f, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{f.name}</span>
                    <span style={{ fontWeight: 600, color: f.impact > 0 ? '#fca5a5' : '#86efac' }}>
                      {f.impact > 0 ? '+' : ''}{f.impact}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>Details</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <p><span style={{ color: 'var(--text-tertiary)' }}>Contract: </span><span style={{ fontFamily: 'monospace' }}>{a.spenderAddress.slice(0, 18)}…</span></p>
                <p><span style={{ color: 'var(--text-tertiary)' }}>Chain: </span>{a.chainId}</p>
                <p><span style={{ color: 'var(--text-tertiary)' }}>First seen: </span>{a.firstSeenAt.toLocaleDateString()}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', background: 'var(--risk-critical)', transition: 'opacity .2s' }}>
              Revoke Approval
            </button>
            <button style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', transition: 'all .2s' }}>
              View on Explorer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
