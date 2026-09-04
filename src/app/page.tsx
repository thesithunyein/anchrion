'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const footerColumns = [
  { title: 'Features', links: ['Real-time Monitor', 'Risk Analysis', 'One-Click Revoke', 'Multi-Chain Support'] },
  { title: 'Developers', links: ['Documentation', 'API Reference', 'GitHub', 'Smart Contracts'] },
  { title: 'Company', links: ['About', 'Blog', 'Privacy Policy', 'Terms of Service'] },
];

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const entered = useRef(false);

  useEffect(() => {
    if (isConnected) router.push('/dashboard');
  }, [isConnected, router]);

  // Entrance animations (Nexeus-style)
  useEffect(() => {
    if (entered.current) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    root.classList.add('js-enter');

    const EXPO = 'cubic-bezier(.16,1,.3,1)';
    const SOFT = 'cubic-bezier(.22,.65,.28,1)';
    const isMobile = window.innerWidth <= 648;
    const d = isMobile ? 0.62 : 1;
    const t = isMobile ? 0.85 : 1;

    const anims: Animation[] = [];

    const animate = (sel: string, keyframes: Keyframe[], opts: (number | string)[]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const [dur, delay, easing] = opts;
      const a = el.animate(keyframes, {
        duration: Number(dur),
        delay: Number(delay) * t,
        easing: String(easing),
        fill: 'forwards',
      });
      anims.push(a);
    };

    // Eyebrow
    animate('.hero-eyebrow', [
      { opacity: 0, transform: `translateY(${12 * d}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ], [560, 60, SOFT]);

    // Headline reveal
    animate('.hero-title', [
      { opacity: 0, transform: `translateY(${40 * d}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ], [950, 170, EXPO]);

    // Description
    animate('.hero-desc', [
      { opacity: 0, transform: `translateY(${14 * d}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ], [660, 430, SOFT]);

    // CTA
    animate('.hero-cta', [
      { opacity: 0, transform: `translateY(${12 * d}px) scale(0.985)` },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], [580, 620, 'cubic-bezier(.33,1,.68,1)']);

    // Footer brand
    animate('.footer-brand', [
      { opacity: 0, transform: `translateY(${10 * d}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ], [540, 600, SOFT]);

    // Footer tagline
    animate('.footer-tagline', [
      { opacity: 0, transform: `translateY(${10 * d}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ], [540, 670, SOFT]);

    // Footer columns
    document.querySelectorAll('.footer-col').forEach((_, i) => {
      animate(`.footer-col:nth-child(${i + 1})`, [
        { opacity: 0, transform: `translateY(${14 * d}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ], [580, 720 + i * 70, SOFT]);
    });

    // Footer rule
    animate('.footer-rule', [
      { transform: 'scaleX(0)' },
      { transform: 'scaleX(1)' },
    ], [720, 980, EXPO]);

    // Legal
    animate('.footer-legal', [
      { opacity: 0, transform: `translateY(${8 * d}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ], [500, 1120, SOFT]);

    // Socials
    document.querySelectorAll('.footer-socials a').forEach((_, i) => {
      animate(`.footer-socials a:nth-child(${i + 1})`, [
        { opacity: 0, transform: `translateY(${8 * d}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ], [500, 1170 + i * 60, SOFT]);
    });

    // On complete: remove js-enter
    const lastDelay = 1170 + 2 * 60 + 500;
    setTimeout(() => {
      root.classList.remove('js-enter');
      anims.forEach(a => a.cancel());
      entered.current = true;
    }, lastDelay * t + 200);
  }, []);

  return (
    <div className="viewport">
      {/* Background */}
      <div className="bg" />

      {/* Hero Content */}
      <div className="stage">
        <p className="hero-eyebrow anim-target">Wallet Security, Reimagined</p>
        <h1 className="hero-title anim-target">
          Your wallet never sleeps.<br />
          <span>Neither does Anchrion.</span>
        </h1>
        <p className="hero-desc anim-target">
          AI-powered guardian that monitors, explains, and protects your wallet approvals. Catch dangerous contracts before they drain your funds.
        </p>
        <button onClick={() => router.push('/dashboard')} className="hero-cta anim-target">
          Get started
        </button>
        <div className="hero-chains anim-target" style={{ opacity: 0 }}>
          <span>Ethereum</span>
          <span>·</span>
          <span>Base</span>
          <span>·</span>
          <span>Arbitrum</span>
          <span>·</span>
          <span>Optimism</span>
        </div>
      </div>

      {/* Glass Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div>
              <div className="footer-brand anim-target">
                <img src="/logo.png" alt="Anchrion" />
                <span>Anchrion</span>
              </div>
              <p className="footer-tagline anim-target">
                Your wallet&apos;s AI bodyguard. Monitor, explain, and protect your token approvals across multiple chains.
              </p>
            </div>
            <nav className="footer-nav">
              {footerColumns.map(col => (
                <div key={col.title} className="footer-col anim-target">
                  <h4>{col.title}</h4>
                  <ul>
                    {col.links.map(l => (
                      <li key={l}><a href="#">{l}</a></li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
          <div className="footer-rule anim-target" />
          <div className="footer-bottom">
            <p className="footer-legal anim-target">© 2026 Anchrion. All rights reserved.</p>
            <div className="footer-socials">
              <a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="anim-target">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="anim-target">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="anim-target">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
