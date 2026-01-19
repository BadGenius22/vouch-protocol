'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useSolanaConnection } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wallet,
  ArrowRight,
  ExternalLink,
  Clock,
  RefreshCw,
  Shield,
  Sparkles,
} from 'lucide-react';
import {
  isOpenRegisteredForCampaign,
  isRegisteredForCampaign,
} from '@/lib/airdrop-registry';

interface AirdropClaimProps {
  className?: string;
}

// Campaign info
const CAMPAIGN_INFO = {
  campaignId: 'db4811899b3214b0e3191ca1500c2e8be0c487cfa477eab1b5020c655cebeb6b',
  tokenSymbol: 'VOUCH',
  tokenMint: 'GRL7X2VtBZnKUmrag6zXjFUno8q8HCMssTA3W8oiP8mx',
  baseAmount: 100_000_000_000,
  devBonus: 50_000_000_000,
  whaleBonus: 150_000_000_000,
};

type RegistrationType = 'whale' | 'developer' | 'open' | null;
type ClaimStatus = 'idle' | 'claiming' | 'success' | 'error';
type PageStatus =
  | 'loading'
  | 'not_connected'
  | 'campaign_not_found'
  | 'not_registered'
  | 'awaiting_distribution'
  | 'ready_to_claim'
  | 'claimed';

