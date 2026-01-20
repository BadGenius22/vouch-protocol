'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { WalletButton } from '@/components/wallet/wallet-button';
import { cn } from '@/lib/utils';
import { Menu, X, Code2, TrendingUp, Home, Gift } from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Use Intersection Observer instead of scroll listener (better performance)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When sentinel is not intersecting (scrolled past), header is scrolled
        setScrolled(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
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
    { href: '/whale', label: 'Whale', icon: TrendingUp },
    { href: '/airdrop', label: 'Airdrops', icon: Gift },
  ];

  // Memoized toggle handler to prevent unnecessary re-renders
  const handleMenuToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* Scroll sentinel - observed by IntersectionObserver */}
      <div ref={sentinelRef} className="absolute top-0 left-0 h-5 w-full pointer-events-none" aria-hidden="true" />
      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-[#000]/80 backdrop-blur-xl border-b border-white/10'
            : 'bg-transparent border-b border-transparent'
        )}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center group-hover:bg-white/20 transition-all duration-300">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="text-xl font-semibold text-white">
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
                    ? 'text-white bg-white/10'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
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
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              )}
              onClick={handleMenuToggle}
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
            mobileMenuOpen ? 'max-h-64 border-t border-white/10' : 'max-h-0'
          )}
        >
          <div className="bg-[#000]/95 backdrop-blur-xl">
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
              <Link
                href="/"
                className={cn(
                  'px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-3',
                  pathname === '/'
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-400 hover:bg-white/5 hover:text-white'
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
                      ? 'bg-white/10 text-white'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
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
    </>
  );
}
