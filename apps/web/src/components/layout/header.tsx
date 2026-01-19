'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WalletButton } from '@/components/wallet/wallet-button';
import { cn } from '@/lib/utils';
import { Menu, X, Code2, Wallet, Home, Gift } from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    // Close menu when pathname changes (runs after navigation completes)
    // This is intentional - we're resetting UI state based on navigation
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/developer', label: 'Developer', icon: Code2 },
    { href: '/whale', label: 'Whale', icon: Wallet },
    { href: '/airdrop', label: 'Airdrops', icon: Gift },
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-primary/5'
          : 'bg-transparent border-b border-transparent'
      )}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center group-hover:bg-primary/30 group-hover:border-primary/50 transition-all duration-300 group-hover:shadow-neon-cyan">
            <span className="text-primary font-display font-bold text-sm">V</span>
          </div>
          <span className="text-xl font-display font-bold text-primary text-glow-cyan">
            Vouch
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg flex items-center gap-2',
                pathname === href
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/5'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {pathname === href && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary shadow-[0_0_10px_rgba(0,255,255,0.8)]" />
              )}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <WalletButton />

          {/* Mobile Menu Toggle */}
          <button
            className={cn(
              'md:hidden p-2 rounded-lg transition-all duration-300',
              mobileMenuOpen
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
            )}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'md:hidden overflow-hidden transition-all duration-300',
          mobileMenuOpen ? 'max-h-64 border-t border-border/50' : 'max-h-0'
        )}
      >
        <div className="bg-background/95 backdrop-blur-xl">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
            <Link
              href="/"
              className={cn(
                'px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-3',
                pathname === '/'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-3',
                  pathname === href
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {label} Proof
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
