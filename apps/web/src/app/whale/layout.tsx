import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Whale Verification | Vouch Protocol',
  description: 'Prove your trading volume anonymously. Verify whale status on Solana without revealing your wallet address or trading history.',
  openGraph: {
    title: 'Whale Verification | Vouch Protocol',
    description: 'Prove your trading volume anonymously. Verify whale status on Solana without revealing your wallet address.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Whale Verification | Vouch Protocol',
    description: 'Prove your trading volume anonymously on Solana.',
    images: ['/og-image.png'],
  },
};

export default function WhaleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
