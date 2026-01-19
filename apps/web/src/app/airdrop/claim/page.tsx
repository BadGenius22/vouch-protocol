'use client';

import { useWalletReady } from '@/components/providers';
import { AirdropClaim } from '@/components/airdrop/AirdropClaim';
import { GlowCard } from '@/components/ui/glow-card';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AirdropClaimPage() {
  const walletReady = useWalletReady();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
            Claim Your Airdrop
          </h1>
          <p className="text-slate-400 text-lg">
            Privately claim your tokens via ShadowWire
          </p>
        </div>

        {/* Back Link */}
        <div className="max-w-xl mx-auto mb-6">
          <Link
            href="/airdrop"
            className="text-slate-400 hover:text-white flex items-center gap-2 text-sm"
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
          </Link>
        </div>

        {/* Claim Component */}
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
      </div>
    </div>
  );
}
