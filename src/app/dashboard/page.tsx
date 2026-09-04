'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Approval, WalletStats } from '@/types/approval';
import { calculateRiskScore, getRiskColor, getRiskLabel } from '@/lib/risk/scorer';
import { fetchApprovals, getTokenPrice } from '@/lib/graph/client';

export default function Dashboard() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const router = useRouter();

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  // Redirect if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push('/');
    }
  }, [isConnected, router]);

  // Fetch approvals when connected
  useEffect(() => {
    if (isConnected && address && chain) {
      loadApprovals();
    }
  }, [isConnected, address, chain]);

  async function loadApprovals() {
    if (!address || !chain) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const rawApprovals = await fetchApprovals(address, chain.id as any);
      
      // Calculate risk scores and fetch prices
      const enrichedApprovals = await Promise.all(
        rawApprovals.map(async (approval) => {
          const { score, level, factors } = calculateRiskScore(approval);
          const price = await getTokenPrice(approval.tokenSymbol);
          const usdValue = parseFloat(approval.allowanceFormatted) * price;
          
          return {
            ...approval,
            riskScore: score,
            riskLevel: level,
            riskFactors: factors,
            allowanceUsd: usdValue,
          };
        })
      );
      
      // Sort by risk score (highest first)
      enrichedApprovals.sort((a, b) => b.riskScore - a.riskScore);
      
      setApprovals(enrichedApprovals);
    } catch (err) {
      setError('Failed to load approvals. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate stats
  const stats: WalletStats = useMemo(() => {
    const total = approvals.length;
    const risky = approvals.filter(a => a.riskScore >= 50).length;
    const critical = approvals.filter(a => a.riskScore >= 70).length;
    const valueAtRisk = approvals
      .filter(a => a.riskScore >= 50)
      .reduce((sum, a) => sum + a.allowanceUsd, 0);
    const healthScore = total === 0 ? 100 : Math.round(((total - risky) / total) * 100);
    
    return {
      totalApprovals: total,
      riskyApprovals: risky,
      criticalApprovals: critical,
      valueAtRisk,
      healthScore,
      chainId: chain?.id || 1,
    };
  }, [approvals]);

  // Filter approvals
  const filteredApprovals = useMemo(() => {
    return approvals.filter(approval => {
      const matchesSearch = 
        approval.tokenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        approval.tokenSymbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        approval.spenderAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (approval.spenderLabel?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      
      const matchesFilter = 
        filterRisk === 'all' ||
        (filterRisk === 'critical' && approval.riskScore >= 70) ||
        (filterRisk === 'high' && approval.riskScore >= 50 && approval.riskScore < 70) ||
        (filterRisk === 'medium' && approval.riskScore >= 30 && approval.riskScore < 50) ||
        (filterRisk === 'low' && approval.riskScore < 30);
      
      return matchesSearch && matchesFilter;
    });
  }, [approvals, searchQuery, filterRisk]);

  if (!isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" rx="20" fill="#1a73e8" />
              <path d="M30 70L50 30L70 70" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M38 55H62" stroke="white" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-semibold">Anchrion</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)]">
              <span className="w-2 h-2 rounded-full bg-[var(--risk-safe)]" />
              <span className="text-sm">{chain?.name || 'Unknown'}</span>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)]">
              <span className="text-sm font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
            <button
              onClick={() => disconnect()}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white 
                         border border-[var(--border)] rounded-[var(--radius-md)] 
                         hover:border-[var(--border-hover)] transition-all"
            >
              Disconnect
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Approvals" value={stats.totalApprovals} />
          <StatCard label="Risky" value={stats.riskyApprovals} color="var(--risk-high)" />
          <StatCard label="At Risk" value={`$${stats.valueAtRisk.toLocaleString()}`} color="var(--risk-medium)" />
          <StatCard label="Health Score" value={`${stats.healthScore}%`} color={stats.healthScore >= 70 ? 'var(--risk-safe)' : 'var(--risk-high)'} />
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search approvals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] 
                         rounded-[var(--radius-md)] text-white placeholder-[var(--text-tertiary)]
                         focus:outline-none focus:border-[var(--blue-primary)] transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'critical', 'high', 'medium', 'low'].map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterRisk(filter)}
                className={`px-4 py-2 text-sm rounded-[var(--radius-md)] transition-all
                  ${filterRisk === filter 
                    ? 'bg-[var(--blue-primary)] text-white' 
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)]'
                  }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Approval List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-[var(--error)] mb-4">{error}</p>
            <button
              onClick={loadApprovals}
              className="px-6 py-2 bg-[var(--blue-primary)] text-white rounded-[var(--radius-md)] 
                         hover:bg-[var(--blue-light)] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--text-secondary)]">
              {approvals.length === 0 
                ? 'No approvals found for this wallet.'
                : 'No approvals match your search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApprovals.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)]">
      <p className="text-sm text-[var(--text-secondary)] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color || 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

function ApprovalCard({ approval }: { approval: Approval }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`p-4 bg-[var(--bg-secondary)] border rounded-[var(--radius-lg)] 
                     hover:border-[var(--border-hover)] transition-all cursor-pointer
                     ${approval.riskScore >= 70 ? 'border-[var(--risk-critical)]' : 
                       approval.riskScore >= 50 ? 'border-[var(--risk-high)]' : 
                       approval.riskScore >= 30 ? 'border-[var(--risk-medium)]' : 
                       'border-[var(--border)]'}`}
         onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
            <span className="text-lg">{approval.tokenSymbol.slice(0, 2)}</span>
          </div>
          <div>
            <h3 className="font-semibold">{approval.tokenName}</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {approval.spenderLabel || approval.spenderAddress.slice(0, 10) + '...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">${approval.allowanceUsd.toLocaleString()}</p>
            <p className="text-sm text-[var(--text-secondary)]">{approval.allowanceFormatted} {approval.tokenSymbol}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRiskColor(approval.riskLevel)}`}>
            {getRiskLabel(approval.riskLevel)}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--border)] animate-fade-in">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold mb-2 text-[var(--text-secondary)]">Risk Factors</h4>
              <ul className="space-y-2">
                {approval.riskFactors.map((factor, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-[var(--text-secondary)]">{factor.name}:</span>{' '}
                    <span className={factor.impact > 0 ? 'text-[var(--risk-high)]' : 'text-[var(--risk-safe)]'}>
                      {factor.impact > 0 ? '+' : ''}{factor.impact} points
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2 text-[var(--text-secondary)]">Details</h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-[var(--text-tertiary)]">Contract:</span> {approval.spenderAddress.slice(0, 20)}...</p>
                <p><span className="text-[var(--text-tertiary)]">Chain:</span> {approval.chainId}</p>
                <p><span className="text-[var(--text-tertiary)]">First seen:</span> {approval.firstSeenAt.toLocaleDateString()}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 bg-[var(--risk-critical)] text-white rounded-[var(--radius-md)] 
                               hover:bg-[#ff1744] transition-colors text-sm font-semibold">
              Revoke Approval
            </button>
            <button className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] 
                               rounded-[var(--radius-md)] hover:text-white hover:border-[var(--border-hover)] 
                               transition-colors text-sm">
              View on Explorer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
