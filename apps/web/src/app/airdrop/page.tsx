'use client';

import { useState, useEffect } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useWalletReady, useSolanaConnection } from '@/components/providers';
import { GlowCard } from '@/components/ui/glow-card';
import { GlowButton } from '@/components/ui/glow-button';
import { StepIndicator } from '@/components/ui/step-indicator';
import { WalletButton } from '@/components/wallet/wallet-button';
import { AirdropRegistration } from '@/components/airdrop/AirdropRegistration';
import { AirdropClaim } from '@/components/airdrop/AirdropClaim';
import { type AirdropCampaign } from '@/lib/airdrop-registry';
import { Loader2, BadgeCheck, Code2, TrendingUp } from 'lucide-react';

type PageState = 'browse' | 'register' | 'claim';

// Real campaign on devnet - VOUCH token airdrop
// Campaign created via: scripts/create-devnet-campaign.ts
const DEVNET_CAMPAIGNS: AirdropCampaign[] = [
  {
    campaignId: 'db4811899b3214b0e3191ca1500c2e8be0c487cfa477eab1b5020c655cebeb6b',
    creator: '3LQdxe988qYTwSS3dUo4uigYdoZEGNMNPGhLEizKXGrK',
    name: 'Vouch Devnet Airdrop',
    tokenMint: 'GRL7X2VtBZnKUmrag6zXjFUno8q8HCMssTA3W8oiP8mx', // VOUCH token
    baseAmount: 100_000_000_000, // 100 VOUCH base for everyone
    devBonus: 50_000_000_000, // +50 VOUCH for devs (total 150 VOUCH)
    whaleBonus: 150_000_000_000, // +150 VOUCH for whales (total 250 VOUCH)
    registrationDeadline: new Date('2026-02-17T14:31:57.000Z'),
    status: 'open',
    totalRegistrations: 0,
    openRegistrations: 0,
    devRegistrations: 0,
    whaleRegistrations: 0,
    createdAt: new Date(),
  },
];

const STEPS = [
  { id: 'connect', label: 'Connect Wallet' },
  { id: 'proof', label: 'Proof (Optional)' },
  { id: 'register', label: 'Register' },
  { id: 'claim', label: 'Claim' },
];

