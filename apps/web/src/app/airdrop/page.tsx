'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useWalletReady, useSolanaConnection } from '@/components/providers';
import { GlowCard } from '@/components/ui/glow-card';
import { GlowButton } from '@/components/ui/glow-button';
import { StepIndicator } from '@/components/ui/step-indicator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WalletButton } from '@/components/wallet/wallet-button';
import { AirdropRegistration } from '@/components/airdrop/AirdropRegistration';
import { AirdropClaim } from '@/components/airdrop/AirdropClaim';
import {
  type AirdropCampaign,
  validateShadowWireAddress,
} from '@/lib/airdrop-registry';
import { Loader2 } from 'lucide-react';

type PageState = 'browse' | 'register' | 'claim';

// Mock campaigns for demo - in production, these would be fetched from the chain
const MOCK_CAMPAIGNS: AirdropCampaign[] = [
  {
    campaignId: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234',
    creator: 'Creator1111111111111111111111111111111111111',
    name: 'Vouch Early Adopters',
    tokenMint: 'So11111111111111111111111111111111111111112',
    baseAmount: 500_000_000, // 0.5 SOL base for everyone
    devBonus: 500_000_000, // +0.5 SOL for devs (total 1 SOL)
    whaleBonus: 4_500_000_000, // +4.5 SOL for whales (total 5 SOL)
    registrationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    status: 'open',
    totalRegistrations: 42,
    openRegistrations: 0,
    devRegistrations: 30,
    whaleRegistrations: 12,
    createdAt: new Date(),
  },
  {
    campaignId: 'b2c3d4e5f67890123456789012345678901234567890123456789012345a',
    creator: 'Creator2222222222222222222222222222222222222',
    name: 'DeFi Builders Reward',
    tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    baseAmount: 50_000_000, // 50 USDC base
    devBonus: 50_000_000, // +50 USDC for devs (total 100 USDC)
    whaleBonus: 450_000_000, // +450 USDC for whales (total 500 USDC)
    registrationDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    status: 'open',
    totalRegistrations: 18,
    openRegistrations: 0,
    devRegistrations: 15,
    whaleRegistrations: 3,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
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
  const [campaigns] = useState<AirdropCampaign[]>(MOCK_CAMPAIGNS);
  const [currentStep, setCurrentStep] = useState('connect');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [nullifier, setNullifier] = useState<string | null>(null);

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

  const handleSelectCampaign = (campaign: AirdropCampaign) => {
    setSelectedCampaign(campaign);
    setPageState('register');
  };

  const handleRegistrationComplete = (shadowWireAddress: string) => {
    // Store the ShadowWire address for claiming later
    if (typeof window !== 'undefined') {
      localStorage.setItem('vouch_shadowwire_address', shadowWireAddress);
    }
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
              <h2 className="text-xl font-semibold text-white mb-4">
                Connect Your Wallet
              </h2>
              <p className="text-slate-400 mb-6">
                Connect your Solana wallet to browse campaigns and register for airdrops.
              </p>
              <div className="flex justify-center">
                <WalletButton />
              </div>
            </div>
          </GlowCard>
        )}

        {/* Optional Verification Info - Only show when browsing */}
        {wallet.publicKey && !nullifier && pageState === 'browse' && (
          <GlowCard className="max-w-md mx-auto mb-8 border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">
                🎁 Want Bonus Tokens?
              </h3>
              <p className="text-slate-400 mb-4">
                Anyone can register for airdrops! Complete a proof to unlock <span className="text-cyan-400 font-medium">dev bonus</span> or <span className="text-purple-400 font-medium">whale bonus</span> rewards.
              </p>
              <div className="flex gap-4 justify-center">
                <GlowButton
                  variant="outline"
                  onClick={() => window.location.href = '/developer'}
                  className="border-cyan-500/50 hover:border-cyan-400"
                >
                  Dev Proof (+bonus)
                </GlowButton>
                <GlowButton
                  variant="outline"
                  onClick={() => window.location.href = '/whale'}
                  className="border-purple-500/50 hover:border-purple-400"
                >
                  Whale Proof (+bonus)
                </GlowButton>
              </div>
            </div>
          </GlowCard>
        )}

        {/* Main Content */}
        {pageState === 'browse' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Active Campaigns
            </h2>

            {campaigns.length === 0 ? (
              <GlowCard className="p-6 text-center">
                <p className="text-slate-400">No active campaigns found.</p>
              </GlowCard>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {campaigns.map((campaign) => (
                  <GlowCard key={campaign.campaignId} className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          {campaign.name}
                        </h3>
                        <p className={`text-sm ${getStatusColor(campaign.status)}`}>
                          {getStatusLabel(campaign.status)}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {campaign.campaignId.slice(0, 8)}...
                      </span>
                    </div>

                    <div className="space-y-3 mb-4">
                      {/* Tiered Rewards Display */}
                      <div className="grid grid-cols-3 gap-2 text-center py-2">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <p className="text-xs text-slate-400">Base</p>
                          <p className="text-sm font-bold text-white">{(campaign.baseAmount / 1e9).toFixed(2)}</p>
                        </div>
                        <div className="bg-cyan-900/20 rounded-lg p-2 border border-cyan-500/20">
                          <p className="text-xs text-cyan-400">Dev</p>
                          <p className="text-sm font-bold text-cyan-300">{((campaign.baseAmount + campaign.devBonus) / 1e9).toFixed(2)}</p>
                        </div>
                        <div className="bg-purple-900/20 rounded-lg p-2 border border-purple-500/20">
                          <p className="text-xs text-purple-400">Whale</p>
                          <p className="text-sm font-bold text-purple-300">{((campaign.baseAmount + campaign.whaleBonus) / 1e9).toFixed(2)}</p>
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
                          {campaign.totalRegistrations} total ({campaign.openRegistrations} open, {campaign.devRegistrations} dev, {campaign.whaleRegistrations} whale)
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
              <h3 className="text-lg font-semibold text-white mb-4">
                How Private Airdrops Work
              </h3>
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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
              onRegistered={handleRegistrationComplete}
              className="bg-slate-900/50 border-slate-700"
            />
          </div>
        )}

        {pageState === 'claim' && (
          <div className="max-w-xl mx-auto">
            <AirdropClaim
              token="SOL"
              className="bg-slate-900/50 border-slate-700"
            />

            {/* Additional Info */}
            <GlowCard className="mt-6 p-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                About Private Claims
              </h3>
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
