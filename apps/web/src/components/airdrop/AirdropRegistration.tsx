'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import { useSolanaConnection } from '@/components/providers';
import { Transaction, PublicKey } from '@solana/web3.js';
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
  proofType?: 'developer' | 'whale';
  onRegistered?: (shadowWireAddress: string) => void;
  className?: string;
}

type RegistrationStatus = 'idle' | 'checking' | 'loading' | 'success' | 'error' | 'already_registered';
type RegistrationType = 'open' | 'verified';

export function AirdropRegistration({
  campaign,
  nullifier,
  proofType,
  onRegistered,
  className,
}: AirdropRegistrationProps) {
  const wallet = useUnifiedWallet();
  const connection = useSolanaConnection();

  const [shadowWireAddress, setShadowWireAddress] = useState('');
  const [status, setStatus] = useState<RegistrationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registrationType, setRegistrationType] = useState<RegistrationType>(nullifier ? 'verified' : 'open');

  // Calculate amounts for display
  const baseAmount = campaign.baseAmount / 1e9;
  const devTotal = (campaign.baseAmount + campaign.devBonus) / 1e9;
  const whaleTotal = (campaign.baseAmount + campaign.whaleBonus) / 1e9;
  const userAmount = nullifier && proofType
    ? calculateAirdropAmount(campaign, proofType) / 1e9
    : baseAmount;

  // Check if already registered (both open and verified)
  useEffect(() => {
    const checkRegistration = async () => {
      if (!wallet.publicKey) return;

      setStatus('checking');
      try {
        const campaignIdBytes = hexToBytes(campaign.campaignId);

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

      let instruction;

      // Choose registration type based on whether user has verified credential
      if (registrationType === 'verified' && nullifier) {
        const nullifierBytes = hexToBytes(nullifier);
        instruction = buildRegisterForAirdropInstruction(
          wallet.publicKey,
          campaignIdBytes,
          nullifierBytes,
          shadowWireAddress
        );
      } else {
        // Open registration - anyone can register
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

      setStatus('success');
      onRegistered?.(shadowWireAddress);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed');
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

        {/* Your Amount */}
        <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-green-400">Your Reward:</span>
            <span className="text-xl font-bold text-green-300">{userAmount.toFixed(2)} tokens</span>
          </div>
          <p className="text-xs text-green-500 mt-1">
            {nullifier && proofType
              ? `Base + ${proofType === 'developer' ? 'Dev' : 'Whale'} bonus`
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

        {/* Registration Type Toggle */}
        {nullifier && status !== 'already_registered' && (
          <div className="rounded-md bg-slate-800/50 p-3">
            <p className="text-sm font-medium text-white mb-2">Registration Type</p>
            <div className="flex gap-2">
              <button
                onClick={() => setRegistrationType('verified')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  registrationType === 'verified'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Verified ({proofType || 'dev'})
                <span className="block text-xs opacity-70">Get full bonus</span>
              </button>
              <button
                onClick={() => setRegistrationType('open')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  registrationType === 'open'
                    ? 'bg-slate-600/50 text-white border border-slate-500/50'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Open
                <span className="block text-xs opacity-70">Base only</span>
              </button>
            </div>
          </div>
        )}

        {/* Credential Status */}
        {!nullifier && (
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
          <div className="rounded-md bg-green-500/20 p-3 text-sm text-green-300">
            Successfully registered for the airdrop! You will receive {userAmount.toFixed(2)} tokens at your ShadowWire address.
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
