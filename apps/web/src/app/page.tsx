'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { HeroScene } from '@/components/ui/hero-section';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DatabaseWithRestApi from '@/components/ui/database-with-rest-api';
import CardFlip from '@/components/ui/flip-card';
import { Code2, Wallet, Github, Gift, FileCode } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Hero animations with stagger
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      heroTl
        .from('.hero-badge', { opacity: 0, y: -20, duration: 0.6 })
        .from('.hero-title', { opacity: 0, y: 40, duration: 0.8 }, '-=0.3')
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
        );

      // Tech stack section with scroll trigger
      gsap.from('.tech-item', {
        scrollTrigger: {
          trigger: '.tech-stack-section',
          start: 'top 90%',
        },
        opacity: 0,
        y: 20,
        stagger: 0.1,
        duration: 0.5,
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
    <div ref={containerRef} className="relative overflow-hidden bg-gradient-to-br from-[#000] to-[#1A2428]">
      {/* Hero Section - 21st.dev style */}
      <section className="relative min-h-svh w-screen text-white flex flex-col items-center justify-center p-8">
        {/* 3D Background */}
        <div className="absolute inset-0">
          <HeroScene />
        </div>

        {/* Content */}
        <div className="w-full max-w-6xl space-y-12 relative z-10">
          <div className="flex flex-col items-center text-center space-y-8">
            <Badge
              variant="secondary"
              className="hero-badge backdrop-blur-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 px-4 py-2 rounded-full"
            >
              ✨ Privacy SDK for Solana
            </Badge>

            <div className="space-y-6 flex items-center justify-center flex-col">
              <h1 className="hero-title text-3xl md:text-6xl font-semibold tracking-tight max-w-4xl text-white">
                Privacy infrastructure for Solana dApps
              </h1>
              <p className="hero-subtitle text-lg text-neutral-300 max-w-2xl">
                Add zero-knowledge verification to your dApp. Verify users without exposing their wallets.
                Sybil-resistant by default.
              </p>
              <div className="hero-buttons flex flex-col sm:flex-row gap-4 items-center">
                <Link href="https://github.com/BadGenius22/vouch-protocol" target="_blank">
                  <Button className="text-sm px-8 py-3 h-auto rounded-xl bg-white text-black border border-white/10 shadow-none hover:bg-white/90 transition-none">
                    <FileCode className="mr-2 h-4 w-4" />
                    View Documentation
                  </Button>
                </Link>
                <Link href="https://github.com/BadGenius22/vouch-protocol" target="_blank">
                  <Button className="text-sm px-8 py-3 h-auto rounded-xl bg-transparent text-white border border-white/20 shadow-none hover:bg-white/10 transition-none">
                    <Github className="mr-2 h-4 w-4" />
                    GitHub
                  </Button>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="tech-stack-section py-16 border-y border-white/10">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-neutral-500 mb-8">Powered by</p>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
            {[
              { description: 'Blockchain', logo: '/logos/solana.svg', filter: 'invert', url: 'https://solana.com' },
              { description: 'ZK Circuits', logo: '/logos/noir.png', filter: 'none', url: 'https://noir-lang.org' },
              { description: 'Prover', logo: '/logos/aztec.svg', filter: 'none', url: 'https://aztec.network' },
              { description: 'Private Transfers', logo: '/logos/Shadowwire.svg', filter: 'white', url: 'https://github.com/Radrdotfun/ShadowWire' },
              { description: 'RPC & Data', logo: '/logos/helius.svg', filter: 'none', url: 'https://helius.dev' },
            ].map((tech, i) => (
              <a
                key={i}
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                className="tech-item flex flex-col items-center gap-2"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 relative opacity-70 hover:opacity-100 transition-opacity">
                  <Image
                    src={tech.logo}
                    alt={tech.description}
                    fill
                    className={`object-contain ${
                      tech.filter === 'invert'
                        ? 'invert'
                        : tech.filter === 'white'
                          ? 'brightness-0 invert'
                          : ''
                    }`}
                  />
                </div>
                <span className="text-xs text-neutral-500">{tech.description}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
              Why integrate Vouch?
            </h2>
            <p className="text-neutral-400 max-w-xl mx-auto text-lg">
              Add privacy-preserving verification to your dApp in minutes
            </p>
          </div>

          <div className="feature-card flex justify-center">
            <DatabaseWithRestApi
              className="max-w-[800px] h-[450px]"
              title="Privacy SDK for Solana dApps"
              circleText="ZK"
              badgeTexts={{
                first: "Prove",
                second: "Verify",
                third: "Nullify",
                fourth: "On-Chain",
              }}
              buttonTexts={{
                first: "VouchSDK",
                second: "v1.0",
              }}
              lightColor="#ffffff"
            />
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="use-cases-section py-24 backdrop-blur-sm relative border-y border-white/10">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
              What you can build
            </h2>
            <p className="text-neutral-400 max-w-xl mx-auto text-lg">
              Privacy primitives for any Solana application
            </p>
          </div>

          <div className="use-case-card flex flex-wrap justify-center gap-8">
            <CardFlip
              title="Developer Gating"
              subtitle="Verify builder credentials"
              description="Gate access to developer-only features by verifying on-chain credentials anonymously."
              features={[
                'Gate by deployed programs',
                'Verify TVL thresholds',
                'Grant roles privately',
                'Prove experience, not identity',
              ]}
              color="#ffffff"
              icon={<Code2 className="h-6 w-6 text-white" />}
              href="/developer"
            />
            <CardFlip
              title="Whale Gating"
              subtitle="Verify trading volume"
              description="Create exclusive access for high-volume traders without exposing their wallets."
              features={[
                'Volume threshold verification',
                'Exclusive trader pools',
                'No wallet exposure',
                'Prove activity privately',
              ]}
              color="#ffffff"
              icon={<Wallet className="h-6 w-6 text-white" />}
              href="/whale"
            />
            <CardFlip
              title="Private Airdrops"
              subtitle="Distribute tokens anonymously"
              description="Sybil-resistant token distribution with privacy-preserving claims."
              features={[
                'Sybil-resistant distribution',
                'One claim per user',
                'Hidden amounts via ShadowWire',
                'Claim to any wallet',
              ]}
              color="#ffffff"
              icon={<Gift className="h-6 w-6 text-white" />}
              href="/airdrop"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section - Combined */}
      <section className="how-it-works-section py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
              Integration flow
            </h2>
            <p className="text-neutral-400 text-lg">Four steps to privacy</p>
          </div>

          <div className="max-w-5xl mx-auto">
            {/* Horizontal flow indicators - Desktop */}
            <div className="hidden md:block relative mb-12">
              {/* Animated connecting line */}
              <div className="absolute top-8 left-[10%] right-[10%] h-px">
                <div className="w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  style={{
                    animation: 'flowLine 3s ease-in-out infinite',
                    backgroundSize: '200% 100%',
                  }}
                />
              </div>

              <div className="grid grid-cols-4 gap-8">
                {['01', '02', '03', '04'].map((num, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-white/5 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                      <span className="text-xl font-bold text-white">{num}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Code cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  step: '01',
                  title: 'Install',
                  code: 'npm install @vouch-protocol/sdk',
                },
                {
                  step: '02',
                  title: 'Import',
                  code: `import { proveDevReputation } from
  '@vouch-protocol/sdk';`,
                },
                {
                  step: '03',
                  title: 'Prove & Verify',
                  code: `const result = await proveDevReputation({
  walletPubkey, programs, minTvl
}, { wallet, connection });`,
                },
                {
                  step: '04',
                  title: 'Done',
                  code: `if (result.success) {
  // result.verification.signature
  // Identity stays hidden ✓
}`,
                },
              ].map((item) => (
                <div key={item.step} className="step-card group h-full">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-white/40">{item.step}</span>
                        <span className="text-sm font-medium text-white">{item.title}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                      </div>
                    </div>
                    {/* Code */}
                    <div className="p-4 relative flex-1 min-h-[100px]">
                      <pre className="text-sm font-mono text-neutral-400 overflow-x-auto">
                        <code>{item.code}</code>
                      </pre>
                      {/* Copy button */}
                      <button
                        className="absolute top-3 right-3 p-1.5 rounded bg-white/5 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                        onClick={() => navigator.clipboard.writeText(item.code)}
                      >
                        <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section py-24 relative overflow-hidden border-t border-white/10">
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="cta-content max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white">
              Start building with privacy
            </h2>
            <p className="text-xl text-neutral-400 mb-10 leading-relaxed">
              Add zero-knowledge verification to your Solana dApp today.
              <br />
              Open source. Developer friendly. Production ready.
            </p>
            <div className="flex justify-center">
              <Link href="https://github.com/BadGenius22/vouch-protocol" target="_blank">
                <Button className="text-sm px-8 py-3 h-auto rounded-xl bg-white text-black border border-white/10 shadow-none hover:bg-white/90 transition-none">
                  <FileCode className="mr-2 h-5 w-5" />
                  Read the Docs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 relative">
                <Image
                  src="/logos/vouch-icon.svg"
                  alt="Vouch Protocol"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-sm text-neutral-400">Vouch Protocol &copy; {new Date().getFullYear()}</span>
            </div>
            <a
              href="https://github.com/BadGenius22/vouch-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
