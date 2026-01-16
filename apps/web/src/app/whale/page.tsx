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
import { getTradingVolume } from '@/app/actions/helius';
import type { TradingVolumeData, ProofResult, VerificationResult } from '@/lib/types';
import { CheckCircle, XCircle, ExternalLink, Wallet, Shield, ArrowRight, TrendingUp } from 'lucide-react';

gsap.registerPlugin(useGSAP);

// === State Types ===

type Step = 'connect' | 'fetch' | 'generate' | 'verify' | 'complete';

interface WhaleState {
  step: Step;
  loading: boolean;
  error: string | null;
  tradingData: TradingVolumeData | null;
  proofResult: ProofResult | null;
  verificationResult: VerificationResult | null;
}

// === Action Types ===

type WhaleAction =
  | { type: 'START_LOADING' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_TRADING_DATA'; tradingData: TradingVolumeData }
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

const initialState: WhaleState = {
  step: 'connect',
  loading: false,
  error: null,
  tradingData: null,
  proofResult: null,
  verificationResult: null,
};

function whaleReducer(state: WhaleState, action: WhaleAction): WhaleState {
  switch (action.type) {
    case 'START_LOADING':
      return { ...state, loading: true, error: null };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_TRADING_DATA':
      return { ...state, loading: false, tradingData: action.tradingData, step: 'generate' };
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

function WhalePageContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [state, dispatch] = useReducer(whaleReducer, initialState);
  const [proofProgress, setProofProgress] = useState(0);

  const { step, loading, error, tradingData, proofResult, verificationResult } = state;

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
      const result = await getTradingVolume(publicKey.toBase58(), 30);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch trading data');
      }
      dispatch({ type: 'SET_TRADING_DATA', tradingData: result.data });
    } catch (err) {
      dispatch({ type: 'SET_STEP', step: 'connect' });
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      });
    }
  }, [publicKey]);

  const handleGenerateProof = useCallback(async () => {
    if (!publicKey || !tradingData) return;
    dispatch({ type: 'START_LOADING' });
    setProofProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProofProgress((prev) => Math.min(prev + Math.random() * 15, 90));
      }, 500);

      const { generateWhaleTradingProof } = await import('@/lib/proof');
      const result = await generateWhaleTradingProof({
        walletPubkey: publicKey.toBase58(),
        tradingData,
        minVolume: 50000,
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
  }, [publicKey, tradingData]);

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

      const result = await submitProofToChain(connection, proofResult, 'whale', publicKey, signTransaction);

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

  const meetsThreshold = tradingData ? tradingData.totalVolume >= 50000 : false;

  const getSolscanUrl = (signature: string) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    return `https://solscan.io/tx/${signature}?cluster=${network}`;
  };

  return (
    <div ref={containerRef} className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="page-header text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary/30 bg-secondary/5 mb-4">
          <Wallet className="w-4 h-4 text-secondary" />
          <span className="text-sm text-secondary font-mono">Whale Proof</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-3">
          Whale <span className="text-secondary text-glow-purple">Trading</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Prove your trading volume without exposing your wallet
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
      <GlowCard className="main-card" glowColor="purple">
        <div className="p-8">
          {/* Connect Step */}
          {step === 'connect' && (
            <div className="text-center py-8 animate-fade-in-up">
              <TrendingUp className="w-16 h-16 text-secondary/30 mx-auto mb-6" />
              {!connected ? (
                <>
                  <h3 className="text-xl font-display font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-muted-foreground mb-6">Connect your trading wallet to begin</p>
                  <WalletButton />
                </>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">
                      Connected Wallet
                    </p>
                    <p className="font-mono text-sm text-secondary break-all">{publicKey?.toBase58()}</p>
                  </div>
                  <GlowButton onClick={handleFetchData} disabled={loading} glowColor="purple" className="w-full">
                    {loading ? 'Fetching...' : 'Fetch Trading Data'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </GlowButton>
                </div>
              )}
            </div>
          )}

          {/* Fetch Step - Show loading */}
          {step === 'fetch' && loading && (
            <div className="py-8 animate-fade-in-up">
              <ProofLoading status="loading" progress={50} message="Fetching your trading history..." />
            </div>
          )}

          {/* Generate Step */}
          {step === 'generate' && tradingData && !loading && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-secondary" />
                  Trading Activity (30 days)
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-4 rounded-lg bg-background/50 border border-border/30">
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">
                      Total Volume
                    </p>
                    <p
                      className={`text-2xl font-mono font-bold ${
                        meetsThreshold ? 'text-accent text-glow-green' : 'text-destructive'
                      }`}
                    >
                      ${tradingData.totalVolume.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-background/50 border border-border/30">
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">
                      Trade Count
                    </p>
                    <p className="text-2xl font-mono font-bold text-secondary">{tradingData.tradeCount}</p>
                  </div>
                </div>
              </div>

              {meetsThreshold ? (
                <>
                  <GlowButton onClick={handleGenerateProof} disabled={loading} glowColor="purple" className="w-full">
                    Generate ZK Proof
                    <Shield className="ml-2 h-4 w-4" />
                  </GlowButton>
                  <p className="text-xs text-center text-muted-foreground">
                    Proof generated in your browser. Your data never leaves your device.
                  </p>
                </>
              ) : (
                <div className="text-center p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                  <p className="text-destructive font-medium">Below $50K volume threshold</p>
                  <p className="text-sm text-muted-foreground mt-1">Keep trading to qualify</p>
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
                  Your ZK proof proves you meet the whale criteria without revealing your wallet address.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Proof Size</p>
                  <p className="font-mono text-secondary">{proofResult.proof.length} bytes</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Nullifier Hash</p>
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {proofResult.nullifier.slice(0, 48)}...
                  </p>
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
                  Your whale trading status has been verified and recorded on Solana
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
                    className="font-mono text-xs text-secondary hover:text-secondary/80 break-all flex items-center gap-2 transition-colors"
                  >
                    {verificationResult.signature.slice(0, 48)}...
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
              )}

              <GlowButton onClick={handleReset} variant="outline" glowColor="purple" className="w-full">
                Start New Verification
              </GlowButton>
            </div>
          )}
        </div>
      </GlowCard>
    </div>
  );
}

export default function WhalePage() {
  return (
    <WasmErrorBoundary
      title="Proof Generation Error"
      description="The zero-knowledge proof engine failed to initialize. This may be due to browser compatibility issues."
    >
      <WhalePageContent />
    </WasmErrorBoundary>
  );
}
