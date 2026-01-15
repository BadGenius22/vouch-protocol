'use client';

import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut } from 'lucide-react';

export function WalletButton() {
  const { setVisible } = useWalletModal();
  const { publicKey, disconnect, connecting } = useWallet();

  if (publicKey) {
    const addr = publicKey.toBase58();
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="font-mono"
          aria-label={`Connected wallet: ${addr}`}
        >
          {addr.slice(0, 4)}...{addr.slice(-4)}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={disconnect}
          aria-label="Disconnect wallet"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => setVisible(true)}
      disabled={connecting}
      aria-busy={connecting}
      aria-label={connecting ? 'Connecting to wallet...' : 'Connect wallet'}
    >
      <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
      {connecting ? 'Connecting...' : 'Connect'}
    </Button>
  );
}
