import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Private Airdrops | Vouch Protocol',
  description: 'Claim airdrops anonymously with zero-knowledge proofs. Sybil-resistant token distribution on Solana with hidden amounts via ShadowWire.',
  openGraph: {
    title: 'Private Airdrops | Vouch Protocol',
    description: 'Claim airdrops anonymously with zero-knowledge proofs. Sybil-resistant token distribution on Solana.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Private Airdrops | Vouch Protocol',
    description: 'Sybil-resistant private airdrops on Solana.',
    images: ['/og-image.png'],
  },
};

export default function AirdropLayout({ children }: { children: React.ReactNode }) {
  return children;
}
