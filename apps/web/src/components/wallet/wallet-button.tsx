'use client';

import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { useWalletReady } from '@/components/providers';

export function WalletButton() {
  const walletReady = useWalletReady();

  // Show placeholder during SSR or before wallet providers mount
  if (!walletReady) {
    return (
      <Button
        disabled
        aria-label="Loading wallet..."
        className="bg-white text-black rounded-xl px-4 py-2 text-sm font-medium"
      >
        <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
        Connect
      </Button>
    );
  }

  return (
    <UnifiedWalletButton
      buttonClassName="!bg-white !text-black hover:!bg-white/90 !rounded-xl !px-4 !py-2 !text-sm !font-medium !transition-colors !border !border-white/10"
      currentUserClassName="!bg-white/10 !text-white !rounded-xl !px-3 !py-2 !text-sm !font-mono !border !border-white/20"
    />
  );
}
