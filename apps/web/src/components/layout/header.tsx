'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from '@/components/wallet/wallet-button';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-primary">Vouch</Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/developer" className={cn('text-sm transition-colors hover:text-foreground', pathname === '/developer' ? 'text-foreground font-medium' : 'text-muted-foreground')}>Developer</Link>
            <Link href="/whale" className={cn('text-sm transition-colors hover:text-foreground', pathname === '/whale' ? 'text-foreground font-medium' : 'text-muted-foreground')}>Whale</Link>
          </nav>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}
