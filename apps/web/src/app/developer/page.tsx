'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WalletButton } from '@/components/wallet/wallet-button';
import { getDeployedPrograms } from '@/app/actions/helius';
import type { ProgramData } from '@/lib/types';
import { generateDevReputationProof } from '@/lib/proof';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

type Step = 'connect' | 'fetch' | 'generate' | 'verify';

export default function DeveloperPage() {
  const { connected, publicKey } = useWallet();
  const [step, setStep] = useState<Step>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramData[]>([]);
  const [proof, setProof] = useState<Uint8Array | null>(null);

  const handleFetchData = async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);

    try {
      const result = await getDeployedPrograms(publicKey.toBase58());
      if (!result.success || !result.data) throw new Error(result.error);
      setPrograms(result.data);
      setStep('generate');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateProof = async () => {
    if (!publicKey || programs.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const result = await generateDevReputationProof({
        walletPubkey: publicKey.toBase58(),
        programs,
        minTvl: 100000,
      });
      setProof(result.proof);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proof');
    } finally {
      setLoading(false);
    }
  };

  const totalTVL = programs.reduce((sum, p) => sum + p.estimatedTVL, 0);
  const meetsThreshold = totalTVL >= 100000;

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <h1 className="text-4xl font-bold mb-2">Developer Reputation Proof</h1>
      <p className="text-muted-foreground mb-8">
        Prove you&apos;ve deployed successful programs without revealing your identity
      </p>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg flex items-center gap-2">
          <XCircle className="w-5 h-5 text-destructive" />
          <span className="text-destructive">{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 'connect' && 'Connect Wallet'}
            {step === 'generate' && 'Generate ZK Proof'}
            {step === 'verify' && 'Proof Generated'}
          </CardTitle>
          <CardDescription>
            {step === 'connect' && 'Connect the wallet that deployed your programs'}
            {step === 'generate' && 'Review your data and generate a ZK proof'}
            {step === 'verify' && 'Submit your proof to the Solana verifier'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'connect' && (
            <div className="text-center py-8">
              {!connected ? (
                <>
                  <p className="text-muted-foreground mb-4">Connect your wallet to begin</p>
                  <WalletButton />
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg text-left">
                    <p className="text-sm text-muted-foreground">Connected</p>
                    <p className="font-mono text-sm break-all">{publicKey?.toBase58()}</p>
                  </div>
                  <Button onClick={handleFetchData} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Fetch My Programs
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 'generate' && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Your Programs</h3>
                {programs.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span className="font-mono">{p.address.slice(0, 12)}...</span>
                    <span className="text-green-600">${p.estimatedTVL.toLocaleString()}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
                  <span>Total TVL</span>
                  <span className={meetsThreshold ? 'text-green-600' : 'text-red-600'}>
                    ${totalTVL.toLocaleString()}
                  </span>
                </div>
              </div>

              {meetsThreshold ? (
                <Button onClick={handleGenerateProof} className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Generate ZK Proof
                </Button>
              ) : (
                <p className="text-center text-destructive">Below $100K threshold</p>
              )}
              <p className="text-xs text-center text-muted-foreground">
                Proof generated in your browser. Data never leaves your device.
              </p>
            </div>
          )}

          {step === 'verify' && proof && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">Proof Generated!</span>
                </div>
                <p className="text-sm text-green-700">
                  Your ZK proof proves you meet the criteria without revealing your wallet.
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Proof Size</p>
                <p className="font-mono">{proof.length} bytes</p>
              </div>
              <Button className="w-full" disabled>Submit to Verifier (Coming Soon)</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
