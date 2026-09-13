import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Anchrion — Wallet permission scanner and incident reconstruction',
  description:
    'Find every token permission your wallet has granted, see which ones are dangerous, revoke them, and reconstruct how funds left if a permission was already used.',
  icons: {
    /*
     * ?v=2 is not decoration. Browsers cache favicons harder than anything else
     * on a site and will keep showing the previous mark for a URL they already
     * have, even after the file changes — and unlike src/app/favicon.ico, which
     * Next serves under a content hash, a URL entry in metadata carries no hash
     * of its own. Bump the version when the mark changes again.
     */
    icon: [
      { url: '/favicon.png?v=2', sizes: 'any', type: 'image/png' },
      { url: '/favicon.ico', sizes: '64x64' },
    ],
    apple: { url: '/logo.png?v=2', sizes: '512x512', type: 'image/png' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png?v=2" sizes="any" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png?v=2" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
