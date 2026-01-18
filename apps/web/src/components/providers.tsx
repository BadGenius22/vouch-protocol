'use client';

import { useEffect, useState, useMemo, createContext, useContext } from 'react';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { Connection, clusterApiUrl } from '@solana/web3.js';

// Context to track if wallet providers are ready
const WalletReadyContext = createContext(false);
export const useWalletReady = () => useContext(WalletReadyContext);

// Connection context for Solana RPC
const ConnectionContext = createContext<Connection | null>(null);
export const useSolanaConnection = () => {
  const connection = useContext(ConnectionContext);
  if (!connection) {
    throw new Error('useSolanaConnection must be used within Providers');
  }
  return connection;
};

export function Providers({ children }: { children: React.ReactNode }) {
  // Track client-side mounting to prevent SSR issues with wallet adapter
  const [mounted, setMounted] = useState(false);

  // Create connection once
  const connection = useMemo(() => {
    const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      clusterApiUrl((process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'mainnet-beta' | 'devnet') || 'devnet');
    return new Connection(endpoint, 'confirmed');
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Preload Noir circuits in the background for better UX
  useEffect(() => {
    if (!mounted) return;

    const preloadCircuits = async () => {
      try {
        const { preloadCircuits: preload } = await import('@/lib/circuit');
        await preload();
      } catch (error) {
        console.warn('[Vouch] Circuit preload failed:', error);
      }
    };

    const timeoutId = setTimeout(preloadCircuits, 1000);
    return () => clearTimeout(timeoutId);
  }, [mounted]);

  // During SSR or before mount, render children without wallet context
  // Components using wallet hooks should check useWalletReady() first
  if (!mounted) {
    return (
      <WalletReadyContext.Provider value={false}>
        {children}
      </WalletReadyContext.Provider>
    );
  }

  return (
    <WalletReadyContext.Provider value={true}>
      <ConnectionContext.Provider value={connection}>
        <UnifiedWalletProvider
          wallets={[]}
          config={{
            autoConnect: false,
            env: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'mainnet-beta' | 'devnet') || 'devnet',
            metadata: {
              name: 'Vouch Protocol',
              description: 'Zero-knowledge reputation proofs on Solana',
              url: 'https://vouch.dev',
              iconUrls: ['/logo.png'],
            },
            walletlistExplanation: {
              href: 'https://station.jup.ag/docs/additional-topics/wallet-list',
            },
            theme: 'dark',
            lang: 'en',
          }}
        >
          {children}
        </UnifiedWalletProvider>
      </ConnectionContext.Provider>
    </WalletReadyContext.Provider>
  );
}
