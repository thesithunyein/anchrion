'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard');
    }
  }, [isConnected, router]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--blue-subtle)] to-transparent opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--blue-primary)] rounded-full blur-[150px] opacity-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--blue-light)] rounded-full blur-[150px] opacity-10 animate-pulse" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" rx="20" fill="#1a73e8" />
            <path d="M30 70L50 30L70 70" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M38 55H62" stroke="white" strokeWidth="6" strokeLinecap="round" />
          </svg>
          <span className="text-xl font-semibold">Anchrion</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-[var(--text-secondary)] hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-[var(--text-secondary)] hover:text-white transition-colors">How It Works</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-white transition-colors">GitHub</a>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-center">
        <div className="mb-6">
          <svg width="120" height="120" viewBox="0 0 100 100" fill="none" className="animate-fade-in">
            <rect width="100" height="100" rx="20" fill="#1a73e8" />
            <path d="M30 70L50 30L70 70" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M38 55H62" stroke="white" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          Your Wallet Never Sleeps.
          <br />
          <span className="text-[var(--blue-primary)]">Neither Does Anchrion.</span>
        </h1>

        <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          AI-powered guardian that monitors, explains, and protects your wallet approvals across multiple chains. 
          Catch dangerous contracts before they drain your funds.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="px-8 py-4 bg-[var(--blue-primary)] text-white font-semibold rounded-[var(--radius-md)] 
                     hover:bg-[var(--blue-light)] hover:shadow-[var(--shadow-glow)] 
                     transition-all duration-300 transform hover:-translate-y-1
                     animate-fade-in"
          style={{ animationDelay: '0.3s' }}
        >
          Connect Wallet
        </button>

        <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-[var(--text-tertiary)] animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--risk-safe)]" />
            Ethereum
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--risk-safe)]" />
            Base
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--risk-safe)]" />
            Arbitrum
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--risk-safe)]" />
            Optimism
          </span>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-24 px-6 md:px-12">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Why Anchrion?
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <FeatureCard
            icon="🛡️"
            title="Real-time Monitor"
            description="Watches every approval the moment it happens. Never miss a new contract."
          />
          <FeatureCard
            icon="🧠"
            title="AI Risk Analysis"
            description="Explains in plain English why an approval is dangerous. No Solidity knowledge needed."
          />
          <FeatureCard
            icon="⚡"
            title="One-Click Revoke"
            description="Revoke dangerous approvals with a single click. Gas-optimized transactions."
          />
          <FeatureCard
            icon="🔒"
            title="Encrypted Memory"
            description="Remembers your approval history. Tracks changes over time. Your data stays private."
          />
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 py-24 px-6 md:px-12 bg-[var(--bg-secondary)]">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          How It Works
        </h2>
        <div className="max-w-4xl mx-auto space-y-8">
          <Step number={1} title="Connect Your Wallet" description="Connect MetaMask, Rainbow, or any Web3 wallet. No private keys needed." />
          <Step number={2} title="Scan Approvals" description="Anchrion fetches all token approvals from The Graph across multiple chains." />
          <Step number={3} title="Understand the Risk" description="AI explains each approval in plain English. See which contracts can drain your wallet." />
          <Step number={4} title="Protect Yourself" description="One-click revoke dangerous approvals. Anchrion remembers so you don't have to." />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 glass border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="max-w-xs">
              <div className="flex items-center gap-3 mb-4">
                <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
                  <rect width="100" height="100" rx="20" fill="#1a73e8" />
                  <path d="M30 70L50 30L70 70" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M38 55H62" stroke="white" strokeWidth="6" strokeLinecap="round" />
                </svg>
                <span className="text-lg font-semibold">Anchrion</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                Your wallet&apos;s AI bodyguard. Monitor, explain, and protect your token approvals.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-semibold mb-4 text-[var(--text-heading)]">Product</h3>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                  <li><a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4 text-[var(--text-heading)]">Developers</h3>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
                  <li><a href="/docs" className="hover:text-white transition-colors">Documentation</a></li>
                  <li><a href="/api" className="hover:text-white transition-colors">API Reference</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-4 text-[var(--text-heading)]">Community</h3>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li><a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter</a></li>
                  <li><a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a></li>
                  <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="wave-divider my-8" />

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[var(--text-tertiary)]">
            <p>© 2026 Anchrion. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span>Built with The Graph + Hedera + 0G</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] 
                    hover:border-[var(--border-hover)] hover:shadow-[var(--shadow-md)] 
                    transition-all duration-300">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-6">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--blue-primary)] flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-[var(--text-secondary)]">{description}</p>
      </div>
    </div>
  );
}
