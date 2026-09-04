import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Anchrion — Your Wallet\'s AI Bodyguard',
  description: 'AI-powered guardian that monitors, explains, and protects your wallet approvals across multiple chains.',
  keywords: ['wallet', 'security', 'blockchain', 'ethereum', 'token', 'approval', 'AI', 'guardian'],
  openGraph: {
    title: 'Anchrion — Your Wallet\'s AI Bodyguard',
    description: 'AI-powered guardian that monitors, explains, and protects your wallet approvals across multiple chains.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
