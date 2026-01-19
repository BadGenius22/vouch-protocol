'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useWalletReady, useSolanaConnection } from '@/components/providers';
import { GlowCard } from '@/components/ui/glow-card';
import { GlowButton } from '@/components/ui/glow-button';
import { StepIndicator } from '@/components/ui/step-indicator';
import { ProofLoading } from '@/components/ui/proof-loading';
import { WalletButton } from '@/components/wallet/wallet-button';
import { getTradingVolume } from '@/app/actions/helius';
import type { TradingVolumeData, VerificationResult } from '@/lib/types';
import type { ProveFlowProgress, ProveFlowResult, PrivacyProvider } from '@/lib/prove-flow';
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  TrendingUp,
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

export default function WhalePage() {
  const walletReady = useWalletReady();

  if (!walletReady) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 text-secondary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <WhalePageContent />;
}

function WhalePageContent() {
  const wallet = useUnifiedWallet();
  const connection = useSolanaConnection();

  const [step, setStep] = useState<Step>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradingData, setTradingData] = useState<TradingVolumeData | null>(null);
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

        const nullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'whale');

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
      const result = await getTradingVolume(wallet.publicKey.toBase58(), 30);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch trading data');
      }
      setTradingData(result.data);
      setStep('ready');
    } catch (err) {
      setStep('connect');
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [wallet.publicKey]);

  const handleProve = useCallback(async () => {
    if (!wallet.publicKey || !tradingData) return;
    setLoading(true);
    setError(null);
    setProofProgress(0);
    setProofMessage('Initializing...');
    setStep('proving');

    try {
      const { proveWhaleTrading } = await import('@/lib/prove-flow');

      const progressCallback = (progress: ProveFlowProgress) => {
        setProofProgress(progress.percentage);
        setProofMessage(progress.message);
      };

      const result = await proveWhaleTrading(
        {
          walletPubkey: wallet.publicKey.toBase58(),
          tradingData,
          minVolume: 50000,
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
          localStorage.setItem('vouch_proof_type', 'whale');
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
  }, [wallet, connection, tradingData, privacyAvailable]);

  const handleReset = useCallback(() => {
    setStep('connect');
    setLoading(false);
    setError(null);
    setTradingData(null);
    setVerificationResult(null);
    setProofProgress(0);
    setProofMessage('');
    setFlowResult(null);
  }, []);

  const meetsThreshold = tradingData ? tradingData.totalVolume >= 50000 : false;

  const getSolscanUrl = (signature: string) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    return `https://solscan.io/tx/${signature}?cluster=${network}`;
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-secondary/30 bg-secondary/5 mb-4">
          <TrendingUp className="w-4 h-4 text-secondary" />
          <span className="text-sm text-secondary font-mono">Whale Proof</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-3">
          Whale <span className="text-secondary text-glow-purple">Trading</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Prove your trading volume without exposing your wallet
        </p>
      </div>

      {/* Network Badge */}
      {networkName && (
        <div className="flex justify-center mb-6">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono ${
            networkName === 'mainnet'
              ? 'bg-accent/10 text-accent border border-accent/30'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          }`}>
            <Globe className="w-3 h-3" />
            {networkName.toUpperCase()}
            {networkName !== 'mainnet' && (
              <span className="text-muted-foreground">• Privacy pools unavailable</span>
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
            <div className="text-center py-8">
              <TrendingUp className="w-16 h-16 text-secondary/30 mx-auto mb-6" />
              {!wallet.publicKey ? (
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
                    <p className="font-mono text-sm text-secondary break-all">
                      {wallet.publicKey.toBase58()}
                    </p>
                  </div>

                  {/* Privacy & Cost Info */}
                  <div className={`p-4 rounded-xl border ${
                    privacyAvailable
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-border/50 bg-muted/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      {privacyAvailable ? (
                        <>
                          <EyeOff className="w-4 h-4 text-accent" />
                          <span className="text-sm font-semibold text-accent">
                            Privacy Mode Available
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded">
                            ShadowWire
                          </span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-muted-foreground">
                            Standard Mode
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                            {networkName !== 'mainnet' ? 'Testnet' : 'Fallback'}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {privacyAvailable
                        ? 'Your proof will be submitted through ShadowWire privacy pools. No one can link the transaction to your wallet.'
                        : networkName !== 'mainnet'
                          ? `Privacy pools are only available on mainnet. On ${networkName}, your proof will be submitted from your connected wallet.`
                          : 'Privacy layer unavailable. Your proof will be submitted from your connected wallet.'}
                    </p>

                    {/* Cost Breakdown */}
                    {costEstimate && (
                      <div className="space-y-2 pt-3 border-t border-border/30">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            Verification
                          </span>
                          <span className="font-mono text-white">{costEstimate.verificationCost.toFixed(4)} SOL</span>
                        </div>
                        {privacyAvailable && costEstimate.privacyCost > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Privacy Fee
                            </span>
                            <span className="font-mono text-white">{costEstimate.privacyCost.toFixed(4)} SOL</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Network
                          </span>
                          <span className="font-mono text-white">{costEstimate.networkFees.toFixed(4)} SOL</span>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-2 border-t border-border/30">
                          <span className="text-muted-foreground font-medium">Total</span>
                          <span className="font-mono font-bold text-secondary">{costEstimate.totalCost.toFixed(4)} SOL</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <GlowButton onClick={handleFetchData} disabled={loading} glowColor="purple" className="w-full">
                    {loading ? 'Fetching...' : 'Fetch Trading History'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </GlowButton>
                </div>
              )}
            </div>
          )}

          {/* Checking Step */}
          {step === 'checking' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-secondary animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-display font-semibold mb-2">Checking Verification Status</h3>
              <p className="text-muted-foreground">
                Verifying if this wallet has already proven whale trading status...
              </p>
            </div>
          )}

          {/* Already Verified Step */}
          {step === 'already-verified' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center mx-auto mb-6 shadow-neon-purple">
                <BadgeCheck className="w-10 h-10 text-secondary" />
              </div>
              <h3 className="text-2xl font-display font-bold text-secondary text-glow-purple mb-2">
                Already Verified!
              </h3>
              <p className="text-muted-foreground mb-6">
                This wallet has already proven whale trading status on-chain.
              </p>
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50 max-w-md mx-auto">
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">
                  Nullifier Hash
                </p>
                <p className="font-mono text-xs text-secondary break-all">
                  {existingNullifier?.slice(0, 32)}...
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Each wallet can only verify once per proof type to prevent double-proving.
              </p>
            </div>
          )}

          {/* Fetch Step */}
          {step === 'fetch' && loading && (
            <div className="py-8">
              <ProofLoading status="loading" progress={50} message="Fetching your trading history..." />
            </div>
          )}

          {/* Ready Step */}
          {step === 'ready' && tradingData && !loading && (
            <div className="space-y-6">
              {/* Trading Data Display */}
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
                  {/* Privacy Status Banner */}
                  <div className={`p-4 rounded-xl border ${
                    privacyAvailable
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-amber-500/30 bg-amber-500/5'
                  }`}>
                    <div className="flex items-center gap-3">
                      {privacyAvailable ? (
                        <>
                          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                            <EyeOff className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-semibold text-accent">Maximum Privacy</p>
                            <p className="text-xs text-muted-foreground">
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
                            <p className="text-xs text-muted-foreground">
                              Proof is private, but transaction is visible on {networkName}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Your ZK proof is generated locally in your browser. Your private data (wallet address, trade details)
                        never leaves your device. Only the cryptographic proof is submitted to Solana.
                      </p>
                    </div>
                  </div>

                  <GlowButton
                    onClick={handleProve}
                    disabled={loading}
                    glowColor={privacyAvailable ? 'green' : 'purple'}
                    className="w-full"
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
                  </GlowButton>
                </>
              ) : (
                <div className="text-center p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                  <p className="text-destructive font-medium">Below $50K volume threshold</p>
                  <p className="text-sm text-muted-foreground mt-1">Keep trading to qualify as a whale</p>
                </div>
              )}
            </div>
          )}

          {/* Proving Step */}
          {step === 'proving' && loading && (
            <div className="py-8">
              <ProofLoading status="loading" progress={proofProgress} message={proofMessage} />
              {privacyAvailable && proofProgress < 30 && (
                <p className="text-xs text-center text-muted-foreground mt-4">
                  Depositing to ShadowWire privacy pool...
                </p>
              )}
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && verificationResult && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-4 shadow-neon-green">
                  <CheckCircle className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-2xl font-display font-bold text-accent text-glow-green mb-2">
                  Verified On-Chain!
                </h3>
                <p className="text-muted-foreground">
                  Your whale trading status has been verified and recorded on Solana
                </p>
              </div>

              {/* Privacy Status */}
              {flowResult && (
                <div
                  className={`p-4 rounded-xl border ${
                    flowResult.privacyUsed
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {flowResult.privacyUsed ? (
                      <>
                        <EyeOff className="w-4 h-4 text-accent" />
                        <span className="text-sm font-semibold text-accent">Maximum Privacy Active</span>
                        <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded">
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
                  <p className="text-xs text-muted-foreground">
                    {flowResult.privacyUsed
                      ? 'Your proof was submitted anonymously. No one can link this to your wallet.'
                      : 'Proof submitted from your connected wallet (visible on-chain).'}
                  </p>
                </div>
              )}

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

              {/* Show Shield transaction */}
              {flowResult?.shieldTx && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">
                    Privacy Shield TX
                  </p>
                  <p className="font-mono text-xs text-accent break-all">
                    {flowResult.shieldTx.slice(0, 48)}...
                  </p>
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
