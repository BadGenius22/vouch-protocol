'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WalletButton } from '@/components/wallet/wallet-button';
import { getTradingVolume } from '@/app/actions/helius';
import type { TradingVolumeData } from '@/lib/types';
import { generateWhaleTradingProof } from '@/lib/proof';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

type Step = 'connect' | 'fetch' | 'generate' | 'verify';

export default function WhalePage() {
  const { connected, publicKey } = useWallet();
  const [step, setStep] = useState<Step>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradingData, setTradingData] = useState<TradingVolumeData | null>(null);
  const [proof, setProof] = useState<Uint8Array | null>(null);

  const handleFetchData = async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);

    try {
      const result = await getTradingVolume(publicKey.toBase58(), 30);
      if (!result.success || !result.data) throw new Error(result.error);
      setTradingData(result.data);
      setStep('generate');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateProof = async () => {
    if (!publicKey || !tradingData) return;
    setLoading(true);
    setError(null);

    try {
      const result = await generateWhaleTradingProof({
        walletPubkey: publicKey.toBase58(),
        tradingData,
        minVolume: 50000,
      });
      setProof(result.proof);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proof');
    } finally {
      setLoading(false);
    }
  };

  const meetsThreshold = tradingData ? tradingData.totalVolume >= 50000 : false;

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <h1 className="text-4xl font-bold mb-2">Whale Trading Proof</h1>
      <p className="text-muted-foreground mb-8">
        Prove your trading volume without exposing your wallet
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
            {step === 'connect' && 'Connect your trading wallet'}
            {step === 'generate' && 'Review your trading data and generate a ZK proof'}
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
                    Fetch Trading Data
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 'generate' && tradingData && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Trading Activity (30 days)</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Volume</p>
                    <p className={`font-semibold ${meetsThreshold ? 'text-green-600' : 'text-red-600'}`}>
                      ${tradingData.totalVolume.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Trade Count</p>
                    <p className="font-semibold">{tradingData.tradeCount}</p>
                  </div>
                </div>
              </div>

              {meetsThreshold ? (
                <Button onClick={handleGenerateProof} className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Generate ZK Proof
                </Button>
              ) : (
                <p className="text-center text-destructive">Below $50K threshold</p>
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
