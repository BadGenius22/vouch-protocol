import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developer Verification | Vouch Protocol',
  description: 'Prove your developer credentials anonymously. Verify deployed programs and TVL on Solana without revealing your wallet address.',
  openGraph: {
    title: 'Developer Verification | Vouch Protocol',
    description: 'Prove your developer credentials anonymously. Verify deployed programs and TVL on Solana without revealing your wallet address.',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Developer Verification | Vouch Protocol',
    description: 'Prove your developer credentials anonymously on Solana.',
    images: ['/og-image.png'],
  },
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return children;
}
