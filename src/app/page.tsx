'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) router.push('/dashboard');
  }, [isConnected, router]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50" style={{ background: 'rgba(8,9,13,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Anchrion" className="w-8 h-8 rounded-lg" />
            <span className="text-[15px] font-semibold tracking-tight">Anchrion</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how" className="hover:text-white transition-colors">How It Works</a>
            <a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-16 text-center">
        <img src="/logo.png" alt="Anchrion" className="w-[100px] h-[100px] rounded-[28px] mb-8 animate-fade-up" />

        <h1
          className="text-[clamp(36px,6vw,72px)] font-bold leading-[1.05] tracking-tight mb-6 animate-fade-up max-w-[800px]"
          style={{ animationDelay: '0.1s', opacity: 0 }}
        >
          Your Wallet Never Sleeps.
          <br />
          <span style={{ color: 'var(--blue)' }}>Neither Does Anchrion.</span>
        </h1>

        <p
          className="text-[clamp(15px,2vw,18px)] max-w-[540px] mb-10 animate-fade-up"
          style={{ animationDelay: '0.2s', opacity: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}
        >
          AI-powered guardian that monitors, explains, and protects your wallet approvals across multiple chains.
          Catch dangerous contracts before they drain your funds.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="px-8 py-3.5 rounded-[var(--radius-md)] font-semibold text-[15px] text-white transition-all duration-200 hover:-translate-y-0.5 animate-fade-up"
          style={{ animationDelay: '0.3s', opacity: 0, background: 'var(--blue)', boxShadow: '0 0 24px rgba(26,115,232,0.3)' }}
        >
          Connect Wallet
        </button>

        <div className="mt-16 flex items-center gap-6 text-[13px] animate-fade-up" style={{ animationDelay: '0.4s', opacity: 0, color: 'var(--text-tertiary)' }}>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-safe)]" />Ethereum</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-safe)]" />Base</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-safe)]" />Arbitrum</span>
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-safe)]" />Optimism</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-[1200px] mx-auto">
          <h2 className="text-[32px] font-bold text-center mb-4">Why Anchrion?</h2>
          <p className="text-center text-[15px] mb-16 max-w-[480px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Not a scanner. Not a reporter. A bodyguard that catches threats before they happen.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: '🛡️', title: 'Real-time Monitor', desc: 'Catches new approvals the moment they happen. Never miss a dangerous contract.' },
              { icon: '🧠', title: 'AI Risk Analysis', desc: 'Explains in plain English why an approval is dangerous. No Solidity needed.' },
              { icon: '⚡', title: 'One-Click Revoke', desc: 'Revoke dangerous approvals with a single click. Gas-optimized transactions.' },
              { icon: '🔒', title: 'Encrypted Memory', desc: 'Remembers your approval history. Tracks changes over time. Data stays private.' },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-[var(--radius-lg)] border transition-all duration-200 hover:-translate-y-0.5" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
                <div className="text-[28px] mb-4">{f.icon}</div>
                <h3 className="text-[16px] font-semibold mb-2">{f.title}</h3>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-[32px] font-bold text-center mb-16">How It Works</h2>
          {[
            { n: 1, t: 'Connect Your Wallet', d: 'Connect MetaMask, Coinbase Wallet, or any Web3 wallet. No private keys needed.' },
            { n: 2, t: 'Scan Approvals', d: 'Anchrion fetches all token approvals from The Graph across multiple chains.' },
            { n: 3, t: 'Understand the Risk', d: 'AI explains each approval in plain English. See which contracts can drain your wallet.' },
            { n: 4, t: 'Protect Yourself', d: 'One-click revoke dangerous approvals. Anchrion remembers so you don\'t have to.' },
          ].map((s) => (
            <div key={s.n} className="flex gap-5 mb-10 last:mb-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white" style={{ background: 'var(--blue)' }}>
                {s.n}
              </div>
              <div className="pt-1">
                <h3 className="text-[17px] font-semibold mb-1">{s.t}</h3>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-10 mb-10">
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
                <h4 className="text-[13px] font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Product</h4>
                <ul className="space-y-2 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                  <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#how" className="hover:text-white transition-colors">How It Works</a></li>
                  <li><a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[13px] font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Developers</h4>
                <ul className="space-y-2 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                  <li><a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
                  <li><a href="/docs" className="hover:text-white transition-colors">Documentation</a></li>
                  <li><a href="/api" className="hover:text-white transition-colors">API Reference</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-[13px] font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Community</h4>
                <ul className="space-y-2 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                  <li><a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter</a></li>
                  <li><a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a></li>
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
