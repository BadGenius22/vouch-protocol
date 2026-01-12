'use client';

import { useMemo, useEffect } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork) || WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  // Preload Noir circuits in the background for better UX
  // This initializes WASM and caches circuits before user needs them
  useEffect(() => {
    const preloadCircuits = async () => {
      try {
        // Dynamic import to avoid SSR issues with WASM
        const { preloadCircuits: preload } = await import('@/lib/circuit');
        await preload();
      } catch (error) {
        // Preloading is best-effort, don't block on errors
        console.warn('[Vouch] Circuit preload failed:', error);
      }
    };

    // Delay preloading to not block initial render
    const timeoutId = setTimeout(preloadCircuits, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
