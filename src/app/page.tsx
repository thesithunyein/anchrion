'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0055ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Real-time Monitor',
    desc: 'Catches new approvals the moment they happen. Never miss a dangerous contract.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0055ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    title: 'Risk Analysis',
    desc: 'Explains in plain English why an approval is dangerous. No Solidity knowledge needed.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0055ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    title: 'One-Click Revoke',
    desc: 'Revoke dangerous approvals with a single click. Gas-optimized transactions.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0055ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
    title: 'Multi-Chain',
    desc: 'Works across Ethereum, Base, Arbitrum, and Optimism. One dashboard for all.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0055ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: 'Encrypted Memory',
    desc: 'Remembers your approval history. Tracks changes over time. Data stays private.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0055ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    title: 'Pay-per-Scan',
    desc: 'Premium deep analysis via x402 on Hedera. Pay only when you need deeper insight.',
  },
];

const steps = [
  { n: 1, t: 'Connect Your Wallet', d: 'Connect MetaMask, Coinbase Wallet, or any Web3 wallet. No private keys needed.' },
  { n: 2, t: 'Scan Approvals', d: 'Anchrion fetches all token approvals from The Graph across multiple chains.' },
  { n: 3, t: 'Understand the Risk', d: 'AI explains each approval in plain English. See which contracts can drain your wallet.' },
  { n: 4, t: 'Protect Yourself', d: 'One-click revoke dangerous approvals. Anchrion remembers so you don\'t have to.' },
];

const stats = [
  { value: '$3.4B', label: 'Stolen from wallets in 2025' },
  { value: '98%', label: 'Drop in monthly hack losses' },
  { value: '4', label: 'Chains supported' },
  { value: '<1s', label: 'Approval detection time' },
];

const footerLinks = [
  { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'How It Works', href: '#how' }, { label: 'Dashboard', href: '/dashboard' }] },
  { title: 'Developers', links: [{ label: 'GitHub', href: 'https://github.com/thesithunyein/anchrion' }, { label: 'Documentation', href: '/docs' }, { label: 'API', href: '/api' }] },
  { title: 'Community', links: [{ label: 'Twitter', href: 'https://twitter.com' }, { label: 'Discord', href: 'https://discord.com' }] },
];

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
  useEffect(() => { if (isConnected) router.push('/dashboard'); }, [isConnected, router]);

  return (
    <div>
      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div className="nav-container">
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="Anchrion" style={{ width: 28, height: 28, borderRadius: 6 }} />
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em' }}>Anchrion</span>
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how">How It Works</a>
            <a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="/dashboard" className="btn-primary">Open App</a>
          </div>
        </div>
      </nav>

      {/* Hero - Left aligned like zoneless */}
      <section className="hero">
        <p className="eyebrow">Wallet Security, Reimagined</p>
        <h1 className="heading-xl" style={{ marginBottom: 20 }}>
          Your wallet&apos;s AI bodyguard.
        </h1>
        <p className="subheading" style={{ marginBottom: 36 }}>
          Monitor, explain, and protect your token approvals. Catch dangerous contracts before they drain your funds.
        </p>
        <button onClick={() => router.push('/dashboard')} className="btn-outline" style={{ padding: '14px 32px', fontSize: 15 }}>
          Get started
        </button>
      </section>

      {/* Stats */}
      <section className="section-alt">
        <div className="section-inner">
          <div className="stat-grid">
            {stats.map(s => (
              <div key={s.label}>
                <p className="stat-value">{s.value}</p>
                <p className="stat-label">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="section">
        <div className="section-inner">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p className="eyebrow">Features</p>
            <h2 className="heading-lg">Why Anchrion?</h2>
            <p className="subheading" style={{ margin: '0 auto' }}>
              Not a scanner. Not a reporter. A bodyguard that catches threats before they happen.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, textAlign: 'left' }}>
            {features.map(f => (
              <div key={f.title} className="card">
                <div style={{ marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, letterSpacing: '-0.01em' }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="section" style={{ background: 'var(--bg-alt)' }}>
        <div className="section-inner" style={{ maxWidth: 580, margin: '0 auto' }}>
          <p className="eyebrow" style={{ textAlign: 'center' }}>How It Works</p>
          <h2 className="heading-lg" style={{ textAlign: 'center', marginBottom: 56 }}>Four steps to safety</h2>
          {steps.map(s => (
            <div key={s.n} className="step">
              <div className="step-num">{s.n}</div>
              <div>
                <p className="step-title">{s.t}</p>
                <p className="step-desc">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center' }}>
        <h2 className="heading-lg" style={{ marginBottom: 12 }}>Ready to protect your wallet?</h2>
        <p style={{ fontSize: 15, marginBottom: 32, color: 'var(--text-secondary)' }}>Connect your wallet in seconds. No signup required.</p>
        <button onClick={() => router.push('/dashboard')} className="btn-outline" style={{ padding: '14px 32px', fontSize: 15 }}>Get started</button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 48, marginBottom: 40 }}>
            <div style={{ maxWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <img src="/logo.png" alt="Anchrion" style={{ width: 24, height: 24, borderRadius: 5 }} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>Anchrion</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
                Your wallet&apos;s AI bodyguard. Monitor, explain, and protect your token approvals.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 56 }}>
              {footerLinks.map(col => (
                <div key={col.title}>
                  <h4 style={{ fontSize: 11, fontWeight: 500, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>{col.title}</h4>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {col.links.map(l => (
                      <li key={l.label}>
                        <a href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel={l.href.startsWith('http') ? 'noopener noreferrer' : undefined} style={{ fontSize: 13, color: 'var(--text-secondary)', transition: 'color 0.15s' }}>
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 Anchrion. All rights reserved.</p>
            <p>Built with The Graph · Hedera · 0G</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
