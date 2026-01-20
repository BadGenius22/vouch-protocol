import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Header } from '@/components/layout/header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Vouch Protocol - Anonymous Reputation Proofs',
  description:
    'Prove your on-chain credentials without revealing your identity. Zero-knowledge proofs on Solana.',
  keywords: ['ZK proofs', 'Solana', 'anonymous', 'reputation', 'blockchain', 'privacy'],
  icons: {
    icon: '/logos/vouch-icon.svg',
    shortcut: '/logos/vouch-icon.svg',
    apple: '/logos/vouch-icon.svg',
  },
  openGraph: {
    title: 'Vouch Protocol - Anonymous Reputation Proofs',
    description:
      'Prove your on-chain credentials without revealing your identity. Zero-knowledge proofs on Solana.',
    url: 'https://vouch-protocol.vercel.app',
    siteName: 'Vouch Protocol',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vouch Protocol - Anonymous Reputation Proofs on Solana',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vouch Protocol - Anonymous Reputation Proofs',
    description:
      'Prove your on-chain credentials without revealing your identity. Zero-knowledge proofs on Solana.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <Providers>
          <Header />
          <main className="min-h-screen bg-background">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
