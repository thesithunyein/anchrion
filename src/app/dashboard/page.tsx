'use client';

import { useAccount, useDisconnect } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Approval, WalletStats } from '@/types/approval';
import { calculateRiskScore, getRiskLabel } from '@/lib/risk/scorer';
import { fetchApprovals, getTokenPrice } from '@/lib/graph/client';

export default function Dashboard() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { if (!isConnected) router.push('/'); }, [isConnected, router]);
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

  if (!isConnected) return null;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="Anchrion" style={{ width: 28, height: 28, borderRadius: 7 }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Anchrion</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {chain && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, fontSize: 13, background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--risk-safe)' }} />
              {chain.name}
            </span>
          )}
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13, fontFamily: 'monospace', background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <button onClick={() => disconnect()} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'transparent' }}>
            Disconnect
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Approvals', value: stats.totalApprovals },
            { label: 'Risky', value: stats.riskyApprovals, color: 'var(--risk-high)' },
            { label: 'At Risk', value: `$${stats.valueAtRisk.toLocaleString()}`, color: 'var(--risk-medium)' },
            { label: 'Health', value: `${stats.healthScore}%`, color: stats.healthScore >= 70 ? 'var(--risk-safe)' : 'var(--risk-high)' },
          ].map(s => (
            <div key={s.label} style={{ padding: 16, borderRadius: 12, background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <input
            type="text" placeholder="Search approvals..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 14, outline: 'none', background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'critical', 'high', 'medium', 'low'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, ...(filter === f ? { background: 'var(--blue)', color: 'white' } : { background: 'var(--bg-alt)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }) }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 68, borderRadius: 12, background: 'var(--bg-alt)', animation: 'pulse 2s infinite' }} />)}
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
      </main>
    </div>
  );
}

function ApprovalRow({ approval: a }: { approval: Approval }) {
  const [open, setOpen] = useState(false);
  const borderColor = a.riskScore >= 70 ? 'var(--risk-critical)' : a.riskScore >= 50 ? 'var(--risk-high)' : a.riskScore >= 30 ? 'var(--risk-medium)' : 'var(--border)';
  const bgColor = a.riskScore >= 70 ? 'rgba(239,68,68,0.03)' : 'var(--bg)';

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', background: bgColor, border: `1px solid ${borderColor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: 'var(--bg-alt)', color: 'var(--text-secondary)', border: '1px solid var(--border)', flexShrink: 0 }}>
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
          <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: a.riskScore >= 70 ? 'rgba(239,68,68,0.1)' : a.riskScore >= 50 ? 'rgba(249,115,22,0.1)' : a.riskScore >= 30 ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)', color: borderColor }}>
            {getRiskLabel(a.riskLevel)}
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }}>
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {open && (
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>Risk Factors</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {a.riskFactors.map((f, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{f.name}</span>
                    <span style={{ fontWeight: 600, color: f.impact > 0 ? 'var(--risk-high)' : 'var(--risk-safe)' }}>
                      {f.impact > 0 ? '+' : ''}{f.impact}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>Details</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <p><span style={{ color: 'var(--text-tertiary)' }}>Contract: </span><span style={{ fontFamily: 'monospace' }}>{a.spenderAddress.slice(0, 18)}…</span></p>
                <p><span style={{ color: 'var(--text-tertiary)' }}>Chain: </span>{a.chainId}</p>
                <p><span style={{ color: 'var(--text-tertiary)' }}>First seen: </span>{a.firstSeenAt.toLocaleDateString()}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'white', background: 'var(--risk-critical)' }}>
              Revoke Approval
            </button>
            <button style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'transparent' }}>
              View on Explorer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