// Flow step indicator (same as registration)
function FlowSteps({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Register', desc: 'Join the airdrop' },
    { num: 2, label: 'Wait', desc: 'Project distributes' },
    { num: 3, label: 'Claim', desc: 'Withdraw privately' },
  ];

  return (
    <div className="flex items-center justify-between mb-6 px-2">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step.num < currentStep
                  ? 'bg-green-500 text-white'
                  : step.num === currentStep
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                    : 'bg-slate-700 text-slate-400'
              }`}
            >
              {step.num < currentStep ? <CheckCircle2 className="w-4 h-4" /> : step.num}
            </div>
            <span
              className={`text-xs mt-1 ${step.num === currentStep ? 'text-white font-medium' : 'text-slate-500'}`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight
              className={`w-4 h-4 mx-3 ${step.num < currentStep ? 'text-green-500' : 'text-slate-600'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Claim progress indicator
function ClaimProgress({ stage }: { stage: 'generating' | 'signing' | 'submitting' | 'confirming' }) {
  const stages = [
    { id: 'generating', label: 'Generating proof', icon: Shield },
    { id: 'signing', label: 'Sign transaction', icon: Wallet },
    { id: 'submitting', label: 'Submitting', icon: ArrowRight },
    { id: 'confirming', label: 'Confirming', icon: CheckCircle2 },
  ];

  const currentIndex = stages.findIndex((s) => s.id === stage);

  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const Icon = s.icon;
        const isActive = s.id === stage;
        const isComplete = i < currentIndex;
        const isPending = i > currentIndex;

        return (
          <div
            key={s.id}
            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
              isActive ? 'bg-cyan-500/10' : ''
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                isComplete
                  ? 'bg-green-500'
                  : isActive
                    ? 'bg-cyan-500'
                    : 'bg-slate-700'
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="w-3 h-3 text-white" />
              ) : isActive ? (
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              ) : (
                <Icon className="w-3 h-3 text-slate-400" />
              )}
            </div>
            <span
              className={`text-sm ${
                isComplete
                  ? 'text-green-400'
                  : isActive
                    ? 'text-cyan-300 font-medium'
                    : isPending
                      ? 'text-slate-500'
                      : ''
              }`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function getRewardAmount(type: RegistrationType): number {
  const base = CAMPAIGN_INFO.baseAmount / 1e9;
  if (type === 'whale') return base + CAMPAIGN_INFO.whaleBonus / 1e9;
  if (type === 'developer') return base + CAMPAIGN_INFO.devBonus / 1e9;
  return base;
}

export function AirdropClaim({ className }: AirdropClaimProps) {
  const wallet = useUnifiedWallet();
  const connection = useSolanaConnection();

  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [registrationType, setRegistrationType] = useState<RegistrationType>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const [verificationStatus, setVerificationStatus] = useState<{
    devVerified: boolean;
    whaleVerified: boolean;
  }>({ devVerified: false, whaleVerified: false });

  const [shadowBalance, setShadowBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const [destinationWallet, setDestinationWallet] = useState('');
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('idle');
  const [claimStage, setClaimStage] = useState<'generating' | 'signing' | 'submitting' | 'confirming'>('generating');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTxSignature, setClaimTxSignature] = useState<string | null>(null);

  // Check verification status
  useEffect(() => {
    async function checkVerificationStatus() {
      if (!wallet.publicKey) {
        setVerificationStatus({ devVerified: false, whaleVerified: false });
        return;
      }

      try {
        const { computeNullifierForWallet } = await import('@/lib/proof');
        const { isNullifierUsed, isProgramDeployed } = await import('@/lib/verify');

        const deployed = await isProgramDeployed(connection);
        if (!deployed) {
          setVerificationStatus({ devVerified: false, whaleVerified: false });
          return;
        }

        const devNullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'developer');
        const whaleNullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'whale');

        const [devUsed, whaleUsed] = await Promise.all([
          isNullifierUsed(connection, devNullifier),
          isNullifierUsed(connection, whaleNullifier),
        ]);

        setVerificationStatus({ devVerified: devUsed, whaleVerified: whaleUsed });
      } catch (err) {
        console.error('[AirdropClaim] Error checking verification:', err);
        setVerificationStatus({ devVerified: false, whaleVerified: false });
      }
    }

    checkVerificationStatus();
  }, [wallet.publicKey, connection]);

  // Check ShadowWire balance
  const checkShadowBalance = useCallback(async () => {
    if (!wallet.publicKey) return 0;

    setIsLoadingBalance(true);
    try {
      const { getShadowBalance } = await import('@/lib/shadowwire');
      const balance = await getShadowBalance(wallet.publicKey.toBase58(), 'SOL');
      setShadowBalance(balance.available);
      return balance.available;
    } catch (err) {
      console.error('[AirdropClaim] Error checking balance:', err);
      setShadowBalance(0);
      return 0;
    } finally {
      setIsLoadingBalance(false);
    }
  }, [wallet.publicKey]);

  // Main status check
  useEffect(() => {
    async function checkStatus() {
      if (!wallet.publicKey) {
        setPageStatus('not_connected');
        return;
      }

      setPageStatus('loading');

      try {
        const campaignIdBytes = hexToBytes(CAMPAIGN_INFO.campaignId);

        const { getCampaignPDA } = await import('@/lib/airdrop-registry');
        const [campaignPDA] = getCampaignPDA(campaignIdBytes);
        const campaignAccount = await connection.getAccountInfo(campaignPDA);

        if (!campaignAccount) {
          setPageStatus('campaign_not_found');
          return;
        }

        let isRegistered = false;

        const isOpenRegistered = await isOpenRegisteredForCampaign(
          connection,
          campaignIdBytes,
          wallet.publicKey
        );

        if (isOpenRegistered) {
          isRegistered = true;
        }

        if (!isRegistered) {
          const storedNullifier =
            typeof window !== 'undefined' ? localStorage.getItem('vouch_nullifier') : null;

          if (storedNullifier) {
            const nullifierBytes = hexToBytes(storedNullifier);
            const isVerifiedRegistered = await isRegisteredForCampaign(
              connection,
              campaignIdBytes,
              nullifierBytes
            );
            if (isVerifiedRegistered) {
              isRegistered = true;
            }
          }
        }

        if (!isRegistered) {
          setPageStatus('not_registered');
          return;
        }

        if (verificationStatus.whaleVerified) {
          setRegistrationType('whale');
        } else if (verificationStatus.devVerified) {
          setRegistrationType('developer');
        } else {
          setRegistrationType('open');
        }

        const balance = await checkShadowBalance();

        if (balance > 0) {
          setPageStatus('ready_to_claim');
        } else {
          setPageStatus('awaiting_distribution');
        }
      } catch (err) {
        console.error('[AirdropClaim] Error:', err);
        setPageStatus('not_registered');
      }
    }

    checkStatus();
  }, [wallet.publicKey, connection, refreshCount, verificationStatus, checkShadowBalance]);

  const handleRefresh = () => setRefreshCount((c) => c + 1);

  const useCurrentWallet = () => {
    if (wallet.publicKey) {
      setDestinationWallet(wallet.publicKey.toBase58());
    }
  };

  const generateFreshWallet = () => {
    // Generate a reminder to use a fresh wallet
    setClaimError('For maximum privacy, create a new wallet in your wallet app and paste its address here.');
  };

  const handleClaim = async () => {
    if (!destinationWallet) {
      setClaimError('Please enter a destination wallet address');
      return;
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destinationWallet)) {
      setClaimError('Invalid Solana wallet address');
      return;
    }

    if (shadowBalance <= 0) {
      setClaimError('No balance available to withdraw');
      return;
    }

    setClaimStatus('claiming');
    setClaimStage('generating');
    setClaimError(null);

    try {
      // Stage 1: Generate proof
      setClaimStage('generating');
      await new Promise((r) => setTimeout(r, 500)); // Brief pause for UX

      // Stage 2: Prepare transfer
      setClaimStage('signing');
      const { privateTransfer } = await import('@/lib/shadowwire');

      // Stage 3: Submit
      setClaimStage('submitting');
      const transferAmount = shadowBalance * 0.95;
      const txSignature = await privateTransfer(
        wallet,
        destinationWallet,
        transferAmount,
        'SOL',
        'external',
        { timeoutMs: 60000 }
      );

      // Stage 4: Confirm
      setClaimStage('confirming');

      if (txSignature) {
        setClaimTxSignature(txSignature);
        setClaimStatus('success');
        setShadowBalance(0);
        setPageStatus('claimed');
      }
    } catch (err) {
      console.error('[AirdropClaim] Claim error:', err);
      setClaimStatus('error');
      setClaimError(err instanceof Error ? err.message : 'Failed to withdraw');
    }
  };

  const rewardAmount = getRewardAmount(registrationType);

  // Determine current flow step
  const currentStep =
    pageStatus === 'not_registered'
      ? 1
      : pageStatus === 'awaiting_distribution'
        ? 2
        : pageStatus === 'ready_to_claim' || pageStatus === 'claimed'
          ? 3
          : 2;

  if (pageStatus === 'not_connected') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Claim Airdrop</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Connect your wallet to check claim status</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pageStatus === 'loading') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Claim {CAMPAIGN_INFO.tokenSymbol}
            <span className="text-xs font-normal px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
              DEVNET
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span className="text-slate-300">Checking your status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Claim {CAMPAIGN_INFO.tokenSymbol}
          <span className="text-xs font-normal px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
            DEVNET
          </span>
        </CardTitle>
        <CardDescription>Withdraw your tokens privately to any wallet</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Flow Steps */}
        <FlowSteps currentStep={currentStep as 1 | 2 | 3} />

        {/* Campaign Not Found */}
        {pageStatus === 'campaign_not_found' && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-amber-300 font-medium">Campaign Not Found</p>
              <p className="text-xs text-amber-400/70">Campaign may not be deployed yet.</p>
            </div>
          </div>
        )}

        {/* Not Registered */}
        {pageStatus === 'not_registered' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <AlertCircle className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-300 font-medium">Not Registered</p>
                <p className="text-xs text-slate-500">Register first to participate.</p>
              </div>
            </div>
            <a
              href="/airdrop"
              className="block w-full text-center py-3 px-4 rounded-md bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium"
            >
              Go to Registration
            </a>
          </div>
        )}

        {/* Awaiting Distribution */}
        {pageStatus === 'awaiting_distribution' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-green-300 font-medium">Registered</p>
                <p className="text-xs text-green-400/70">
                  {registrationType === 'whale' && '🐋 Whale tier'}
                  {registrationType === 'developer' && '👨‍💻 Developer tier'}
                  {registrationType === 'open' && 'Base tier'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-amber-300 font-medium">Awaiting Distribution</p>
                <p className="text-xs text-amber-400/70">
                  Expected reward: <span className="font-bold">{rewardAmount} tokens</span>
                </p>
              </div>
            </div>

            <Button onClick={handleRefresh} variant="outline" className="w-full" disabled={isLoadingBalance}>
              {isLoadingBalance ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check for Distribution
            </Button>
          </div>
        )}

        {/* Ready to Claim */}
        {pageStatus === 'ready_to_claim' && claimStatus !== 'success' && (
          <div className="space-y-4">
            {/* Balance */}
            <div className="rounded-lg p-4 border border-green-500/30 bg-green-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-green-300">Ready to Claim!</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Available:</span>
                <span className="text-2xl font-bold text-white">{shadowBalance.toFixed(4)} SOL</span>
              </div>
            </div>

            {/* Claiming in progress */}
            {claimStatus === 'claiming' ? (
              <div className="rounded-lg p-4 border border-cyan-500/30 bg-cyan-500/5">
                <p className="text-sm font-medium text-cyan-300 mb-3">Claiming privately...</p>
                <ClaimProgress stage={claimStage} />
              </div>
            ) : (
              <>
                {/* Destination Input */}
                <div className="space-y-2">
                  <Label htmlFor="destination" className="text-white flex items-center gap-2">
                    Destination Wallet
                    <span className="text-xs text-green-400">(Use a fresh wallet for privacy!)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="destination"
                      placeholder="Enter any Solana wallet"
                      value={destinationWallet}
                      onChange={(e) => {
                        setDestinationWallet(e.target.value);
                        setClaimError(null);
                      }}
                      className="flex-1 bg-slate-800/50 border-slate-700"
                    />
                    <Button variant="outline" size="icon" onClick={useCurrentWallet} title="Use current wallet">
                      <Wallet className="w-4 h-4" />
                    </Button>
                  </div>
                  <button
                    onClick={generateFreshWallet}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    💡 Why use a fresh wallet?
                  </button>
                </div>

                {claimError && (
                  <div className="rounded-md bg-red-500/20 p-3 text-sm text-red-300">{claimError}</div>
                )}

                <Button
                  onClick={handleClaim}
                  disabled={!destinationWallet || shadowBalance <= 0}
                  className="w-full h-12 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Claim Privately
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </>
            )}
          </div>
        )}

        {/* Claimed */}
        {(pageStatus === 'claimed' || claimStatus === 'success') && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-green-300">Claim Successful!</p>
              <p className="text-sm text-green-400/70 mt-1">
                Tokens sent privately to your destination wallet
              </p>
            </div>

            <div className="rounded-md bg-slate-800/50 p-3 text-sm">
              <p className="text-slate-400 mb-1">Destination:</p>
              <p className="font-mono text-white text-xs break-all">{destinationWallet}</p>
            </div>

            {claimTxSignature && (
              <a
                href={`https://explorer.solana.com/tx/${claimTxSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
              >
                View on Explorer <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3 text-xs text-green-400">
              <p className="font-medium mb-1">🔒 Privacy Protected</p>
              <p className="text-green-400/70">
                No one can link your registration wallet to this destination. Your on-chain history
                remains private.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
