'use client';

import Link from 'next/link';
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { HeroCanvas } from '@/components/three/hero-canvas';
import { GlowButton } from '@/components/ui/glow-button';
import { GlowCard, GlowCardHeader, GlowCardTitle, GlowCardDescription, GlowCardContent } from '@/components/ui/glow-card';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { Shield, Code2, Wallet, ChevronDown, Zap, Lock, Eye, Github, ArrowRight, Gift } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Hero animations with stagger
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      heroTl
        .from('.hero-badge', { opacity: 0, y: -20, duration: 0.6 })
        .from(
          '.hero-title-word',
          {
            opacity: 0,
            y: 60,
            rotateX: -40,
            stagger: 0.12,
            duration: 0.8,
          },
          '-=0.3'
        )
        .from('.hero-subtitle', { opacity: 0, y: 30, duration: 0.6 }, '-=0.4')
        .from(
          '.hero-buttons > *',
          {
            opacity: 0,
            y: 20,
            stagger: 0.15,
            duration: 0.5,
          },
          '-=0.2'
        )
        .from('.scroll-indicator', { opacity: 0, y: -20, duration: 0.5 }, '-=0.1');

      // Stats section with scroll trigger
      gsap.from('.stat-item', {
        scrollTrigger: {
          trigger: '.stats-section',
          start: 'top 85%',
        },
        opacity: 0,
        scale: 0.8,
        stagger: 0.15,
        duration: 0.6,
      });

      // Features section with scroll trigger
      gsap.from('.feature-card', {
        scrollTrigger: {
          trigger: '.features-section',
          start: 'top 80%',
        },
        opacity: 0,
        y: 60,
        stagger: 0.2,
        duration: 0.8,
        ease: 'power3.out',
      });

      // Use cases section
      gsap.from('.use-case-card', {
        scrollTrigger: {
          trigger: '.use-cases-section',
          start: 'top 75%',
        },
        opacity: 0,
        x: (i) => (i === 0 ? -50 : 50),
        stagger: 0.2,
        duration: 0.8,
      });

      // How it works section
      gsap.from('.step-card', {
        scrollTrigger: {
          trigger: '.how-it-works-section',
          start: 'top 70%',
        },
        opacity: 0,
        y: 40,
        stagger: 0.15,
        duration: 0.6,
      });

      // CTA section
      gsap.from('.cta-content', {
        scrollTrigger: {
          trigger: '.cta-section',
          start: 'top 80%',
        },
        opacity: 0,
        y: 40,
        duration: 0.8,
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center">
        <HeroCanvas />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />

        <div className="container mx-auto px-4 relative z-10 text-center">
          {/* Badge */}
          <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-sm mb-8">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-neon-cyan" />
            <span className="text-sm text-primary font-mono">Zero-Knowledge Proofs on Solana</span>
          </div>

          {/* Title with split text animation */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-bold mb-6 leading-tight">
            <span className="hero-title-word inline-block">Prove</span>{' '}
            <span className="hero-title-word inline-block text-primary text-glow-cyan">Without</span>{' '}
            <span className="hero-title-word inline-block">Revealing</span>
          </h1>

          <p className="hero-subtitle text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Anonymous reputation proofs for developers and traders.
            <br />
            <span className="text-primary/80">Your credentials verified. Your identity protected.</span>
          </p>

          {/* CTA Buttons */}
          <div className="hero-buttons flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/developer">
              <GlowButton size="lg" glowColor="cyan">
                <Code2 className="mr-2 h-5 w-5" />
                Prove Developer Skills
                <ArrowRight className="ml-2 h-4 w-4" />
              </GlowButton>
            </Link>
            <Link href="/whale">
              <GlowButton size="lg" variant="outline" glowColor="purple">
                <Wallet className="mr-2 h-5 w-5" />
                Prove Trading Volume
              </GlowButton>
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="scroll-indicator absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-float">
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Explore</span>
            <ChevronDown className="w-5 h-5 text-primary" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section py-20 border-y border-border/30 bg-card/20 backdrop-blur-sm relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-10" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: 100, suffix: '%', label: 'Privacy Preserved' },
              { value: 0, suffix: ' data', label: 'Leaked to Verifiers', prefix: '' },
              { value: 2, suffix: 's', label: 'Proof Generation', prefix: '~' },
              { value: 100, suffix: '%', label: 'On-Chain Verified' },
            ].map((stat, i) => (
              <div key={i} className="stat-item text-center">
                <div className="text-4xl md:text-5xl font-display font-bold text-primary text-glow-cyan">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                </div>
                <p className="text-sm text-muted-foreground mt-2 font-mono">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
              Why <span className="text-primary text-glow-cyan">Vouch</span>?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-lg">
              Prove your on-chain achievements without compromising your privacy
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Lock,
                title: 'True Privacy',
                description:
                  'Your wallet address and transaction history remain completely hidden. Only the proof of your credentials is shared.',
                color: 'cyan' as const,
              },
              {
                icon: Zap,
                title: 'Client-Side Proofs',
                description:
                  'All ZK proofs are generated in your browser using cutting-edge cryptography. Your private data never leaves your device.',
                color: 'purple' as const,
              },
              {
                icon: Eye,
                title: 'On-Chain Verification',
                description:
                  'Proofs are verified and recorded on Solana. Anyone can verify your credentials without seeing your identity.',
                color: 'green' as const,
              },
            ].map((feature, i) => (
              <GlowCard key={i} className="feature-card p-8" glowColor={feature.color} hover>
                <div
                  className={`w-14 h-14 rounded-xl mb-6 flex items-center justify-center ${
                    feature.color === 'cyan'
                      ? 'bg-primary/10 border border-primary/20'
                      : feature.color === 'purple'
                        ? 'bg-secondary/10 border border-secondary/20'
                        : 'bg-accent/10 border border-accent/20'
                  }`}
                >
                  <feature.icon
                    className={`w-7 h-7 ${
                      feature.color === 'cyan'
                        ? 'text-primary'
                        : feature.color === 'purple'
                          ? 'text-secondary'
                          : 'text-accent'
                    }`}
                  />
                </div>
                <h3 className="text-xl font-display font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="use-cases-section py-24 bg-card/20 backdrop-blur-sm relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-5" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
              Built for <span className="text-secondary text-glow-purple">Builders</span>,{' '}
              <span className="text-accent text-glow-green">Traders</span> &{' '}
              <span className="text-primary text-glow-cyan">Projects</span>
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Developer Card */}
            <GlowCard className="use-case-card p-8" glowColor="cyan" hover>
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <Code2 className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold">For Developers</h3>
                  <p className="text-muted-foreground">Prove your building history anonymously</p>
                </div>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  'Deployed 3+ programs on Solana',
                  'Secured $100K+ TVL across programs',
                  'Get hired without revealing your wallet',
                  'Proof generated entirely in your browser',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-neon-cyan" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/developer">
                <GlowButton glowColor="cyan" className="w-full sm:w-auto">
                  Start Developer Proof
                  <ArrowRight className="ml-2 h-4 w-4" />
                </GlowButton>
              </Link>
            </GlowCard>

            {/* Whale Card */}
            <GlowCard className="use-case-card p-8" glowColor="purple" hover>
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                  <Wallet className="w-8 h-8 text-secondary" />
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold">For Traders</h3>
                  <p className="text-muted-foreground">Prove trading volume without exposure</p>
                </div>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  'Traded $50K+ volume in 30 days',
                  'Access exclusive trading pools',
                  'Maintain complete wallet privacy',
                  'Verified credentials on-chain',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-neon-purple" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/whale">
                <GlowButton variant="outline" glowColor="purple" className="w-full sm:w-auto">
                  Start Whale Proof
                  <ArrowRight className="ml-2 h-4 w-4" />
                </GlowButton>
              </Link>
            </GlowCard>

            {/* Airdrop Card */}
            <GlowCard className="use-case-card p-8" glowColor="green" hover>
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                  <Gift className="w-8 h-8 text-accent" />
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold">Private Airdrops</h3>
                  <p className="text-muted-foreground">Receive tokens anonymously</p>
                </div>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  'Register with your Vouch credential',
                  'Receive tokens via ShadowWire',
                  'Amounts hidden from everyone',
                  'Claim to any wallet privately',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-neon-green" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/airdrop">
                <GlowButton variant="outline" glowColor="green" className="w-full sm:w-auto">
                  Browse Airdrops
                  <ArrowRight className="ml-2 h-4 w-4" />
                </GlowButton>
              </Link>
            </GlowCard>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
              How It <span className="text-primary text-glow-cyan">Works</span>
            </h2>
            <p className="text-muted-foreground text-lg">Four simple steps to verified anonymity</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-16 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-primary/50 via-secondary/50 to-accent/50" />

            {[
              { step: 1, title: 'Connect', desc: 'Link your Solana wallet securely', icon: Wallet, color: 'cyan' },
              { step: 2, title: 'Fetch', desc: 'We pull your on-chain data privately', icon: Eye, color: 'cyan' },
              { step: 3, title: 'Prove', desc: 'ZK proof generated in your browser', icon: Shield, color: 'purple' },
              { step: 4, title: 'Verify', desc: 'Credential recorded on Solana', icon: Zap, color: 'green' },
            ].map((item) => (
              <div key={item.step} className="step-card relative">
                <GlowCard className="p-6 text-center h-full" glowColor={item.color as 'cyan' | 'purple' | 'green'}>
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                      item.color === 'cyan'
                        ? 'bg-primary/10 border border-primary/30'
                        : item.color === 'purple'
                          ? 'bg-secondary/10 border border-secondary/30'
                          : 'bg-accent/10 border border-accent/30'
                    }`}
                  >
                    <span
                      className={`text-xl font-display font-bold ${
                        item.color === 'cyan'
                          ? 'text-primary'
                          : item.color === 'purple'
                            ? 'text-secondary'
                            : 'text-accent'
                      }`}
                    >
                      {item.step}
                    </span>
                  </div>
                  <item.icon
                    className={`w-8 h-8 mx-auto mb-4 ${
                      item.color === 'cyan'
                        ? 'text-primary/60'
                        : item.color === 'purple'
                          ? 'text-secondary/60'
                          : 'text-accent/60'
                    }`}
                  />
                  <h3 className="text-lg font-display font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </GlowCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-10" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="cta-content max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">
              Ready to{' '}
              <span className="text-primary text-glow-cyan">Prove</span> Yourself?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
              Join the anonymous reputation revolution on Solana.
              <br />
              Your skills speak. Your identity stays hidden.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/developer">
                <GlowButton size="lg" glowColor="cyan">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </GlowButton>
              </Link>
              <a href="https://github.com/ArsCodeAmatworker/vouch-protocol" target="_blank" rel="noopener noreferrer">
                <GlowButton size="lg" variant="outline" glowColor="purple">
                  <Github className="mr-2 h-5 w-5" />
                  View on GitHub
                </GlowButton>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
                <span className="text-primary font-display font-bold text-xs">V</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Vouch Protocol &copy; {new Date().getFullYear()}
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/ArsCodeAmatworker/vouch-protocol"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Solana
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
