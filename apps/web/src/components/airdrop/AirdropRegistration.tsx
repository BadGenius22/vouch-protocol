'use client';

import { useState, useEffect } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useSolanaConnection } from '@/components/providers';
import { Transaction } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  Info,
} from 'lucide-react';
import {
  buildRegisterForAirdropInstruction,
  buildRegisterForAirdropOpenInstruction,
  isRegisteredForCampaign,
  isOpenRegisteredForCampaign,
  calculateAirdropAmount,
  type AirdropCampaign,
} from '@/lib/airdrop-registry';

interface AirdropRegistrationProps {
  campaign: AirdropCampaign;
  nullifier?: string;
  devVerified?: boolean;
  whaleVerified?: boolean;
  onRegistered?: () => void;
  className?: string;
}

type RegistrationStatus =
  | 'idle'
  | 'checking'
  | 'loading'
  | 'success'
  | 'error'
  | 'already_registered';

// Flow step indicator
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

// Privacy explainer component
function PrivacyExplainer() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">How Privacy Works</span>
        </div>
        <Info className="w-4 h-4 text-slate-400" />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 text-sm text-slate-400">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <Circle className="w-3 h-3 text-cyan-400" />
            </div>
            <div>
              <p className="text-white font-medium">1. You register</p>
              <p>Your wallet joins the airdrop list</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <EyeOff className="w-3 h-3 text-purple-400" />
            </div>
            <div>
              <p className="text-white font-medium">2. Tokens go to privacy pool</p>
              <p>Project sends tokens through ShadowWire - amounts hidden!</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Eye className="w-3 h-3 text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium">3. You claim to ANY wallet</p>
              <p>No one can link your registration wallet to your destination</p>
            </div>
          </div>

          <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 mt-2">
            <p className="text-green-400 text-xs">
              <span className="font-medium">Result:</span> Your on-chain activity and trading
              history stay private. The project knows you qualified, but can&apos;t track where
              tokens end up.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AirdropRegistration({
  campaign,
  nullifier,
  devVerified = false,
  whaleVerified = false,
  onRegistered,
  className,
}: AirdropRegistrationProps) {
  const wallet = useUnifiedWallet();
  const connection = useSolanaConnection();

  const [status, setStatus] = useState<RegistrationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Auto-select best proof type: whale > dev > open
  const bestProofType: 'whale' | 'developer' | null = whaleVerified
    ? 'whale'
    : devVerified
      ? 'developer'
      : null;

  const useVerified = bestProofType !== null && nullifier;

  // Calculate amounts
  const baseAmount = campaign.baseAmount / 1e9;
  const userAmount = useVerified
    ? calculateAirdropAmount(campaign, bestProofType) / 1e9
    : baseAmount;

  // Check if already registered
  useEffect(() => {
    const checkRegistration = async () => {
      if (!wallet.publicKey) return;

      setStatus('checking');
      try {
        const campaignIdBytes = hexToBytes(campaign.campaignId);

        const { getCampaignPDA } = await import('@/lib/airdrop-registry');
        const [campaignPDA] = getCampaignPDA(campaignIdBytes);
        const campaignAccount = await connection.getAccountInfo(campaignPDA);

        if (!campaignAccount) {
          setStatus('idle');
          return;
        }

        const isOpenRegistered = await isOpenRegisteredForCampaign(
          connection,
          campaignIdBytes,
          wallet.publicKey
        );

        if (isOpenRegistered) {
          setStatus('already_registered');
          return;
        }

        if (nullifier) {
          const nullifierBytes = hexToBytes(nullifier);
          const isVerifiedRegistered = await isRegisteredForCampaign(
            connection,
            campaignIdBytes,
            nullifierBytes
          );

          if (isVerifiedRegistered) {
            setStatus('already_registered');
            return;
          }
        }

        setStatus('idle');
      } catch {
        setStatus('idle');
      }
    };

    checkRegistration();
  }, [nullifier, wallet.publicKey, campaign.campaignId, connection]);

  const handleRegister = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setStatus('error');
      setErrorMessage('Wallet not connected');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const campaignIdBytes = hexToBytes(campaign.campaignId);
      // Use connected wallet as the ShadowWire receiving address
      const shadowWireAddress = wallet.publicKey.toBase58();

      const { getCampaignPDA, getOpenRegistrationPDA } = await import('@/lib/airdrop-registry');
      const [campaignPDA] = getCampaignPDA(campaignIdBytes);

      let instruction;

      if (useVerified && nullifier) {
        const nullifierBytes = hexToBytes(nullifier);
        instruction = buildRegisterForAirdropInstruction(
          wallet.publicKey,
          campaignIdBytes,
          nullifierBytes,
          shadowWireAddress
        );
      } else {
        const [openRegPDA] = getOpenRegistrationPDA(campaignPDA, wallet.publicKey);
        console.log('[Register] Open registration PDA:', openRegPDA.toBase58());
        instruction = buildRegisterForAirdropOpenInstruction(
          wallet.publicKey,
          campaignIdBytes,
          shadowWireAddress
        );
      }

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      setTxSignature(signature);
      setStatus('success');

      if (typeof window !== 'undefined') {
        const regType = bestProofType || 'open';
        localStorage.setItem('vouch_registration_type', regType);
      }

      onRegistered?.();
    } catch (err) {
      setStatus('error');
      const errorMsg = err instanceof Error ? err.message : 'Registration failed';
      if (errorMsg.includes('already in use') || errorMsg.includes('already been processed')) {
        setErrorMessage('You have already registered for this campaign');
      } else {
        setErrorMessage(errorMsg);
      }
    }
  };

  if (!wallet.publicKey) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Private Airdrop</CardTitle>
          <CardDescription>Connect your wallet to register</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Connect your wallet to check eligibility</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isDeadlinePassed = new Date() > campaign.registrationDeadline;
  const isCampaignOpen = campaign.status === 'open' && !isDeadlinePassed;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {campaign.name}
          <span className="text-xs font-normal px-2 py-0.5 bg-green-500/20 text-green-300 rounded">
            Private Airdrop
          </span>
        </CardTitle>
        <CardDescription>Claim tokens without revealing your wallet history</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Flow Steps */}
        <FlowSteps currentStep={status === 'success' || status === 'already_registered' ? 2 : 1} />

        {/* Reward Display */}
        <div
          className={`rounded-lg p-4 border ${
            bestProofType === 'whale'
              ? 'bg-purple-500/10 border-purple-500/30'
              : bestProofType === 'developer'
                ? 'bg-cyan-500/10 border-cyan-500/30'
                : 'bg-slate-800/50 border-slate-700'
          }`}
        >
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-slate-400">Your Reward</span>
              {bestProofType && (
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded ${
                    bestProofType === 'whale'
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-cyan-500/20 text-cyan-300'
                  }`}
                >
                  {bestProofType === 'whale' ? '🐋 Whale' : '👨‍💻 Dev'} Bonus
                </span>
              )}
            </div>
            <span
              className={`text-2xl font-bold ${
                bestProofType === 'whale'
                  ? 'text-purple-300'
                  : bestProofType === 'developer'
                    ? 'text-cyan-300'
                    : 'text-white'
              }`}
            >
              {userAmount.toFixed(0)} tokens
            </span>
          </div>

          {!bestProofType && (
            <p className="text-xs text-slate-500 mt-2">
              Want more?{' '}
              <a href="/developer" className="text-cyan-400 hover:underline">
                Verify as developer
              </a>{' '}
              or{' '}
              <a href="/whale" className="text-purple-400 hover:underline">
                whale
              </a>{' '}
              to get bonus tokens!
            </p>
          )}
        </div>

        {/* Campaign Status */}
        {!isCampaignOpen && (
          <div className="rounded-md bg-yellow-500/20 p-3 text-sm text-yellow-300">
            {isDeadlinePassed
              ? 'Registration deadline has passed.'
              : 'Campaign is not open for registration.'}
          </div>
        )}

        {/* Already Registered */}
        {status === 'already_registered' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-green-300 font-medium">Already Registered!</p>
                <p className="text-xs text-green-400/70">
                  Wait for the project to distribute tokens, then claim.
                </p>
              </div>
            </div>
            <a
              href="/airdrop"
              className="block w-full text-center py-3 px-4 rounded-md bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:from-cyan-600 hover:to-purple-600 transition-colors"
            >
              Go to Claim Page →
            </a>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-green-300 font-medium">Registration Complete!</p>
                <p className="text-xs text-green-400/70">
                  You&apos;ll receive {userAmount.toFixed(0)} tokens when distribution begins.
                </p>
              </div>
            </div>

            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
              >
                View transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <div className="rounded-md bg-slate-800/50 border border-slate-700 p-3 text-xs text-slate-400">
              <p className="font-medium text-slate-300 mb-1">What happens next?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Project distributes tokens to all registrants privately</li>
                <li>Check the Claim page when distribution is announced</li>
                <li>Claim to any wallet - no one can trace it back to you!</li>
              </ol>
            </div>

            <a
              href="/airdrop"
              className="block w-full text-center py-3 px-4 rounded-md bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:from-cyan-600 hover:to-purple-600 transition-colors"
            >
              Go to Claim Page →
            </a>
          </div>
        )}

        {/* Error State */}
        {errorMessage && (
          <div className="rounded-md bg-red-500/20 p-3 text-sm text-red-300">{errorMessage}</div>
        )}

        {/* Register Button - One Click! */}
        {status !== 'already_registered' && status !== 'success' && (
          <Button
            onClick={handleRegister}
            className="w-full h-12 text-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
            disabled={status === 'loading' || status === 'checking' || !isCampaignOpen}
          >
            {status === 'checking' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Checking...
              </>
            ) : status === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5 mr-2" />
                Register for {userAmount.toFixed(0)} Tokens
              </>
            )}
          </Button>
        )}

        {/* Privacy Explainer */}
        <PrivacyExplainer />
      </CardContent>
    </Card>
  );
}

// Helper function
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}
