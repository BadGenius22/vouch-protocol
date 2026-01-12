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
        <Button variant="outline" size="sm" className="font-mono">
          {addr.slice(0, 4)}...{addr.slice(-4)}
        </Button>
        <Button variant="ghost" size="icon" onClick={disconnect} title="Disconnect">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={() => setVisible(true)} disabled={connecting}>
      <Wallet className="mr-2 h-4 w-4" />
      {connecting ? 'Connecting...' : 'Connect'}
    </Button>
  );
}