export default function AirdropPage() {
  const walletReady = useWalletReady();

  // Show loading state during SSR or before wallet providers mount
  if (!walletReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return <AirdropPageContent />;
}

function AirdropPageContent() {
  const wallet = useUnifiedWallet();
  const connection = useSolanaConnection();

  const [pageState, setPageState] = useState<PageState>('browse');
  const [selectedCampaign, setSelectedCampaign] = useState<AirdropCampaign | null>(null);
  const [campaigns] = useState<AirdropCampaign[]>(DEVNET_CAMPAIGNS);
  const [currentStep, setCurrentStep] = useState('connect');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [nullifier, setNullifier] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{
    checking: boolean;
    devVerified: boolean;
    whaleVerified: boolean;
  }>({ checking: false, devVerified: false, whaleVerified: false });

  // Determine current step based on wallet and nullifier
  // Note: Proof step is optional - users can skip to register
  useEffect(() => {
    const completed: string[] = [];
    let current = 'connect';

    if (wallet.publicKey) {
      completed.push('connect');
      // Skip proof step if user goes to register without verification
      current = pageState === 'browse' ? 'register' : current;
    }
    if (nullifier) {
      completed.push('proof');
    }
    if (pageState === 'register') {
      current = 'register';
    } else if (pageState === 'claim') {
      completed.push('register');
      current = 'claim';
    }

    setCompletedSteps(completed);
    setCurrentStep(current);
  }, [wallet.publicKey, nullifier, pageState]);

  // Check for stored nullifier from proof flow
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedNullifier = localStorage.getItem('vouch_nullifier');
      if (storedNullifier) {
        setNullifier(storedNullifier);
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

        // Check if program is deployed
        const deployed = await isProgramDeployed(connection);
        if (!deployed) {
          setVerificationStatus({ checking: false, devVerified: false, whaleVerified: false });
          return;
        }

        // Compute nullifiers (synchronous)
        const devNullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'developer');
        const whaleNullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'whale');

        // Check both verifications in parallel
        const [devUsed, whaleUsed] = await Promise.all([
          isNullifierUsed(connection, devNullifier),
          isNullifierUsed(connection, whaleNullifier),
        ]);

        setVerificationStatus({
          checking: false,
          devVerified: devUsed,
          whaleVerified: whaleUsed,
        });

        // Store the appropriate nullifier if verified
        if (devUsed && typeof window !== 'undefined') {
          localStorage.setItem('vouch_nullifier', devNullifier);
          setNullifier(devNullifier);
        } else if (whaleUsed && typeof window !== 'undefined') {
          localStorage.setItem('vouch_nullifier', whaleNullifier);
          setNullifier(whaleNullifier);
        }
      } catch (err) {
        console.error('Error checking verification status:', err);
        setVerificationStatus({ checking: false, devVerified: false, whaleVerified: false });
      }
    }

    checkVerificationStatus();
  }, [wallet.publicKey, connection]);

  const handleSelectCampaign = (campaign: AirdropCampaign) => {
    setSelectedCampaign(campaign);
    setPageState('register');
  };

  const handleRegistrationComplete = () => {
    // Registration complete - ShadowWire address is now auto-set to connected wallet
    // The AirdropRegistration component handles localStorage storage
    setPageState('claim');
  };

  const getStatusColor = (status: AirdropCampaign['status']) => {
    switch (status) {
      case 'open':
        return 'text-green-500';
      case 'registration_closed':
        return 'text-yellow-500';
      case 'completed':
        return 'text-gray-500';
    }
  };

  const getStatusLabel = (status: AirdropCampaign['status']) => {
    switch (status) {
      case 'open':
        return 'Open for Registration';
      case 'registration_closed':
        return 'Registration Closed';
      case 'completed':
        return 'Completed';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
            Private Airdrops
          </h1>
          <p className="text-slate-400 text-lg">
            Register and claim airdrops privately via ShadowWire
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator steps={STEPS} currentStep={currentStep} completedSteps={completedSteps} />
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          <GlowButton
            variant={pageState === 'browse' ? 'default' : 'outline'}
            onClick={() => {
              setPageState('browse');
              setSelectedCampaign(null);
            }}
          >
            Browse Campaigns
          </GlowButton>
          <GlowButton
            variant={pageState === 'claim' ? 'default' : 'outline'}
            onClick={() => setPageState('claim')}
          >
            Claim Airdrop
          </GlowButton>
        </div>

        {/* Wallet Connection */}
        {!wallet.publicKey && (
          <GlowCard className="max-w-md mx-auto mb-8">
            <div className="p-6 text-center">
              <h2 className="text-xl font-semibold text-white mb-4">Connect Your Wallet</h2>
              <p className="text-slate-400 mb-6">
                Connect your Solana wallet to browse campaigns and register for airdrops.
              </p>
              <div className="flex justify-center">
                <WalletButton />
              </div>
            </div>
          </GlowCard>
        )}

        {/* Verification Status - Show when wallet connected and browsing */}
        {wallet.publicKey && pageState === 'browse' && (
          <GlowCard className="max-w-lg mx-auto mb-8 border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
            <div className="p-6">
              {verificationStatus.checking ? (
                <div className="text-center py-2">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Checking verification status...</p>
                </div>
              ) : verificationStatus.devVerified || verificationStatus.whaleVerified ? (
                <>
                  <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5" />
                    Verification Status
                  </h3>
                  <div className="flex gap-4 justify-center mb-3">
                    {verificationStatus.devVerified && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-cyan-900/30 border border-cyan-500/30 rounded-lg">
                        <Code2 className="w-4 h-4 text-cyan-400" />
                        <span className="text-cyan-300 font-medium">Developer Verified</span>
                      </div>
                    )}
                    {verificationStatus.whaleVerified && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-300 font-medium">Whale Verified</span>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm text-center">
                    You&apos;re eligible for bonus rewards when registering for airdrops!
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-2">
                    🎁 Want Bonus Tokens?
                  </h3>
                  <p className="text-slate-400 mb-4">
                    Anyone can register for airdrops! Complete a proof to unlock{' '}
                    <span className="text-cyan-400 font-medium">dev bonus</span> or{' '}
                    <span className="text-purple-400 font-medium">whale bonus</span> rewards.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <GlowButton
                      variant="outline"
                      onClick={() => (window.location.href = '/developer')}
                      className="border-cyan-500/50 hover:border-cyan-400"
                    >
                      Dev Proof (+bonus)
                    </GlowButton>
                    <GlowButton
                      variant="outline"
                      onClick={() => (window.location.href = '/whale')}
                      className="border-purple-500/50 hover:border-purple-400"
                    >
                      Whale Proof (+bonus)
                    </GlowButton>
                  </div>
                </>
              )}
            </div>
          </GlowCard>
        )}

        {/* Main Content */}
        {pageState === 'browse' && (
          <div className="space-y-6">
            {/* Devnet Notice */}
            <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3 flex items-center gap-3">
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded">
                DEVNET
              </span>
              <p className="text-sm text-cyan-300">
                Live on Solana Devnet! Register to receive real VOUCH tokens. Transactions are
                recorded on-chain.
              </p>
            </div>

            <h2 className="text-2xl font-semibold text-white mb-4">Active Campaigns</h2>

            {campaigns.length === 0 ? (
              <GlowCard className="p-6 text-center">
                <p className="text-slate-400">No active campaigns found.</p>
              </GlowCard>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {campaigns.map((campaign) => (
                  <GlowCard key={campaign.campaignId} className="p-6 relative">
                    {/* Devnet Badge */}
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded">
                      DEVNET
                    </span>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-white">{campaign.name}</h3>
                        <p className={`text-sm ${getStatusColor(campaign.status)}`}>
                          {getStatusLabel(campaign.status)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {/* Tiered Rewards Display */}
                      <div className="grid grid-cols-3 gap-2 text-center py-2">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-xs text-slate-400">Base</p>
                          <p className="text-sm font-bold text-white">
                            {(campaign.baseAmount / 1e9).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-cyan-900/20 rounded-lg p-2 border border-cyan-500/20">
                          <p className="text-xs text-cyan-400">Dev</p>
                          <p className="text-sm font-bold text-cyan-300">
                            {((campaign.baseAmount + campaign.devBonus) / 1e9).toFixed(2)}
                          </p>
                        </div>
                        <div className="bg-purple-900/20 rounded-lg p-2 border border-purple-500/20">
                          <p className="text-xs text-purple-400">Whale</p>
                          <p className="text-sm font-bold text-purple-300">
                            {((campaign.baseAmount + campaign.whaleBonus) / 1e9).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Deadline:</span>
                        <span className="text-white">
                          {campaign.registrationDeadline.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Registrations:</span>
                        <span className="text-white text-xs">
                          {campaign.totalRegistrations} total ({campaign.openRegistrations} open,{' '}
                          {campaign.devRegistrations} dev, {campaign.whaleRegistrations} whale)
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-700">
                      <GlowButton
                        className="w-full"
                        disabled={campaign.status !== 'open' || !wallet.publicKey}
                        onClick={() => handleSelectCampaign(campaign)}
                      >
                        {!wallet.publicKey
                          ? 'Connect Wallet'
                          : campaign.status !== 'open'
                            ? 'Registration Closed'
                            : 'Register Now'}
                      </GlowButton>
                    </div>
                  </GlowCard>
                ))}
              </div>
            )}

            {/* Privacy Explainer */}
            <GlowCard className="p-6 mt-8">
              <h3 className="text-lg font-semibold text-white mb-4">How Private Airdrops Work</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-3xl mb-2">1</div>
                  <p className="text-sm text-slate-300">
                    Complete a Vouch proof to verify your developer or whale status
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-3xl mb-2">2</div>
                  <p className="text-sm text-slate-300">
                    Register for campaigns using your ShadowWire address
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-3xl mb-2">3</div>
                  <p className="text-sm text-slate-300">
                    Projects distribute tokens privately (amounts hidden)
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-3xl mb-2">4</div>
                  <p className="text-sm text-slate-300">
                    Claim your tokens to any wallet privately
                  </p>
                </div>
              </div>
              <p className="text-center text-green-400 mt-4 font-medium">
                No one can see who received how much!
              </p>
            </GlowCard>
          </div>
        )}

        {pageState === 'register' && selectedCampaign && (
          <div className="max-w-xl mx-auto">
            <button
              onClick={() => {
                setPageState('browse');
                setSelectedCampaign(null);
              }}
              className="text-slate-400 hover:text-white mb-4 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Campaigns
            </button>

            <AirdropRegistration
              campaign={selectedCampaign}
              nullifier={nullifier || undefined}
              devVerified={verificationStatus.devVerified}
              whaleVerified={verificationStatus.whaleVerified}
              onRegistered={handleRegistrationComplete}
              className="bg-slate-900/50 border-slate-700"
            />
          </div>
        )}

        {pageState === 'claim' && (
          <div className="max-w-xl mx-auto">
            <AirdropClaim className="bg-slate-900/50 border-slate-700" />

            {/* Additional Info */}
            <GlowCard className="mt-6 p-6">
              <h3 className="text-lg font-semibold text-white mb-3">About Private Claims</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>Your airdrop balance is private - only you can see it</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>Withdraw to any Solana wallet address</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>The withdrawal transaction hides the sender</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  <span>No one can link your real wallet to the airdrop amount</span>
                </li>
              </ul>
            </GlowCard>
          </div>
        )}
      </div>
    </div>
  );
}
