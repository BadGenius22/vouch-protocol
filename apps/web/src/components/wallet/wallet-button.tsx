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
      <Button disabled aria-label="Loading wallet...">
        <Wallet className="mr-2 h-4 w-4" aria-hidden="true" />
        Connect
      </Button>
    );
  }

  return (
    <UnifiedWalletButton
      buttonClassName="!bg-primary !text-primary-foreground hover:!bg-primary/90 !rounded-md !px-4 !py-2 !text-sm !font-medium !transition-colors"
      currentUserClassName="!bg-muted !text-foreground !rounded-md !px-3 !py-2 !text-sm !font-mono"
    />
  );
}
