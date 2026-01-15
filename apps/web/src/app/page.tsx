'use client';

import Link from 'next/link';
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

gsap.registerPlugin(useGSAP);

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Hero animations
    tl.from('.hero-title', {
      opacity: 0,
      y: 40,
      duration: 0.8
    })
    .from('.hero-subtitle', {
      opacity: 0,
      y: 30,
      duration: 0.6
    }, '-=0.4')
    .from('.hero-desc', {
      opacity: 0,
      y: 20,
      duration: 0.6
    }, '-=0.3')
    .from('.hero-buttons', {
      opacity: 0,
      y: 20,
      duration: 0.5
    }, '-=0.2');

    // Use case cards
    tl.from('.use-case-card', {
      opacity: 0,
      y: 40,
      stagger: 0.15,
      duration: 0.6
    }, '-=0.2');

    // How it works section
    tl.from('.how-title', {
      opacity: 0,
      y: 30,
      duration: 0.5
    }, '-=0.1')
    .from('.step-card', {
      opacity: 0,
      y: 30,
      stagger: 0.1,
      duration: 0.5
    }, '-=0.2');

  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="container mx-auto px-4 py-16">
      {/* Hero */}
      <section className="text-center mb-16">
        <h1 className="hero-title text-5xl font-bold mb-4">Vouch Protocol</h1>
        <p className="hero-subtitle text-xl text-muted-foreground mb-2">Anonymous Reputation Proofs for Solana</p>
        <p className="hero-desc text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Prove your on-chain credentials without revealing your identity.
          ZK proofs generated entirely in your browser.
        </p>
        <div className="hero-buttons flex gap-4 justify-center">
          <Link href="/developer">
            <Button size="lg">Prove Developer Skills</Button>
          </Link>
          <Link href="/whale">
            <Button size="lg" variant="outline">Prove Trading Volume</Button>
          </Link>
        </div>
      </section>

      {/* Use Cases */}
      <section className="grid md:grid-cols-2 gap-8 mb-16">
        <Card className="use-case-card">
          <CardHeader>
            <CardTitle>For Developers</CardTitle>
            <CardDescription>Prove your skills without revealing identity</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>✓ Deployed ≥3 programs on Solana</li>
              <li>✓ Secured ≥$100K TVL</li>
              <li>✓ Get hired anonymously</li>
              <li>✓ Proof generated in your browser</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="use-case-card">
          <CardHeader>
            <CardTitle>For Traders</CardTitle>
            <CardDescription>Prove trading volume without exposing wallets</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>✓ Traded ≥$50K volume</li>
              <li>✓ 30-day verification</li>
              <li>✓ Access exclusive pools</li>
              <li>✓ Wallet stays private</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* How It Works */}
      <section>
        <h2 className="how-title text-3xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: 1, title: 'Connect', desc: 'Link your Solana wallet' },
            { step: 2, title: 'Fetch', desc: 'We pull your on-chain data' },
            { step: 3, title: 'Prove', desc: 'ZK proof in your browser' },
            { step: 4, title: 'Verify', desc: 'Get credential on-chain' },
          ].map((item) => (
            <Card key={item.step} className="step-card">
              <CardHeader>
                <div className="text-3xl font-bold text-primary mb-2">{item.step}</div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
