'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useWalletReady, useSolanaConnection } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StepIndicator } from '@/components/ui/step-indicator';
import { ProofLoading } from '@/components/ui/proof-loading';
import { WalletButton } from '@/components/wallet/wallet-button';
import { getDeployedPrograms } from '@/app/actions/helius';
import type { ProgramData, VerificationResult } from '@/lib/types';
import type { ProveFlowProgress, ProveFlowResult, PrivacyProvider } from '@/lib/prove-flow';
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Code2,
  Shield,
  ArrowRight,
  Loader2,
  BadgeCheck,
  Lock,
  Eye,
  EyeOff,
  Info,
  Coins,
  Zap,
  Globe,
} from 'lucide-react';

type Step =
  | 'connect'
  | 'checking'
  | 'already-verified'
  | 'fetch'
  | 'ready'
  | 'proving'
  | 'complete';

const STEPS = [
  { id: 'connect', label: 'Connect' },
  { id: 'fetch', label: 'Fetch' },
  { id: 'ready', label: 'Review' },
  { id: 'proving', label: 'Prove' },
  { id: 'complete', label: 'Done' },
];

export default function DeveloperPage() {
  const walletReady = useWalletReady();

  if (!walletReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000] to-[#1A2428] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white/80 animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <DeveloperPageContent />;
}

const DeveloperPageContent = memo(function DeveloperPageContent() {
  const wallet = useUnifiedWallet();
  const connection = useSolanaConnection();

  const [step, setStep] = useState<Step>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<ProgramData[]>([]);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [proofProgress, setProofProgress] = useState(0);
  const [proofMessage, setProofMessage] = useState('');
  const [existingNullifier, setExistingNullifier] = useState<string | null>(null);
  const [flowResult, setFlowResult] = useState<ProveFlowResult | null>(null);

  // Privacy & Network state
  const [privacyAvailable, setPrivacyAvailable] = useState(false);
  const [privacyProvider, setPrivacyProvider] = useState<PrivacyProvider>('none');
  const [networkName, setNetworkName] = useState<string>('');
  const [costEstimate, setCostEstimate] = useState<{
    verificationCost: number;
    privacyCost: number;
    networkFees: number;
    totalCost: number;
  } | null>(null);

  // Check privacy availability and network on mount
  useEffect(() => {
    async function checkPrivacyAndNetwork() {
      try {
        const { getPrivacyInfo, estimateProveFlowCost } = await import('@/lib/prove-flow');
        const privacyInfo = await getPrivacyInfo(connection);

        setPrivacyAvailable(privacyInfo.available);
        setPrivacyProvider(privacyInfo.provider);
        setNetworkName(privacyInfo.network);

        // Estimate costs
        const estimate = await estimateProveFlowCost(connection, !privacyInfo.available);
        setCostEstimate({
          verificationCost: estimate.verificationCost,
          privacyCost: estimate.privacyCost,
          networkFees: estimate.networkFees,
          totalCost: estimate.totalCost,
        });
      } catch {
        setPrivacyAvailable(false);
        setNetworkName('unknown');
      }
    }
    checkPrivacyAndNetwork();
  }, [connection]);

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

        const nullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'developer');

        const [deployed, used] = await Promise.all([
          isProgramDeployed(connection),
          isNullifierUsed(connection, nullifier),
          preloadCircuits(),
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
    const stepOrder = ['connect', 'fetch', 'ready', 'proving', 'complete'];
    if (step === 'checking') return [];
    if (step === 'already-verified') return stepOrder;
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
      setStep('ready');
    } catch (err) {
      setStep('connect');
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [wallet.publicKey]);

  const handleProve = useCallback(async () => {
    if (!wallet.publicKey || programs.length === 0) return;
    setLoading(true);
    setError(null);
    setProofProgress(0);
    setProofMessage('Initializing...');
    setStep('proving');

    try {
      const { proveDevReputation } = await import('@/lib/prove-flow');

      const progressCallback = (progress: ProveFlowProgress) => {
        setProofProgress(progress.percentage);
        setProofMessage(progress.message);
      };

      const result = await proveDevReputation(
        {
          walletPubkey: wallet.publicKey.toBase58(),
          programs,
          minTvl: 10000,
        },
        {
          wallet,
          connection,
          skipPrivacy: !privacyAvailable,
          useVerifierService: true,
          onProgress: progressCallback,
          timeoutMs: 600000,
        }
      );

      setFlowResult(result);

      if (result.success && result.verification) {
        setVerificationResult(result.verification);
        setStep('complete');

        // Store nullifier for airdrop registration
        if (result.proof?.nullifier && typeof window !== 'undefined') {
          localStorage.setItem('vouch_nullifier', result.proof.nullifier);
          localStorage.setItem('vouch_proof_type', 'developer');
        }
      } else {
        setError(result.error || 'Verification failed');
        setStep('ready');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prove');
      setStep('ready');
    } finally {
      setLoading(false);
    }
  }, [wallet, connection, programs, privacyAvailable]);

  const handleReset = useCallback(() => {
    setStep('connect');
    setLoading(false);
    setError(null);
    setPrograms([]);
    setVerificationResult(null);
    setProofProgress(0);
    setProofMessage('');
    setFlowResult(null);
  }, []);

  const totalTVL = programs.reduce((sum, p) => sum + p.estimatedTVL, 0);
  const meetsThreshold = totalTVL >= 10000;

  const getSolscanUrl = (signature: string) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    return `https://solscan.io/tx/${signature}?cluster=${network}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] to-[#1A2428] text-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Badge
            variant="secondary"
            className="backdrop-blur-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 px-4 py-2 rounded-full mb-4"
          >
            <Code2 className="w-4 h-4 mr-2" />
            Developer Proof
          </Badge>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight mb-3">
            Developer Reputation
          </h1>
          <p className="text-neutral-300 text-lg max-w-xl mx-auto">
            Prove you&apos;ve deployed successful programs without revealing your identity
          </p>
        </div>

        {/* Network Badge */}
        {networkName && (
          <div className="flex justify-center mb-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono ${
              networkName === 'mainnet'
                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}>
              <Globe className="w-3 h-3" />
              {networkName.toUpperCase()}
              {networkName !== 'mainnet' && (
                <span className="text-neutral-500">• Privacy pools unavailable</span>
              )}
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator steps={STEPS} currentStep={step} completedSteps={getCompletedSteps()} />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl backdrop-blur-sm bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
          <div className="p-8">
            {/* Connect Step */}
            {step === 'connect' && (
              <div className="text-center py-8">
                <Shield className="w-16 h-16 text-white/20 mx-auto mb-6" />
                {!wallet.publicKey ? (
                  <>
                    <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
                    <p className="text-neutral-400 mb-6">
                      Connect the wallet that deployed your Solana programs
                    </p>
                    <WalletButton />
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-neutral-500 mb-1 font-mono uppercase tracking-wider">
                        Connected Wallet
                      </p>
                      <p className="font-mono text-sm text-white break-all">
                        {wallet.publicKey.toBase58()}
                      </p>
                    </div>

                    {/* Privacy & Cost Info */}
                    <div className={`p-4 rounded-xl border ${
                      privacyAvailable
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-white/10 bg-white/5'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        {privacyAvailable ? (
                          <>
                            <EyeOff className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-semibold text-green-400">
                              Privacy Mode Available
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                              ShadowWire
                            </span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 text-neutral-400" />
                            <span className="text-sm font-semibold text-neutral-400">
                              Standard Mode
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-white/10 text-neutral-400 rounded">
                              {networkName !== 'mainnet' ? 'Testnet' : 'Fallback'}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mb-3">
                        {privacyAvailable
                          ? 'Your proof will be submitted through ShadowWire privacy pools. No one can link the transaction to your wallet.'
                          : networkName !== 'mainnet'
                            ? `Privacy pools are only available on mainnet. On ${networkName}, your proof will be submitted from your connected wallet.`
                            : 'Privacy layer unavailable. Your proof will be submitted from your connected wallet.'}
                      </p>

                      {/* Cost Breakdown */}
                      {costEstimate && (
                        <div className="space-y-2 pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-500 flex items-center gap-1">
                              <Coins className="w-3 h-3" />
                              Verification
                            </span>
                            <span className="font-mono text-white">{costEstimate.verificationCost.toFixed(4)} SOL</span>
                          </div>
                          {privacyAvailable && costEstimate.privacyCost > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-500 flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Privacy Fee
                              </span>
                              <span className="font-mono text-white">{costEstimate.privacyCost.toFixed(4)} SOL</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-500 flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Network
                            </span>
                            <span className="font-mono text-white">{costEstimate.networkFees.toFixed(4)} SOL</span>
                          </div>
                          <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
                            <span className="text-neutral-400 font-medium">Total</span>
                            <span className="font-mono font-bold text-white">{costEstimate.totalCost.toFixed(4)} SOL</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleFetchData}
                      disabled={loading}
                      className="w-full text-sm px-8 py-3 h-auto rounded-xl bg-white text-black border border-white/10 shadow-none hover:bg-white/90 transition-none"
                    >
                      {loading ? 'Fetching...' : 'Fetch My Programs'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Checking Step */}
            {step === 'checking' && (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 text-white/80 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Checking Verification Status</h3>
                <p className="text-neutral-400">
                  Verifying if this wallet has already proven developer reputation...
                </p>
              </div>
            )}

            {/* Already Verified Step */}
            {step === 'already-verified' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                  <BadgeCheck className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-green-400 mb-2">
                  Already Verified!
                </h3>
                <p className="text-neutral-400 mb-6">
                  This wallet has already proven developer reputation on-chain.
                </p>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 max-w-md mx-auto">
                  <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-2">
                    Nullifier Hash
                  </p>
                  <p className="font-mono text-xs text-white break-all">
                    {existingNullifier?.slice(0, 32)}...
                  </p>
                </div>
                <p className="text-xs text-neutral-500 mt-4">
                  Each wallet can only verify once per proof type to prevent double-proving.
                </p>
              </div>
            )}

            {/* Fetch Step */}
            {step === 'fetch' && loading && (
              <div className="py-8">
                <ProofLoading status="loading" progress={50} message="Fetching your deployed programs..." />
              </div>
            )}

            {/* Ready Step */}
            {step === 'ready' && !loading && (
              <div className="space-y-6">
                {/* Programs Display */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-white/80" />
                    Your Deployed Programs
                  </h3>
                  <ul className="space-y-2">
                    {programs.map((p, i) => (
                      <li
                        key={i}
                        className="flex justify-between items-center text-sm py-2 border-b border-white/10 last:border-0"
                      >
                        <span className="font-mono text-neutral-400">{p.address.slice(0, 16)}...</span>
                        <span className="text-green-400 font-mono">${p.estimatedTVL.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="font-semibold">Total TVL</span>
                    <span
                      className={`font-mono text-lg ${meetsThreshold ? 'text-green-400' : 'text-red-400'}`}
                    >
                      ${totalTVL.toLocaleString()}
                    </span>
                  </div>
                </div>

                {meetsThreshold ? (
                  <>
                    {/* Privacy Status Banner */}
                    <div className={`p-4 rounded-xl border ${
                      privacyAvailable
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-amber-500/30 bg-amber-500/5'
                    }`}>
                      <div className="flex items-center gap-3">
                        {privacyAvailable ? (
                          <>
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                              <EyeOff className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-green-400">Maximum Privacy</p>
                              <p className="text-xs text-neutral-400">
                                Your proof will be submitted anonymously via ShadowWire
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <Eye className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-amber-400">Standard Mode</p>
                              <p className="text-xs text-neutral-400">
                                Proof is private, but transaction is visible on {networkName}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-neutral-400">
                          Your ZK proof is generated locally in your browser. Your private data (wallet address, TVL details)
                          never leaves your device. Only the cryptographic proof is submitted to Solana.
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={handleProve}
                      disabled={loading}
                      className="w-full text-sm px-8 py-3 h-auto rounded-xl bg-white text-black border border-white/10 shadow-none hover:bg-white/90 transition-none"
                    >
                      {privacyAvailable ? (
                        <>
                          <EyeOff className="mr-2 h-4 w-4" />
                          Prove Privately
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Generate Proof
                        </>
                      )}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div className="text-center p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                    <p className="text-red-400 font-medium">Below $10K TVL threshold</p>
                    <p className="text-sm text-neutral-500 mt-1">Deploy more programs to qualify</p>
                  </div>
                )}
              </div>
            )}

            {/* Proving Step */}
            {step === 'proving' && loading && (
              <div className="py-8">
                <ProofLoading status="loading" progress={proofProgress} message={proofMessage} />
                {privacyAvailable && proofProgress < 30 && (
                  <p className="text-xs text-center text-neutral-500 mt-4">
                    Depositing to ShadowWire privacy pool...
                  </p>
                )}
              </div>
            )}

            {/* Complete Step */}
            {step === 'complete' && verificationResult && (
              <div className="space-y-6">
                <div className="text-center py-4">
                  <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-400 mb-2">
                    Verified On-Chain!
                  </h3>
                  <p className="text-neutral-400">
                    Your developer reputation has been verified and recorded on Solana
                  </p>
                </div>

                {/* Privacy Status */}
                {flowResult && (
                  <div
                    className={`p-4 rounded-xl border ${
                      flowResult.privacyUsed
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-amber-500/30 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {flowResult.privacyUsed ? (
                        <>
                          <EyeOff className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-semibold text-green-400">Maximum Privacy Active</span>
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                            {flowResult.privacyProvider}
                          </span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-semibold text-amber-500">Standard Mode</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400">
                      {flowResult.privacyUsed
                        ? 'Your proof was submitted anonymously. No one can link this to your wallet.'
                        : 'Proof submitted from your connected wallet (visible on-chain).'}
                    </p>
                  </div>
                )}

                {verificationResult.signature && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-2">
                      Transaction Signature
                    </p>
                    <a
                      href={getSolscanUrl(verificationResult.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-white hover:text-white/80 break-all flex items-center gap-2 transition-colors"
                    >
                      {verificationResult.signature.slice(0, 48)}...
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                )}

                {/* Show Shield transaction */}
                {flowResult?.shieldTx && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-2">
                      Privacy Shield TX
                    </p>
                    <p className="font-mono text-xs text-green-400 break-all">
                      {flowResult.shieldTx.slice(0, 48)}...
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleReset}
                  className="w-full text-sm px-8 py-3 h-auto rounded-xl bg-transparent text-white border border-white/20 shadow-none hover:bg-white/10 transition-none"
                >
                  Start New Verification
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

DeveloperPageContent.displayName = 'DeveloperPageContent';
