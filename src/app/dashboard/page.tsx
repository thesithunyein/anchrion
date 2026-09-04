'use client';

import { useAccount, useDisconnect } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Approval, WalletStats } from '@/types/approval';
import { calculateRiskScore, getRiskColor, getRiskLabel } from '@/lib/risk/scorer';
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
    } catch { setError('Failed to load approvals. Please try again.'); }
    finally { setLoading(false); }
  }

  const stats: WalletStats = useMemo(() => {
    const total = approvals.length;
    const risky = approvals.filter(a => a.riskScore >= 50).length;
    const critical = approvals.filter(a => a.riskScore >= 70).length;
    const valueAtRisk = approvals.filter(a => a.riskScore >= 50).reduce((s, a) => s + a.allowanceUsd, 0);
    const healthScore = total === 0 ? 100 : Math.round(((total - risky) / total) * 100);
    return { totalApprovals: total, riskyApprovals: risky, criticalApprovals: critical, valueAtRisk, healthScore, chainId: chain?.id || 1 };
  }, [approvals]);

  const filtered = useMemo(() => approvals.filter(a => {
    const matchSearch = [a.tokenName, a.tokenSymbol, a.spenderAddress, a.spenderLabel].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === 'all' || (filter === 'critical' && a.riskScore >= 70) || (filter === 'high' && a.riskScore >= 50 && a.riskScore < 70) || (filter === 'medium' && a.riskScore >= 30 && a.riskScore < 50) || (filter === 'low' && a.riskScore < 30);
    return matchSearch && matchFilter;
  }), [approvals, search, filter]);

  if (!isConnected) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 flex items-center px-6 justify-between" style={{ background: 'rgba(8,9,13,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/')}>
          <img src="/logo.png" alt="Anchrion" className="w-7 h-7 rounded-lg" />
          <span className="text-[15px] font-semibold">Anchrion</span>
        </div>
        <div className="flex items-center gap-3">
          {chain && (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-safe)]" />{chain.name}
            </span>
          )}
          <span className="px-3 py-1 rounded-full text-[13px] font-mono" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <button onClick={() => disconnect()} className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[13px] transition-colors" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Disconnect
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Stat label="Total Approvals" value={stats.totalApprovals} />
          <Stat label="Risky" value={stats.riskyApprovals} color="var(--risk-high)" />
          <Stat label="At Risk" value={`$${stats.valueAtRisk.toLocaleString()}`} color="var(--risk-medium)" />
          <Stat label="Health" value={`${stats.healthScore}%`} color={stats.healthScore >= 70 ? 'var(--risk-safe)' : 'var(--risk-high)'} />
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search approvals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] text-[14px] outline-none transition-colors"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="flex gap-1.5">
            {['all', 'critical', 'high', 'medium', 'low'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[13px] font-medium transition-all"
                style={filter === f ? { background: 'var(--blue)', color: 'white' } : { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-[72px] rounded-[var(--radius-lg)]" />)}</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="mb-4" style={{ color: 'var(--error)' }}>{error}</p>
            <button onClick={loadApprovals} className="px-5 py-2 rounded-[var(--radius-md)] text-[14px] font-medium text-white" style={{ background: 'var(--blue)' }}>Try Again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
            {approvals.length === 0 ? 'No approvals found for this wallet.' : 'No approvals match your search.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => <ApprovalRow key={a.id} approval={a} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="p-4 rounded-[var(--radius-lg)]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <p className="text-[12px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="text-[22px] font-bold" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function ApprovalRow({ approval: a }: { approval: Approval }) {
  const [open, setOpen] = useState(false);
  const borderColor = a.riskScore >= 70 ? 'var(--risk-critical)' : a.riskScore >= 50 ? 'var(--risk-high)' : a.riskScore >= 30 ? 'var(--risk-medium)' : 'var(--border)';

  return (
    <div className="rounded-[var(--radius-lg)] transition-all duration-200" style={{ background: 'var(--bg-secondary)', border: `1px solid ${borderColor}` }}>
      <div className="flex items-center justify-between p-4 cursor-pointer hover:opacity-90" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            {a.tokenSymbol.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold truncate">{a.tokenName}</p>
            <p className="text-[12px] truncate" style={{ color: 'var(--text-tertiary)' }}>{a.spenderLabel || a.spenderAddress.slice(0, 14) + '…'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <p className="text-[14px] font-semibold">${a.allowanceUsd.toLocaleString()}</p>
            <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>{a.allowanceFormatted} {a.tokenSymbol}</p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold" style={{ background: a.riskScore >= 70 ? 'rgba(255,45,85,0.12)' : a.riskScore >= 50 ? 'rgba(255,107,107,0.12)' : a.riskScore >= 30 ? 'rgba(255,184,0,0.12)' : 'rgba(52,199,89,0.12)', color: borderColor }}>
            {getRiskLabel(a.riskLevel)}
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }}>
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t animate-fade-up" style={{ borderColor: 'var(--border)' }}>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Risk Factors</h4>
              <ul className="space-y-2">
                {a.riskFactors.map((f, i) => (
                  <li key={i} className="flex justify-between text-[13px]">
                    <span style={{ color: 'var(--text-secondary)' }}>{f.name}</span>
                    <span className="font-semibold" style={{ color: f.impact > 0 ? 'var(--risk-high)' : 'var(--risk-safe)' }}>
                      {f.impact > 0 ? '+' : ''}{f.impact}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Details</h4>
              <div className="space-y-1.5 text-[13px]">
                <p><span style={{ color: 'var(--text-tertiary)' }}>Contract: </span><span className="font-mono">{a.spenderAddress.slice(0, 18)}…</span></p>
                <p><span style={{ color: 'var(--text-tertiary)' }}>Chain: </span>{a.chainId}</p>
                <p><span style={{ color: 'var(--text-tertiary)' }}>First seen: </span>{a.firstSeenAt.toLocaleDateString()}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button className="px-4 py-2 rounded-[var(--radius-sm)] text-[13px] font-semibold text-white transition-all hover:-translate-y-0.5" style={{ background: 'var(--risk-critical)' }}>
              Revoke Approval
            </button>
            <button className="px-4 py-2 rounded-[var(--radius-sm)] text-[13px] transition-all" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              View on Explorer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
