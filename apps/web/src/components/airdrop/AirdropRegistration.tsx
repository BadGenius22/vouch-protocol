'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useSolanaConnection } from '@/components/providers';
import { Transaction } from '@solana/web3.js';
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
  buildRegisterForAirdropInstruction,
  buildRegisterForAirdropOpenInstruction,
  isRegisteredForCampaign,
  isOpenRegisteredForCampaign,
  validateShadowWireAddress,
  calculateAirdropAmount,
  type AirdropCampaign,
} from '@/lib/airdrop-registry';

interface AirdropRegistrationProps {
  campaign: AirdropCampaign;
  nullifier?: string;
  /** Which proof type(s) the user has verified */
  devVerified?: boolean;
  whaleVerified?: boolean;
  onRegistered?: (shadowWireAddress: string) => void;
  className?: string;
}

type RegistrationStatus = 'idle' | 'checking' | 'loading' | 'success' | 'error' | 'already_registered';

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

  const [shadowWireAddress, setShadowWireAddress] = useState('');
  const [status, setStatus] = useState<RegistrationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  // Auto-select best option: whale > dev > open
  const bestProofType: 'whale' | 'developer' | null = whaleVerified
    ? 'whale'
    : devVerified
      ? 'developer'
      : null;

  const useVerified = bestProofType !== null && nullifier;

  // Calculate amounts for display
  const baseAmount = campaign.baseAmount / 1e9;
  const devTotal = (campaign.baseAmount + campaign.devBonus) / 1e9;
  const whaleTotal = (campaign.baseAmount + campaign.whaleBonus) / 1e9;

  // User gets the best amount automatically
  const userAmount = useVerified
    ? calculateAirdropAmount(campaign, bestProofType) / 1e9
    : baseAmount;

  // Check if already registered (both open and verified)
  useEffect(() => {
    const checkRegistration = async () => {
      if (!wallet.publicKey) return;

      setStatus('checking');
      try {
        const campaignIdBytes = hexToBytes(campaign.campaignId);

        // Check if campaign exists on-chain first (demo mode if not)
        const { getCampaignPDA } = await import('@/lib/airdrop-registry');
        const [campaignPDA] = getCampaignPDA(campaignIdBytes);
        const campaignAccount = await connection.getAccountInfo(campaignPDA);

        // Demo mode: campaign doesn't exist, skip registration check
        if (!campaignAccount) {
          setStatus('idle');
          return;
        }

        // Check open registration first
        const isOpenRegistered = await isOpenRegisteredForCampaign(
          connection,
          campaignIdBytes,
          wallet.publicKey
        );

        if (isOpenRegistered) {
          setStatus('already_registered');
          return;
        }

        // Check verified registration if nullifier exists
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

  // Use wallet address as ShadowWire address by default
  const useWalletAddress = useCallback(() => {
    if (wallet.publicKey) {
      setShadowWireAddress(wallet.publicKey.toBase58());
    }
  }, [wallet.publicKey]);

  const handleRegister = async () => {
    if (!shadowWireAddress) {
      setStatus('error');
      setErrorMessage('Please enter your ShadowWire address');
      return;
    }

    if (!validateShadowWireAddress(shadowWireAddress)) {
      setStatus('error');
      setErrorMessage('Invalid ShadowWire address format');
      return;
    }

    if (!wallet.publicKey || !wallet.signTransaction) {
      setStatus('error');
      setErrorMessage('Wallet not connected or cannot sign transactions');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const campaignIdBytes = hexToBytes(campaign.campaignId);
      console.log('[AirdropRegistration] Campaign ID:', campaign.campaignId);
      console.log('[AirdropRegistration] Wallet:', wallet.publicKey.toBase58());

      // Get PDAs for logging
      const { getCampaignPDA, getOpenRegistrationPDA } = await import('@/lib/airdrop-registry');
      const [campaignPDA] = getCampaignPDA(campaignIdBytes);
      console.log('[AirdropRegistration] Campaign PDA:', campaignPDA.toBase58());

      // Build instruction based on verification status
      let instruction;

      // Auto-select verified registration if user has a proof, otherwise open
      if (useVerified && nullifier) {
        const nullifierBytes = hexToBytes(nullifier);
        instruction = buildRegisterForAirdropInstruction(
          wallet.publicKey,
          campaignIdBytes,
          nullifierBytes,
          shadowWireAddress
        );
        console.log('[AirdropRegistration] Using verified registration');
      } else {
        // Open registration - anyone can register
        const [openRegPDA] = getOpenRegistrationPDA(campaignPDA, wallet.publicKey);
        console.log('[AirdropRegistration] Open registration PDA:', openRegPDA.toBase58());
        instruction = buildRegisterForAirdropOpenInstruction(
          wallet.publicKey,
          campaignIdBytes,
          shadowWireAddress
        );
      }

      // Create and send transaction
      const transaction = new Transaction().add(instruction);
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signedTx = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      setTxSignature(signature);
      setStatus('success');

      // Store registration type in localStorage for claim page
      if (typeof window !== 'undefined') {
        const regType = bestProofType || 'open';
        localStorage.setItem('vouch_registration_type', regType);
        console.log('[AirdropRegistration] Stored registration type:', regType);
      }

      onRegistered?.(shadowWireAddress);
    } catch (err) {
      setStatus('error');
      const errorMsg = err instanceof Error ? err.message : 'Registration failed';
      // Provide more helpful error messages
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
          <CardTitle>Airdrop Registration</CardTitle>
          <CardDescription>Register to receive private airdrops</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please connect your wallet to register for airdrops.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isDeadlinePassed = new Date() > campaign.registrationDeadline;
  const isCampaignOpen = campaign.status === 'open' && !isDeadlinePassed;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Register for {campaign.name}</CardTitle>
        <CardDescription>
          Register your ShadowWire address to receive private airdrops.
          Your identity remains hidden while receiving tokens!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tiered Rewards Info */}
        <div className="rounded-md bg-gradient-to-r from-purple-500/10 to-cyan-500/10 p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Tiered Rewards</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-800/50 rounded-lg p-2">
              <p className="text-xs text-slate-400">Base</p>
              <p className="text-lg font-bold text-white">{baseAmount.toFixed(2)}</p>
              <p className="text-xs text-slate-500">Anyone</p>
            </div>
            <div className="bg-cyan-900/30 rounded-lg p-2 border border-cyan-500/30">
              <p className="text-xs text-cyan-400">Developer</p>
              <p className="text-lg font-bold text-cyan-300">{devTotal.toFixed(2)}</p>
              <p className="text-xs text-cyan-500">+{(campaign.devBonus / 1e9).toFixed(2)} bonus</p>
            </div>
            <div className="bg-purple-900/30 rounded-lg p-2 border border-purple-500/30">
              <p className="text-xs text-purple-400">Whale</p>
              <p className="text-lg font-bold text-purple-300">{whaleTotal.toFixed(2)}</p>
              <p className="text-xs text-purple-500">+{(campaign.whaleBonus / 1e9).toFixed(2)} bonus</p>
            </div>
          </div>
        </div>

        {/* Your Amount - Auto-selected best option */}
        <div className={`rounded-md p-3 border ${
          bestProofType === 'whale'
            ? 'bg-purple-500/10 border-purple-500/30'
            : bestProofType === 'developer'
              ? 'bg-cyan-500/10 border-cyan-500/30'
              : 'bg-green-500/10 border-green-500/30'
        }`}>
          <div className="flex justify-between items-center">
            <span className={`text-sm ${
              bestProofType === 'whale'
                ? 'text-purple-400'
                : bestProofType === 'developer'
                  ? 'text-cyan-400'
                  : 'text-green-400'
            }`}>
              {bestProofType === 'whale'
                ? '🐋 Whale Verified'
                : bestProofType === 'developer'
                  ? '👨‍💻 Developer Verified'
                  : 'Your Reward'}
            </span>
            <span className={`text-xl font-bold ${
              bestProofType === 'whale'
                ? 'text-purple-300'
                : bestProofType === 'developer'
                  ? 'text-cyan-300'
                  : 'text-green-300'
            }`}>{userAmount.toFixed(2)} tokens</span>
          </div>
          <p className={`text-xs mt-1 ${
            bestProofType === 'whale'
              ? 'text-purple-500'
              : bestProofType === 'developer'
                ? 'text-cyan-500'
                : 'text-green-500'
          }`}>
            {bestProofType === 'whale'
              ? `Base + Whale bonus (best rate!)`
              : bestProofType === 'developer'
                ? `Base + Developer bonus`
                : 'Base amount (verify to get bonus!)'}
          </p>
        </div>

        {/* Campaign Status Warning */}
        {!isCampaignOpen && (
          <div className="rounded-md bg-yellow-500/20 p-3 text-sm text-yellow-300">
            {isDeadlinePassed
              ? 'Registration deadline has passed.'
              : 'Campaign is not open for registration.'}
          </div>
        )}

        {/* Show both verifications badge */}
        {devVerified && whaleVerified && (
          <div className="rounded-md bg-gradient-to-r from-cyan-500/10 to-purple-500/10 p-3 border border-purple-500/20">
            <p className="text-sm font-medium text-white">
              🎉 You have both verifications! Auto-selected whale bonus (highest rate).
            </p>
          </div>
        )}

        {/* Credential Status - Prompt to verify if not verified */}
        {!devVerified && !whaleVerified && (
          <div className="rounded-md bg-slate-800/50 p-3">
            <p className="text-sm font-medium text-white">Want more tokens?</p>
            <p className="text-sm text-slate-400 mt-1">
              Complete a <a href="/developer" className="text-cyan-400 hover:underline">developer</a> or{' '}
              <a href="/whale" className="text-purple-400 hover:underline">whale</a> proof to get bonus tokens!
            </p>
          </div>
        )}

        {/* Already Registered */}
        {status === 'already_registered' && (
          <div className="rounded-md bg-blue-500/20 p-3 text-sm text-blue-300">
            You are already registered for this campaign!
          </div>
        )}

        {/* ShadowWire Address Input */}
        {status !== 'already_registered' && (
          <div className="space-y-2">
            <Label htmlFor="shadowwire-address" className="text-white">ShadowWire Address</Label>
            <div className="flex space-x-2">
              <Input
                id="shadowwire-address"
                placeholder="Enter your ShadowWire address"
                value={shadowWireAddress}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShadowWireAddress(e.target.value)}
                disabled={status === 'loading' || status === 'success' || !isCampaignOpen}
                className="flex-1 bg-slate-800/50 border-slate-700"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useWalletAddress}
                disabled={status === 'loading' || status === 'success' || !isCampaignOpen}
              >
                Use Wallet
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              This is where you will receive airdrop tokens privately.
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-md bg-red-500/20 p-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Success Message */}
        {status === 'success' && (
          <div className="space-y-2">
            <div className="rounded-md bg-green-500/20 p-3 text-sm text-green-300">
              <p>Successfully registered for the airdrop! You will receive {userAmount.toFixed(2)} tokens at your ShadowWire address.</p>
              {txSignature && (
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-green-400 hover:text-green-300 underline"
                >
                  View transaction on Solana Explorer →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Register Button */}
        {status !== 'already_registered' && (
          <Button
            onClick={handleRegister}
            className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
            disabled={
              status === 'loading' ||
              status === 'success' ||
              status === 'checking' ||
              !isCampaignOpen
            }
          >
            {status === 'checking'
              ? 'Checking...'
              : status === 'loading'
                ? 'Registering...'
                : status === 'success'
                  ? 'Registered!'
                  : `Register for ${userAmount.toFixed(2)} tokens`}
          </Button>
        )}

        {/* Info Box */}
        <div className="rounded-md border border-slate-700 p-3 text-xs text-slate-400">
          <p className="font-medium mb-1 text-slate-300">How Tiered Airdrops Work:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Anyone can register and get the <span className="text-white">base amount</span></li>
            <li>Complete a Vouch proof to get <span className="text-cyan-400">dev bonus</span> or <span className="text-purple-400">whale bonus</span></li>
            <li>Project sends tokens via ShadowWire (amounts hidden!)</li>
            <li>Claim your tokens privately to any wallet</li>
          </ol>
          <p className="mt-2 text-green-400 font-medium">
            No one can see who received how much!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}
