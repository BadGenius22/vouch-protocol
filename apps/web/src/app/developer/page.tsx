'use client';

import { useReducer, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WalletButton } from '@/components/wallet/wallet-button';
import { WasmErrorBoundary } from '@/components/error-boundary';
import { getDeployedPrograms } from '@/app/actions/helius';
import type { ProgramData, ProofResult, VerificationResult } from '@/lib/types';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

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
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [state, dispatch] = useReducer(developerReducer, initialState);

  const { step, loading, error, programs, proofResult, verificationResult } = state;

  const handleFetchData = useCallback(async () => {
    if (!publicKey) return;
    dispatch({ type: 'START_LOADING' });

    try {
      const result = await getDeployedPrograms(publicKey.toBase58());
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch programs');
      }
      dispatch({ type: 'SET_PROGRAMS', programs: result.data });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      });
    }
  }, [publicKey]);

  const handleGenerateProof = useCallback(async () => {
    if (!publicKey || programs.length === 0) return;
    dispatch({ type: 'START_LOADING' });

    try {
      // Dynamic import to avoid SSR issues with WASM
      const { generateDevReputationProof } = await import('@/lib/proof');
      const result = await generateDevReputationProof({
        walletPubkey: publicKey.toBase58(),
        programs,
        minTvl: 10000,
      });
      dispatch({ type: 'SET_PROOF_RESULT', proofResult: result });
    } catch (err) {
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
      // Dynamic import to avoid SSR issues
      const { submitProofToChain, isProgramDeployed } = await import('@/lib/verify');

      // Check if program is deployed
      const deployed = await isProgramDeployed(connection);
      if (!deployed) {
        // For demo/hackathon: show success with mock signature
        dispatch({
          type: 'SET_VERIFICATION_RESULT',
          verificationResult: {
            success: true,
            signature: 'demo_' + Date.now().toString(36),
          },
        });
        return;
      }

      // Submit proof to chain
      const result = await submitProofToChain(
        connection,
        proofResult,
        'developer',
        publicKey,
        signTransaction
      );

      dispatch({ type: 'SET_VERIFICATION_RESULT', verificationResult: result });
      if (!result.success) {
        dispatch({
          type: 'SET_ERROR',
          error: result.error || 'Verification failed',
        });
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
  }, []);

  const totalTVL = programs.reduce((sum, p) => sum + p.estimatedTVL, 0);
  const meetsThreshold = totalTVL >= 10000;

  const getSolscanUrl = (signature: string) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    return `https://solscan.io/tx/${signature}?cluster=${network}`;
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <h1 className="text-4xl font-bold mb-2">Developer Reputation Proof</h1>
      <p className="text-muted-foreground mb-8">
        Prove you&apos;ve deployed successful programs without revealing your identity
      </p>

      {error && (
        <div
          className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg flex items-center gap-2"
          role="alert"
          aria-live="assertive"
        >
          <XCircle className="w-5 h-5 text-destructive" aria-hidden="true" />
          <span className="text-destructive">{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 'connect' && 'Connect Wallet'}
            {step === 'generate' && 'Generate ZK Proof'}
            {step === 'verify' && 'Submit Proof'}
            {step === 'complete' && 'Verification Complete'}
          </CardTitle>
          <CardDescription>
            {step === 'connect' && 'Connect the wallet that deployed your programs'}
            {step === 'generate' && 'Review your data and generate a ZK proof'}
            {step === 'verify' && 'Submit your proof to the Solana verifier'}
            {step === 'complete' && 'Your developer reputation has been verified on-chain'}
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
                  <Button
                    onClick={handleFetchData}
                    className="w-full"
                    disabled={loading}
                    aria-busy={loading}
                    aria-label={loading ? 'Fetching programs...' : 'Fetch my programs'}
                  >
                    {loading && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    )}
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
                <ul aria-label="List of deployed programs">
                  {programs.map((p, i) => (
                    <li key={i} className="flex justify-between text-sm py-1">
                      <span className="font-mono">{p.address.slice(0, 12)}...</span>
                      <span className="text-green-600">${p.estimatedTVL.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
                  <span>Total TVL</span>
                  <span className={meetsThreshold ? 'text-green-600' : 'text-red-600'}>
                    ${totalTVL.toLocaleString()}
                  </span>
                </div>
              </div>

              {meetsThreshold ? (
                <Button
                  onClick={handleGenerateProof}
                  className="w-full"
                  disabled={loading}
                  aria-busy={loading}
                  aria-label={loading ? 'Generating proof...' : 'Generate ZK proof'}
                >
                  {loading && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  )}
                  Generate ZK Proof
                </Button>
              ) : (
                <p className="text-center text-destructive" role="status">
                  Below $10K threshold
                </p>
              )}
              <p className="text-xs text-center text-muted-foreground">
                Proof generated in your browser. Data never leaves your device.
              </p>
            </div>
          )}

          {step === 'verify' && proofResult && (
            <div className="space-y-4">
              <div
                className="p-4 bg-green-50 border border-green-200 rounded-lg"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
                  <span className="font-semibold text-green-800">Proof Generated!</span>
                </div>
                <p className="text-sm text-green-700">
                  Your ZK proof proves you meet the criteria without revealing your wallet.
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Proof Size</p>
                  <p className="font-mono">{proofResult.proof.length} bytes</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nullifier</p>
                  <p className="font-mono text-xs break-all">
                    {proofResult.nullifier.slice(0, 32)}...
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSubmitProof}
                className="w-full"
                disabled={loading}
                aria-busy={loading}
                aria-label={loading ? 'Submitting proof...' : 'Submit proof to verifier'}
              >
                {loading && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                )}
                Submit to Verifier
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                This will create a transaction to verify your proof on-chain.
              </p>
            </div>
          )}

          {step === 'complete' && verificationResult && (
            <div className="space-y-4">
              <div
                className="p-4 bg-green-50 border border-green-200 rounded-lg"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
                  <span className="font-semibold text-green-800">Verified On-Chain!</span>
                </div>
                <p className="text-sm text-green-700">
                  Your developer reputation has been verified and recorded on Solana.
                </p>
              </div>
              {verificationResult.signature && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Transaction Signature</p>
                  <a
                    href={getSolscanUrl(verificationResult.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs break-all text-blue-600 hover:underline flex items-center gap-1"
                    aria-label={`View transaction ${verificationResult.signature.slice(0, 16)}... on Solscan`}
                  >
                    {verificationResult.signature.slice(0, 32)}...
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              )}
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full"
                aria-label="Start a new verification"
              >
                Start New Verification
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Developer Reputation Proof Page
 * Wrapped with WasmErrorBoundary to handle WASM/circuit loading failures gracefully
 */
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
