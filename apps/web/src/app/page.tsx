import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero */}
      <section className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">Vouch Protocol</h1>
        <p className="text-xl text-muted-foreground mb-2">Anonymous Reputation Proofs for Solana</p>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Prove your on-chain credentials without revealing your identity.
          ZK proofs generated entirely in your browser.
        </p>
        <div className="flex gap-4 justify-center">
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
        <Card>
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

        <Card>
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
        <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: 1, title: 'Connect', desc: 'Link your Solana wallet' },
            { step: 2, title: 'Fetch', desc: 'We pull your on-chain data' },
            { step: 3, title: 'Prove', desc: 'ZK proof in your browser' },
            { step: 4, title: 'Verify', desc: 'Get credential on-chain' },
          ].map((item) => (
            <Card key={item.step}>
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
