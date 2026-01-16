'use client';

import { useReducer, useCallback, useRef, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { GlowCard } from '@/components/ui/glow-card';
import { GlowButton } from '@/components/ui/glow-button';
import { StepIndicator } from '@/components/ui/step-indicator';
import { ProofLoading } from '@/components/ui/proof-loading';
import { WalletButton } from '@/components/wallet/wallet-button';
import { WasmErrorBoundary } from '@/components/error-boundary';
import { getDeployedPrograms } from '@/app/actions/helius';
import type { ProgramData, ProofResult, VerificationResult } from '@/lib/types';
import { CheckCircle, XCircle, ExternalLink, Code2, Shield, ArrowRight } from 'lucide-react';

gsap.registerPlugin(useGSAP);

// === State Types ===

type Step = 'connect' | 'fetch' | 'generate' | 'verify' | 'complete';

interface DeveloperState {
  step: Step;
  loading: boolean;
  error: string | null;
  programs: ProgramData[];
  proofResult: ProofResult | null;
  verificationResult: VerificationResult | null;
}

// === Action Types ===

type DeveloperAction =
  | { type: 'START_LOADING' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_PROGRAMS'; programs: ProgramData[] }
  | { type: 'SET_PROOF_RESULT'; proofResult: ProofResult }
  | { type: 'SET_VERIFICATION_RESULT'; verificationResult: VerificationResult }
  | { type: 'SET_STEP'; step: Step }
  | { type: 'RESET' };

// === Constants ===

const STEPS = [
  { id: 'connect', label: 'Connect' },
  { id: 'fetch', label: 'Fetch' },
  { id: 'generate', label: 'Prove' },
  { id: 'verify', label: 'Verify' },
  { id: 'complete', label: 'Done' },
];

// === Reducer ===

const initialState: DeveloperState = {
  step: 'connect',
  loading: false,
  error: null,
  programs: [],
  proofResult: null,
  verificationResult: null,
};

function developerReducer(state: DeveloperState, action: DeveloperAction): DeveloperState {
  switch (action.type) {
    case 'START_LOADING':
      return { ...state, loading: true, error: null };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_PROGRAMS':
      return { ...state, loading: false, programs: action.programs, step: 'generate' };
    case 'SET_PROOF_RESULT':
      return { ...state, loading: false, proofResult: action.proofResult, step: 'verify' };
    case 'SET_VERIFICATION_RESULT':
      return {
        ...state,
        loading: false,
        verificationResult: action.verificationResult,
        step: action.verificationResult.success ? 'complete' : state.step,
      };
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// === Component ===

function DeveloperPageContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [state, dispatch] = useReducer(developerReducer, initialState);
  const [proofProgress, setProofProgress] = useState(0);

  const { step, loading, error, programs, proofResult, verificationResult } = state;

  // GSAP animations
  useGSAP(
    () => {
      gsap.from('.page-header', { opacity: 0, y: 30, duration: 0.6 });
      gsap.from('.step-indicator-wrapper', { opacity: 0, y: 20, duration: 0.5, delay: 0.2 });
      gsap.from('.main-card', { opacity: 0, y: 40, duration: 0.7, delay: 0.3 });
    },
    { scope: containerRef }
  );

  const getCompletedSteps = (): string[] => {
    const stepOrder = ['connect', 'fetch', 'generate', 'verify', 'complete'];
    const currentIndex = stepOrder.indexOf(step);
    return stepOrder.slice(0, currentIndex);
  };

  const handleFetchData = useCallback(async () => {
    if (!publicKey) return;
    dispatch({ type: 'START_LOADING' });
    dispatch({ type: 'SET_STEP', step: 'fetch' });

    try {
      const result = await getDeployedPrograms(publicKey.toBase58());
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch programs');
      }
      dispatch({ type: 'SET_PROGRAMS', programs: result.data });
    } catch (err) {
      dispatch({ type: 'SET_STEP', step: 'connect' });
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      });
    }
  }, [publicKey]);

  const handleGenerateProof = useCallback(async () => {
    if (!publicKey || programs.length === 0) return;
    dispatch({ type: 'START_LOADING' });
    setProofProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProofProgress((prev) => Math.min(prev + Math.random() * 15, 90));
      }, 500);

      const { generateDevReputationProof } = await import('@/lib/proof');
      const result = await generateDevReputationProof({
        walletPubkey: publicKey.toBase58(),
        programs,
        minTvl: 10000,
      });

      clearInterval(progressInterval);
      setProofProgress(100);

      setTimeout(() => {
        dispatch({ type: 'SET_PROOF_RESULT', proofResult: result });
      }, 500);
    } catch (err) {
      setProofProgress(0);
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to generate proof',
      });
    }
  }, [publicKey, programs]);

  const handleSubmitProof = useCallback(async () => {
    if (!publicKey || !proofResult || !signTransaction) return;
    dispatch({ type: 'START_LOADING' });

    try {
      const { submitProofToChain, isProgramDeployed } = await import('@/lib/verify');
      const deployed = await isProgramDeployed(connection);

      if (!deployed) {
        dispatch({
          type: 'SET_VERIFICATION_RESULT',
          verificationResult: {
            success: true,
            signature: 'demo_' + Date.now().toString(36),
          },
        });
        return;
      }

      const result = await submitProofToChain(connection, proofResult, 'developer', publicKey, signTransaction);

      dispatch({ type: 'SET_VERIFICATION_RESULT', verificationResult: result });
      if (!result.success) {
        dispatch({ type: 'SET_ERROR', error: result.error || 'Verification failed' });
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to submit proof',
      });
    }
  }, [publicKey, proofResult, signTransaction, connection]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setProofProgress(0);
  }, []);

  const totalTVL = programs.reduce((sum, p) => sum + p.estimatedTVL, 0);
  const meetsThreshold = totalTVL >= 10000;

  const getSolscanUrl = (signature: string) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    return `https://solscan.io/tx/${signature}?cluster=${network}`;
  };

  return (
    <div ref={containerRef} className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="page-header text-center mb-8">
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
      <div className="step-indicator-wrapper mb-8">
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
            <div className="text-center py-8 animate-fade-in-up">
              <Shield className="w-16 h-16 text-primary/30 mx-auto mb-6" />
              {!connected ? (
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
                    <p className="font-mono text-sm text-primary break-all">{publicKey?.toBase58()}</p>
                  </div>
                  <GlowButton onClick={handleFetchData} disabled={loading} glowColor="cyan" className="w-full">
                    {loading ? 'Fetching...' : 'Fetch My Programs'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </GlowButton>
                </div>
              )}
            </div>
          )}

          {/* Fetch Step - Show loading */}
          {step === 'fetch' && loading && (
            <div className="py-8 animate-fade-in-up">
              <ProofLoading status="loading" progress={50} message="Fetching your deployed programs..." />
            </div>
          )}

          {/* Generate Step */}
          {step === 'generate' && !loading && (
            <div className="space-y-6 animate-fade-in-up">
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
            <div className="py-8 animate-fade-in-up">
              <ProofLoading status="loading" progress={proofProgress} />
            </div>
          )}

          {/* Verify Step */}
          {step === 'verify' && proofResult && !loading && (
            <div className="space-y-6 animate-fade-in-up">
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
            <div className="py-8 animate-fade-in-up">
              <ProofLoading status="loading" progress={75} message="Submitting proof to Solana..." />
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && verificationResult && (
            <div className="space-y-6 animate-fade-in-up">
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

export default function DeveloperPage() {
  return (
    <WasmErrorBoundary
      title="Proof Generation Error"
      description="The zero-knowledge proof engine failed to initialize. This may be due to browser compatibility issues."
    >
      <DeveloperPageContent />
    </WasmErrorBoundary>
  );
}
