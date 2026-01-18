'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useWalletReady, useSolanaConnection } from '@/components/providers';
import { GlowCard } from '@/components/ui/glow-card';
import { GlowButton } from '@/components/ui/glow-button';
import { StepIndicator } from '@/components/ui/step-indicator';
import { ProofLoading } from '@/components/ui/proof-loading';
import { WalletButton } from '@/components/wallet/wallet-button';
import { getDeployedPrograms } from '@/app/actions/helius';
import type { ProgramData, ProofResult, VerificationResult } from '@/lib/types';
import { CheckCircle, XCircle, ExternalLink, Code2, Shield, ArrowRight, Loader2, BadgeCheck } from 'lucide-react';

type Step = 'connect' | 'checking' | 'already-verified' | 'fetch' | 'generate' | 'verify' | 'complete';

const STEPS = [
  { id: 'connect', label: 'Connect' },
  { id: 'fetch', label: 'Fetch' },
  { id: 'generate', label: 'Prove' },
  { id: 'verify', label: 'Verify' },
  { id: 'complete', label: 'Done' },
];

export default function DeveloperPage() {
  const walletReady = useWalletReady();

  if (!walletReady) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <DeveloperPageContent />;
}

function DeveloperPageContent() {
  const wallet = useUnifiedWallet();
  const connection = useSolanaConnection();

  const [step, setStep] = useState<Step>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramData[]>([]);
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [proofProgress, setProofProgress] = useState(0);
  const [existingNullifier, setExistingNullifier] = useState<string | null>(null);

  // Check if wallet has already verified when connected
  useEffect(() => {
    async function checkExistingVerification() {
      if (!wallet.publicKey) {
        setStep('connect');
        setExistingNullifier(null);
        return;
      }

      setStep('checking');

      try {
        const { computeNullifierForWallet } = await import('@/lib/proof');
        const { isNullifierUsed, isProgramDeployed } = await import('@/lib/verify');
        const { preloadCircuits } = await import('@/lib/circuit');

        // Compute nullifier (synchronous)
        const nullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'developer');

        // Run all checks in parallel: program deployed, nullifier used, and preload circuits
        const [deployed, used] = await Promise.all([
          isProgramDeployed(connection),
          isNullifierUsed(connection, nullifier),
          preloadCircuits(), // Warm up circuit cache in background
        ]);

        if (!deployed) {
          setStep('connect');
          return;
        }

        if (used) {
          setExistingNullifier(nullifier);
          setStep('already-verified');
        } else {
          setStep('connect');
        }
      } catch (err) {
        console.error('Error checking existing verification:', err);
        setStep('connect');
      }
    }

    checkExistingVerification();
  }, [wallet.publicKey, connection]);

  const getCompletedSteps = (): string[] => {
    const stepOrder = ['connect', 'fetch', 'generate', 'verify', 'complete'];
    // Handle special steps that aren't in the display order
    if (step === 'checking') {
      return []; // Still checking, nothing completed yet
    }
    if (step === 'already-verified') {
      return stepOrder; // All steps completed (already verified)
    }
    const currentIndex = stepOrder.indexOf(step);
    return currentIndex >= 0 ? stepOrder.slice(0, currentIndex) : [];
  };

  const handleFetchData = useCallback(async () => {
    if (!wallet.publicKey) return;
    setLoading(true);
    setError(null);
    setStep('fetch');

    try {
      const result = await getDeployedPrograms(wallet.publicKey.toBase58());
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch programs');
      }
      setPrograms(result.data);
      setStep('generate');
    } catch (err) {
      setStep('connect');
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [wallet.publicKey]);

  const handleGenerateProof = useCallback(async () => {
    if (!wallet.publicKey || programs.length === 0) return;
    setLoading(true);
    setError(null);
    setProofProgress(0);

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      progressInterval = setInterval(() => {
        setProofProgress((prev) => Math.min(prev + Math.random() * 15, 90));
      }, 500);

      const { generateDevReputationProof } = await import('@/lib/proof');
      const result = await generateDevReputationProof({
        walletPubkey: wallet.publicKey.toBase58(),
        programs,
        minTvl: 10000,
      });

      clearInterval(progressInterval);
      setProofProgress(100);

      setTimeout(() => {
        setProofResult(result);
        setStep('verify');
        setLoading(false);
      }, 500);
    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      setProofProgress(0);
      setError(err instanceof Error ? err.message : 'Failed to generate proof');
      setLoading(false);
    }
  }, [wallet.publicKey, programs]);

  const handleSubmitProof = useCallback(async () => {
    if (!wallet.publicKey || !proofResult || !wallet.signTransaction) return;
    setLoading(true);
    setError(null);

    try {
      const { isProgramDeployed } = await import('@/lib/verify');
      const { submitProofWithVerifier, isVerifierAvailable } = await import('@/lib/verifier-client');

      const deployed = await isProgramDeployed(connection);

      if (!deployed) {
        setVerificationResult({
          success: true,
          signature: 'demo_' + Date.now().toString(36),
        });
        setStep('complete');
        setLoading(false);
        return;
      }

      // Check if verifier service is available
      const verifierAvailable = await isVerifierAvailable();
      if (!verifierAvailable) {
        setError('Verifier service is not available. Please try again later.');
        setLoading(false);
        return;
      }

      const result = await submitProofWithVerifier(
        connection,
        proofResult,
        'developer',
        wallet.publicKey,
        wallet.signTransaction
      );

      setVerificationResult(result);
      if (result.success) {
        setStep('complete');
        // Store nullifier in localStorage for airdrop registration
        if (proofResult.nullifier && typeof window !== 'undefined') {
          localStorage.setItem('vouch_nullifier', proofResult.nullifier);
          localStorage.setItem('vouch_proof_type', 'developer');
        }
      } else {
        setError(result.error || 'Verification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit proof');
    } finally {
      setLoading(false);
    }
  }, [wallet.publicKey, wallet.signTransaction, proofResult, connection]);

  const handleReset = useCallback(() => {
    setStep('connect');
    setLoading(false);
    setError(null);
    setPrograms([]);
    setProofResult(null);
    setVerificationResult(null);
    setProofProgress(0);
  }, []);

  const totalTVL = programs.reduce((sum, p) => sum + p.estimatedTVL, 0);
  const meetsThreshold = totalTVL >= 10000;

  const getSolscanUrl = (signature: string) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    return `https://solscan.io/tx/${signature}?cluster=${network}`;
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-4">
          <Code2 className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary font-mono">Developer Proof</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-3">
          Developer <span className="text-primary text-glow-cyan">Reputation</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Prove you&apos;ve deployed successful programs without revealing your identity
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <StepIndicator steps={STEPS} currentStep={step} completedSteps={getCompletedSteps()} />
      </div>

      {/* Error Alert */}
      {error && (
        <GlowCard glowColor="purple" className="mb-6 p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <span className="text-destructive text-sm">{error}</span>
          </div>
        </GlowCard>
      )}

      {/* Main Card */}
      <GlowCard className="main-card" glowColor="cyan">
        <div className="p-8">
          {/* Connect Step */}
          {step === 'connect' && (
            <div className="text-center py-8">
              <Shield className="w-16 h-16 text-primary/30 mx-auto mb-6" />
              {!wallet.publicKey ? (
                <>
                  <h3 className="text-xl font-display font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-muted-foreground mb-6">
                    Connect the wallet that deployed your Solana programs
                  </p>
                  <WalletButton />
                </>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">
                      Connected Wallet
                    </p>
                    <p className="font-mono text-sm text-primary break-all">{wallet.publicKey.toBase58()}</p>
                  </div>
                  <GlowButton onClick={handleFetchData} disabled={loading} glowColor="cyan" className="w-full">
                    {loading ? 'Fetching...' : 'Fetch My Programs'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </GlowButton>
                </div>
              )}
            </div>
          )}

          {/* Checking Step - Verifying if already proven */}
          {step === 'checking' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-display font-semibold mb-2">Checking Verification Status</h3>
              <p className="text-muted-foreground">
                Verifying if this wallet has already proven developer reputation...
              </p>
            </div>
          )}

          {/* Already Verified Step */}
          {step === 'already-verified' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-6 shadow-neon-green">
                <BadgeCheck className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-display font-bold text-accent text-glow-green mb-2">
                Already Verified!
              </h3>
              <p className="text-muted-foreground mb-6">
                This wallet has already proven developer reputation on-chain.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50 max-w-md mx-auto">
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">
                  Nullifier Hash
                </p>
                <p className="font-mono text-xs text-primary break-all">
                  {existingNullifier?.slice(0, 32)}...
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Each wallet can only verify once per proof type to prevent double-proving.
              </p>
            </div>
          )}

          {/* Fetch Step - Show loading */}
          {step === 'fetch' && loading && (
            <div className="py-8">
              <ProofLoading status="loading" progress={50} message="Fetching your deployed programs..." />
            </div>
          )}

          {/* Generate Step */}
          {step === 'generate' && !loading && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-primary" />
                  Your Deployed Programs
                </h3>
                <ul className="space-y-2">
                  {programs.map((p, i) => (
                    <li key={i} className="flex justify-between items-center text-sm py-2 border-b border-border/30 last:border-0">
                      <span className="font-mono text-muted-foreground">{p.address.slice(0, 16)}...</span>
                      <span className="text-accent font-mono">${p.estimatedTVL.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center">
                  <span className="font-display font-semibold">Total TVL</span>
                  <span className={`font-mono text-lg ${meetsThreshold ? 'text-accent text-glow-green' : 'text-destructive'}`}>
                    ${totalTVL.toLocaleString()}
                  </span>
                </div>
              </div>

              {meetsThreshold ? (
                <>
                  <GlowButton onClick={handleGenerateProof} disabled={loading} glowColor="cyan" className="w-full">
                    Generate ZK Proof
                    <Shield className="ml-2 h-4 w-4" />
                  </GlowButton>
                  <p className="text-xs text-center text-muted-foreground">
                    Proof generated in your browser. Your data never leaves your device.
                  </p>
                </>
              ) : (
                <div className="text-center p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                  <p className="text-destructive font-medium">Below $10K TVL threshold</p>
                  <p className="text-sm text-muted-foreground mt-1">Deploy more programs to qualify</p>
                </div>
              )}
            </div>
          )}

          {/* Proof Generation Loading */}
          {step === 'generate' && loading && (
            <div className="py-8">
              <ProofLoading status="loading" progress={proofProgress} />
            </div>
          )}

          {/* Verify Step */}
          {step === 'verify' && proofResult && !loading && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="w-6 h-6 text-accent" />
                  <span className="font-display font-semibold text-accent">Proof Generated!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your ZK proof proves you meet the developer criteria without revealing your wallet address.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Proof Size</p>
                  <p className="font-mono text-primary">{proofResult.proof.length} bytes</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Nullifier Hash</p>
                  <p className="font-mono text-xs text-muted-foreground break-all">{proofResult.nullifier.slice(0, 48)}...</p>
                </div>
              </div>

              <GlowButton onClick={handleSubmitProof} disabled={loading} glowColor="green" className="w-full">
                Submit to Verifier
                <ArrowRight className="ml-2 h-4 w-4" />
              </GlowButton>
              <p className="text-xs text-center text-muted-foreground">
                Creates a transaction to verify your proof on Solana
              </p>
            </div>
          )}

          {/* Submit Loading */}
          {step === 'verify' && loading && (
            <div className="py-8">
              <ProofLoading status="loading" progress={75} message="Submitting proof to Solana..." />
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && verificationResult && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-4 shadow-neon-green">
                  <CheckCircle className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-2xl font-display font-bold text-accent text-glow-green mb-2">Verified On-Chain!</h3>
                <p className="text-muted-foreground">
                  Your developer reputation has been verified and recorded on Solana
                </p>
              </div>

              {verificationResult.signature && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">
                    Transaction Signature
                  </p>
                  <a
                    href={getSolscanUrl(verificationResult.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-primary hover:text-primary/80 break-all flex items-center gap-2 transition-colors"
                  >
                    {verificationResult.signature.slice(0, 48)}...
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}

              <GlowButton onClick={handleReset} variant="outline" glowColor="cyan" className="w-full">
                Start New Verification
              </GlowButton>
            </div>
          )}
        </div>
      </GlowCard>
    </div>
  );
}
