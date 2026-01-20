'use client';

import { useState, useEffect } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useWalletReady, useSolanaConnection } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WalletButton } from '@/components/wallet/wallet-button';
import { AirdropClaim } from '@/components/airdrop/AirdropClaim';
import { type AirdropCampaign } from '@/lib/airdrop-registry';
import {
  Loader2,
  BadgeCheck,
  Code2,
  TrendingUp,
  CheckCircle2,
  Wallet,
  Gift,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { Transaction } from '@solana/web3.js';
import {
  buildRegisterForAirdropInstruction,
  buildRegisterForAirdropOpenInstruction,
  isRegisteredForCampaign,
  isOpenRegisteredForCampaign,
  calculateAirdropAmount,
  getCampaignPDA,
} from '@/lib/airdrop-registry';

// Real campaign on devnet - VOUCH token airdrop (V2 - updated program)
const CAMPAIGN: AirdropCampaign = {
  campaignId: '7fac1fcd64e4e9360dcb92830768add1493732e1ef52506643e4690cd3cab68d',
  creator: '3LQdxe988qYTwSS3dUo4uigYdoZEGNMNPGhLEizKXGrK',
  name: 'Vouch Devnet Airdrop V2',
  tokenMint: 'GRL7X2VtBZnKUmrag6zXjFUno8q8HCMssTA3W8oiP8mx', // VOUCH token
  baseAmount: 100_000_000_000, // 100 VOUCH base for everyone
  devBonus: 50_000_000_000, // +50 VOUCH for devs (total 150 VOUCH)
  whaleBonus: 150_000_000_000, // +150 VOUCH for whales (total 250 VOUCH)
  registrationDeadline: new Date('2026-02-18T11:31:40.000Z'),
  status: 'open',
  totalRegistrations: 0,
  openRegistrations: 0,
  devRegistrations: 0,
  whaleRegistrations: 0,
  createdAt: new Date(),
};

type UserStatus = 'loading' | 'not_connected' | 'not_registered' | 'registered' | 'claimed';

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Simple 3-step indicator
function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Connect', icon: Wallet },
    { num: 2, label: 'Register', icon: Gift },
    { num: 3, label: 'Claim', icon: Shield },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isCompleted = step.num < currentStep;
        const isCurrent = step.num === currentStep;

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-neutral-500'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span
                className={`text-xs mt-2 font-medium ${
                  isCurrent ? 'text-white' : isCompleted ? 'text-green-400' : 'text-neutral-500'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-white/10'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AirdropPage() {
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

  return <AirdropPageContent />;
}

function AirdropPageContent() {
  const wallet = useUnifiedWallet();
  const connection = useSolanaConnection();

  const [userStatus, setUserStatus] = useState<UserStatus>('loading');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{
    checking: boolean;
    devVerified: boolean;
    whaleVerified: boolean;
  }>({ checking: false, devVerified: false, whaleVerified: false });

  // Check for stored nullifier and registration tx from previous sessions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedNullifier = localStorage.getItem('vouch_nullifier');
      if (storedNullifier) {
        setNullifier(storedNullifier);
      }
      const storedRegTx = localStorage.getItem('vouch_registration_tx');
      if (storedRegTx) {
        setTxSignature(storedRegTx);
      }
    }
  }, []);

  // Check on-chain verification status when wallet connects
  useEffect(() => {
    async function checkVerificationStatus() {
      if (!wallet.publicKey) {
        setVerificationStatus({ checking: false, devVerified: false, whaleVerified: false });
        return;
      }

      setVerificationStatus((prev) => ({ ...prev, checking: true }));

      try {
        const { computeNullifierForWallet } = await import('@/lib/proof');
        const { isNullifierUsed, isProgramDeployed } = await import('@/lib/verify');

        const deployed = await isProgramDeployed(connection);
        if (!deployed) {
          setVerificationStatus({ checking: false, devVerified: false, whaleVerified: false });
          return;
        }

        const devNullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'developer');
        const whaleNullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'whale');

        const [devUsed, whaleUsed] = await Promise.all([
          isNullifierUsed(connection, devNullifier),
          isNullifierUsed(connection, whaleNullifier),
        ]);

        setVerificationStatus({
          checking: false,
          devVerified: devUsed,
          whaleVerified: whaleUsed,
        });

        // Store the best nullifier - whale (highest bonus) > dev
        if (whaleUsed && typeof window !== 'undefined') {
          localStorage.setItem('vouch_nullifier', whaleNullifier);
          setNullifier(whaleNullifier);
        } else if (devUsed && typeof window !== 'undefined') {
          localStorage.setItem('vouch_nullifier', devNullifier);
          setNullifier(devNullifier);
        }
      } catch {
        setVerificationStatus({ checking: false, devVerified: false, whaleVerified: false });
      }
    }

    checkVerificationStatus();
  }, [wallet.publicKey, connection]);

  // Check registration status
  useEffect(() => {
    async function checkStatus() {
      if (!wallet.publicKey) {
        setUserStatus('not_connected');
        return;
      }

      setUserStatus('loading');

      try {
        const campaignIdBytes = hexToBytes(CAMPAIGN.campaignId);
        const [campaignPDA] = getCampaignPDA(campaignIdBytes);
        const campaignAccount = await connection.getAccountInfo(campaignPDA);

        if (!campaignAccount) {
          setUserStatus('not_registered');
          return;
        }

        // Check if already registered
        const isOpenRegistered = await isOpenRegisteredForCampaign(
          connection,
          campaignIdBytes,
          wallet.publicKey
        );

        if (isOpenRegistered) {
          setUserStatus('registered');
          return;
        }

        // Check verified registration
        if (nullifier) {
          const nullifierBytes = hexToBytes(nullifier);
          const isVerifiedRegistered = await isRegisteredForCampaign(
            connection,
            campaignIdBytes,
            nullifierBytes
          );

          if (isVerifiedRegistered) {
            setUserStatus('registered');
            return;
          }
        }

        setUserStatus('not_registered');
      } catch {
        setUserStatus('not_registered');
      }
    }

    checkStatus();
  }, [wallet.publicKey, connection, nullifier]);

  // Calculate reward amount
  const bestProofType: 'whale' | 'developer' | null = verificationStatus.whaleVerified
    ? 'whale'
    : verificationStatus.devVerified
      ? 'developer'
      : null;

  const useVerified = bestProofType !== null && nullifier;
  const rewardAmount = useVerified
    ? calculateAirdropAmount(CAMPAIGN, bestProofType) / 1e9
    : CAMPAIGN.baseAmount / 1e9;

  // Handle registration
  const handleRegister = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setRegisterError('Wallet not connected');
      return;
    }

    setIsRegistering(true);
    setRegisterError(null);

    try {
      const campaignIdBytes = hexToBytes(CAMPAIGN.campaignId);
      const shadowWireAddress = wallet.publicKey.toBase58();

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
        instruction = buildRegisterForAirdropOpenInstruction(
          wallet.publicKey,
          campaignIdBytes,
          shadowWireAddress
        );
      }

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      const signedTx = await wallet.signTransaction(transaction);

      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      });

      try {
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
      } catch {
        // Check status anyway
        const status = await connection.getSignatureStatus(signature);
        if (status.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        // Otherwise assume success
      }

      setTxSignature(signature);
      setUserStatus('registered');

      if (typeof window !== 'undefined') {
        const regType = bestProofType || 'open';
        localStorage.setItem('vouch_registration_type', regType);
        localStorage.setItem('vouch_registration_tx', signature);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Registration failed';
      if (errorMsg.includes('already in use') || errorMsg.includes('already been processed')) {
        setUserStatus('registered');
      } else {
        setRegisterError(errorMsg);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // Determine current step
  const currentStep: 1 | 2 | 3 =
    userStatus === 'not_connected'
      ? 1
      : userStatus === 'not_registered'
        ? 2
        : 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000] to-[#1A2428] text-white">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <Badge
            variant="secondary"
            className="backdrop-blur-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 px-4 py-2 rounded-full mb-4"
          >
            <Gift className="w-4 h-4 mr-2" />
            Token Airdrop
          </Badge>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight mb-2">
            VOUCH Airdrop
          </h1>
          <p className="text-neutral-300">
            Claim tokens privately to any wallet
          </p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Devnet Badge */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3 mb-6">
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded">
            DEVNET
          </span>
          <p className="text-sm text-neutral-300">
            Live on Solana Devnet - Transactions are recorded on-chain
          </p>
        </div>

        {/* Main Content Card */}
        <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
          {/* Loading */}
          {userStatus === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-white/80 animate-spin mx-auto mb-4" />
              <p className="text-neutral-400">Checking your status...</p>
            </div>
          )}

          {/* Step 1: Connect Wallet */}
          {userStatus === 'not_connected' && (
            <div className="text-center py-6">
              <Wallet className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h2>
              <p className="text-neutral-400 mb-6">
                Connect to check eligibility and register for the airdrop
              </p>
              <div className="flex justify-center">
                <WalletButton />
              </div>
            </div>
          )}

          {/* Step 2: Register */}
          {userStatus === 'not_registered' && (
            <div className="space-y-6">
              {/* Verification Status */}
              {verificationStatus.checking ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <Loader2 className="w-5 h-5 text-white/80 animate-spin" />
                  <span className="text-neutral-300">Checking verification status...</span>
                </div>
              ) : verificationStatus.devVerified || verificationStatus.whaleVerified ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                  <BadgeCheck className="w-5 h-5 text-green-400" />
                  <div className="flex-1">
                    <span className="text-green-300 font-medium">Verified!</span>
                    <div className="flex gap-2 mt-1">
                      {verificationStatus.whaleVerified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white text-xs rounded">
                          <TrendingUp className="w-3 h-3" /> Whale
                        </span>
                      )}
                      {verificationStatus.devVerified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white text-xs rounded">
                          <Code2 className="w-3 h-3" /> Developer
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-neutral-300 mb-3">
                    Want bonus tokens? Complete a proof first:
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => (window.location.href = '/developer')}
                      className="flex-1 text-sm px-4 py-2 h-auto rounded-xl bg-transparent text-white border border-white/20 shadow-none hover:bg-white/10 transition-none"
                    >
                      <Code2 className="w-4 h-4 mr-1" /> Dev (+50)
                    </Button>
                    <Button
                      onClick={() => (window.location.href = '/whale')}
                      className="flex-1 text-sm px-4 py-2 h-auto rounded-xl bg-transparent text-white border border-white/20 shadow-none hover:bg-white/10 transition-none"
                    >
                      <TrendingUp className="w-4 h-4 mr-1" /> Whale (+150)
                    </Button>
                  </div>
                </div>
              )}

              {/* Reward Display */}
              <div
                className={`rounded-xl p-4 border ${
                  bestProofType
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-neutral-400">Your Reward</span>
                    {bestProofType && (
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400"
                      >
                        {bestProofType === 'whale' ? 'Whale' : 'Dev'} Bonus
                      </span>
                    )}
                  </div>
                  <span className="text-2xl font-bold text-white">
                    {rewardAmount.toFixed(0)} VOUCH
                  </span>
                </div>
              </div>

              {/* Error */}
              {registerError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
                  {registerError}
                </div>
              )}

              {/* Register Button */}
              <Button
                onClick={handleRegister}
                disabled={isRegistering}
                className="w-full text-sm px-8 py-3 h-auto rounded-xl bg-white text-black border border-white/10 shadow-none hover:bg-white/90 transition-none"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <Gift className="w-5 h-5 mr-2" />
                    Register for {rewardAmount.toFixed(0)} VOUCH
                  </>
                )}
              </Button>

              {/* Tx Link */}
              {txSignature && (
                <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-neutral-500 text-center">Transaction Hash:</p>
                  <p className="font-mono text-xs text-white text-center break-all">
                    {txSignature}
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <a
                      href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-white/80 hover:text-white"
                    >
                      Solscan <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-white/80 hover:text-white"
                    >
                      Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Claim */}
          {(userStatus === 'registered' || userStatus === 'claimed') && (
            <div>
              {/* Registration Success Banner */}
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <div className="flex-1">
                    <p className="text-green-300 font-medium">Registered!</p>
                    <p className="text-xs text-green-400/70">
                      {bestProofType === 'whale' && 'Whale tier - 250 VOUCH'}
                      {bestProofType === 'developer' && 'Developer tier - 150 VOUCH'}
                      {!bestProofType && 'Base tier - 100 VOUCH'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-500/20">
                  {txSignature ? (
                    <>
                      <p className="text-xs text-neutral-400 mb-1">Registration TX:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-neutral-300 truncate flex-1">{txSignature}</code>
                        <a
                          href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/80 hover:text-white"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </>
                  ) : (
                    <a
                      href={`https://solscan.io/account/${wallet.publicKey?.toBase58()}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-white/80 hover:text-white"
                    >
                      View your transactions on Solscan <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Claim Component */}
              <AirdropClaim className="border-0 bg-transparent shadow-none p-0" />
            </div>
          )}
        </div>

        {/* Privacy Info */}
        <div className="mt-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            Privacy Protection
          </h3>
          <ul className="space-y-1 text-xs text-neutral-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
              <span>Claim to any wallet - no one can trace it back to you</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
              <span>Your trading history and on-chain activity stay private</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
              <span>Zero-knowledge proofs verify eligibility without revealing identity</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
