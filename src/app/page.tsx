'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
  useEffect(() => { if (isConnected) router.push('/dashboard'); }, [isConnected, router]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Anchrion" className="w-8 h-8 rounded-lg" />
            <span className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>Anchrion</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
            <a href="#features" className="hover:text-black transition-colors">Features</a>
            <a href="#how" className="hover:text-black transition-colors">How It Works</a>
            <a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">GitHub</a>
            <a href="/dashboard" className="px-4 py-2 rounded-lg font-medium text-white" style={{ background: 'var(--blue)' }}>Open App</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-16 text-center">
        <p className="text-[13px] font-medium tracking-wide uppercase mb-6 animate-fade-up" style={{ color: 'var(--blue)', animationDelay: '0s', opacity: 0 }}>
          Wallet Security, Reimagined
        </p>
        <h1 className="text-[clamp(36px,6vw,64px)] font-bold leading-[1.08] tracking-tight mb-6 animate-fade-up max-w-[700px]" style={{ animationDelay: '0.1s', opacity: 0 }}>
          Your Wallet Never Sleeps.
          <br />
          <span style={{ color: 'var(--blue)' }}>Neither Does Anchrion.</span>
        </h1>
        <p className="text-[17px] max-w-[500px] mb-10 animate-fade-up" style={{ animationDelay: '0.2s', opacity: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          AI-powered guardian that monitors, explains, and protects your wallet approvals. Catch dangerous contracts before they drain your funds.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-7 py-3 rounded-lg font-semibold text-[15px] text-white transition-all duration-200 hover:opacity-90 animate-fade-up"
          style={{ animationDelay: '0.3s', opacity: 0, background: 'var(--blue)' }}
        >
          Connect Wallet
        </button>
        <p className="mt-5 text-[13px] animate-fade-up" style={{ animationDelay: '0.4s', opacity: 0, color: 'var(--text-tertiary)' }}>
          Ethereum · Base · Arbitrum · Optimism
        </p>
      </section>

      {/* Stats Banner */}
      <section style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1200px] mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '$3.4B', label: 'Stolen from wallets in 2025' },
            { value: '98%', label: 'Drop in monthly hack losses' },
            { value: '4', label: 'Chains supported' },
            { value: '<1s', label: 'Approval detection time' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-[28px] font-bold mb-1" style={{ color: 'var(--blue)' }}>{s.value}</p>
              <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <p className="text-[13px] font-medium tracking-wide uppercase text-center mb-3" style={{ color: 'var(--blue)' }}>Features</p>
          <h2 className="text-[32px] font-bold text-center mb-4">Why Anchrion?</h2>
          <p className="text-center text-[15px] mb-16 max-w-[460px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Not a scanner. Not a reporter. A bodyguard that catches threats before they happen.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '🛡️', title: 'Real-time Monitor', desc: 'Catches new approvals the moment they happen. Never miss a dangerous contract.' },
              { icon: '🧠', title: 'AI Risk Analysis', desc: 'Explains in plain English why an approval is dangerous. No Solidity knowledge needed.' },
              { icon: '⚡', title: 'One-Click Revoke', desc: 'Revoke dangerous approvals with a single click. Gas-optimized transactions.' },
              { icon: '🔗', title: 'Multi-Chain', desc: 'Works across Ethereum, Base, Arbitrum, and Optimism. One dashboard for all.' },
              { icon: '🔒', title: 'Encrypted Memory', desc: 'Remembers your approval history. Tracks changes over time. Data stays private.' },
              { icon: '💰', title: 'Pay-per-Scan', desc: 'Premium deep analysis via x402 on Hedera. Pay only when you need deeper insight.' },
            ].map(f => (
              <div key={f.title} className="p-6 rounded-xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ borderColor: 'var(--border)' }}>
                <div className="text-[28px] mb-4">{f.icon}</div>
                <h3 className="text-[16px] font-semibold mb-2">{f.title}</h3>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-24 px-6" style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[600px] mx-auto">
          <p className="text-[13px] font-medium tracking-wide uppercase text-center mb-3" style={{ color: 'var(--blue)' }}>How It Works</p>
          <h2 className="text-[32px] font-bold text-center mb-16">Four steps to safety</h2>
          {[
            { n: 1, t: 'Connect Your Wallet', d: 'Connect MetaMask, Coinbase Wallet, or any Web3 wallet. No private keys needed.' },
            { n: 2, t: 'Scan Approvals', d: 'Anchrion fetches all token approvals from The Graph across multiple chains.' },
            { n: 3, t: 'Understand the Risk', d: 'AI explains each approval in plain English. See which contracts can drain your wallet.' },
            { n: 4, t: 'Protect Yourself', d: 'One-click revoke dangerous approvals. Anchrion remembers so you don\'t have to.' },
          ].map(s => (
            <div key={s.n} className="flex gap-5 mb-10 last:mb-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white" style={{ background: 'var(--blue)' }}>{s.n}</div>
              <div className="pt-1.5">
                <h3 className="text-[17px] font-semibold mb-1">{s.t}</h3>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-[32px] font-bold mb-4">Ready to protect your wallet?</h2>
        <p className="text-[15px] mb-8" style={{ color: 'var(--text-secondary)' }}>Connect your wallet in seconds. No signup required.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-8 py-3.5 rounded-lg font-semibold text-[15px] text-white transition-all hover:opacity-90"
          style={{ background: 'var(--blue)' }}
        >
          Get Started
        </button>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-10 mb-8">
            <div className="max-w-[280px]">
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/logo.png" alt="Anchrion" className="w-7 h-7 rounded-lg" />
                <span className="text-[15px] font-semibold">Anchrion</span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Your wallet&apos;s AI bodyguard. Monitor, explain, and protect your token approvals.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-16">
              <div>
                <h4 className="text-[12px] font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Product</h4>
                <ul className="space-y-2 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                  <li><a href="#features" className="hover:text-black transition-colors">Features</a></li>
                  <li><a href="#how" className="hover:text-black transition-colors">How It Works</a></li>
                  <li><a href="/dashboard" className="hover:text-black transition-colors">Dashboard</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[12px] font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Developers</h4>
                <ul className="space-y-2 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                  <li><a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">GitHub</a></li>
                  <li><a href="/docs" className="hover:text-black transition-colors">Documentation</a></li>
                  <li><a href="/api" className="hover:text-black transition-colors">API</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[12px] font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Community</h4>
                <ul className="space-y-2 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                  <li><a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Twitter</a></li>
                  <li><a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Discord</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-[13px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
            <p>© 2026 Anchrion. All rights reserved.</p>
            <p>Built with The Graph · Hedera · 0G</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
