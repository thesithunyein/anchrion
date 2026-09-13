import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anchrion — page not found',
};

/**
 * The 404.
 *
 * Without this file Next serves its own built-in error page, which paints itself
 * dark and ignores the document background — so a mistyped URL rendered as a
 * black screen with the app's graph grid showing through it as white lines. This
 * is the same paper, type and language as every other page, and it says what the
 * two real destinations are instead of dead-ending.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <img
          src="/logo.svg"
          alt=""
          width={56}
          height={56}
          style={{ display: 'block', margin: '0 auto 22px' }}
        />
        <p className="kicker" style={{ marginBottom: 12 }}>404</p>
        <h1 className="display" style={{ fontSize: 'clamp(26px,4vw,38px)', marginBottom: 14 }}>
          Nothing at this address
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7 }}>
          That page does not exist. Anchrion has two: a wallet permission scanner, and the
          risk model it scores with.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
          <a className="btn-primary" href="/dashboard">
            Open the dashboard
          </a>
          <a
            href="/method"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 22px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--line)',
              background: 'var(--card)',
              boxShadow: 'var(--sh-pill)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Read the risk model
          </a>
        </div>
      </div>
    </main>
  );
}
