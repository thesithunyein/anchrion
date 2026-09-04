'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function Icon({ d, size = 28 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const icons = {
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chart: 'M22 12h-4l-3 9L9 3l-3 9H2',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
};

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
  useEffect(() => { if (isConnected) router.push('/dashboard'); }, [isConnected, router]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div className="nav-container">
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="Anchrion" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span style={{ fontSize: 16, fontWeight: 600 }}>Anchrion</span>
          </a>
          <div className="nav-links">
            <a href="#features" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Features</a>
            <a href="#how" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>How It Works</a>
            <a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>GitHub</a>
            <a href="/dashboard" className="btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}>Open App</a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--blue)', marginBottom: 20 }}>
          Wallet Security, Reimagined
        </p>
        <h1 style={{ fontSize: 'clamp(36px, 5.5vw, 60px)', fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.02em', marginBottom: 24, maxWidth: 680 }}>
          Your Wallet Never Sleeps.
          <br />
          <span style={{ color: 'var(--blue)' }}>Neither Does Anchrion.</span>
        </h1>
        <p style={{ fontSize: 16, maxWidth: 480, marginBottom: 32, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          AI-powered guardian that monitors, explains, and protects your wallet approvals. Catch dangerous contracts before they drain your funds.
        </p>
        <button onClick={() => router.push('/dashboard')} className="btn-primary" style={{ padding: '12px 28px', fontSize: 15 }}>
          Connect Wallet
        </button>
        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-tertiary)' }}>
          Ethereum · Base · Arbitrum · Optimism
        </p>
      </section>

      <section style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, textAlign: 'center' }}>
          {[
            { value: '$3.4B', label: 'Stolen from wallets in 2025' },
            { value: '98%', label: 'Drop in monthly hack losses' },
            { value: '4', label: 'Chains supported' },
            { value: '<1s', label: 'Approval detection time' },
          ].map(s => (
            <div key={s.label}>
              <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{s.value}</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" style={{ padding: '96px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--blue)', textAlign: 'center', marginBottom: 12 }}>Features</p>
          <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>Why Anchrion?</h2>
          <p style={{ fontSize: 15, textAlign: 'center', marginBottom: 56, maxWidth: 460, margin: '0 auto 56px', color: 'var(--text-secondary)' }}>
            Not a scanner. Not a reporter. A bodyguard that catches threats before they happen.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {[
              { icon: icons.shield, title: 'Real-time Monitor', desc: 'Catches new approvals the moment they happen. Never miss a dangerous contract.' },
              { icon: icons.chart, title: 'Risk Analysis', desc: 'Explains in plain English why an approval is dangerous. No Solidity knowledge needed.' },
              { icon: icons.zap, title: 'One-Click Revoke', desc: 'Revoke dangerous approvals with a single click. Gas-optimized transactions.' },
              { icon: icons.link, title: 'Multi-Chain', desc: 'Works across Ethereum, Base, Arbitrum, and Optimism. One dashboard for all.' },
              { icon: icons.lock, title: 'Encrypted Memory', desc: 'Remembers your approval history. Tracks changes over time. Data stays private.' },
              { icon: icons.dollar, title: 'Pay-per-Scan', desc: 'Premium deep analysis via x402 on Hedera. Pay only when you need deeper insight.' },
            ].map(f => (
              <div key={f.title} style={{ padding: 24, borderRadius: 12, border: '1px solid var(--border)', transition: 'all 0.2s' }}>
                <div style={{ marginBottom: 16 }}><Icon d={f.icon} /></div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" style={{ padding: '96px 24px', background: 'var(--bg-alt)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--blue)', textAlign: 'center', marginBottom: 12 }}>How It Works</p>
          <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 56 }}>Four steps to safety</h2>
          {[
            { n: 1, t: 'Connect Your Wallet', d: 'Connect MetaMask, Coinbase Wallet, or any Web3 wallet. No private keys needed.' },
            { n: 2, t: 'Scan Approvals', d: 'Anchrion fetches all token approvals from The Graph across multiple chains.' },
            { n: 3, t: 'Understand the Risk', d: 'AI explains each approval in plain English. See which contracts can drain your wallet.' },
            { n: 4, t: 'Protect Yourself', d: 'One-click revoke dangerous approvals. Anchrion remembers so you don\'t have to.' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 20, marginBottom: 40 }}>
              <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', background: 'var(--blue)' }}>{s.n}</div>
              <div style={{ paddingTop: 6 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{s.t}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '96px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Ready to protect your wallet?</h2>
        <p style={{ fontSize: 15, marginBottom: 32, color: 'var(--text-secondary)' }}>Connect your wallet in seconds. No signup required.</p>
        <button onClick={() => router.push('/dashboard')} className="btn-primary" style={{ padding: '12px 28px', fontSize: 15 }}>Get Started</button>
      </section>

      <footer style={{ padding: '40px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40, marginBottom: 32 }}>
            <div style={{ maxWidth: 280 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <img src="/logo.png" alt="Anchrion" style={{ width: 28, height: 28, borderRadius: 7 }} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>Anchrion</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                Your wallet&apos;s AI bodyguard. Monitor, explain, and protect your token approvals.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>Product</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <li><a href="#features" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Features</a></li>
                  <li><a href="#how" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>How It Works</a></li>
                  <li><a href="/dashboard" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Dashboard</a></li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>Developers</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <li><a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>GitHub</a></li>
                  <li><a href="/docs" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Documentation</a></li>
                  <li><a href="/api" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>API</a></li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>Community</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <li><a href="https://twitter.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Twitter</a></li>
                  <li><a href="https://discord.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Discord</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div style={{ paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
            <p>© 2026 Anchrion. All rights reserved.</p>
            <p>Built with The Graph · Hedera · 0G</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
