'use client';

import { useState, useEffect } from 'react';
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
import { CheckCircle2, AlertCircle, Loader2, Wallet, ArrowRight, ExternalLink } from 'lucide-react';
import {
  isOpenRegisteredForCampaign,
  isRegisteredForCampaign,
} from '@/lib/airdrop-registry';

interface AirdropClaimProps {
  className?: string;
}

// Campaign info from devnet - tiered rewards
const CAMPAIGN_INFO = {
  campaignId: 'db4811899b3214b0e3191ca1500c2e8be0c487cfa477eab1b5020c655cebeb6b',
  tokenSymbol: 'VOUCH',
  tokenMint: 'GRL7X2VtBZnKUmrag6zXjFUno8q8HCMssTA3W8oiP8mx',
  // Rewards in lamports (9 decimals)
  baseAmount: 100_000_000_000, // 100 VOUCH
  devBonus: 50_000_000_000,    // +50 VOUCH
  whaleBonus: 150_000_000_000, // +150 VOUCH
};

type RegistrationType = 'whale' | 'developer' | 'open' | null;
type ClaimStatus = 'idle' | 'claiming' | 'success' | 'error';

// Helper to convert hex to bytes
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Calculate reward based on registration type
function getRewardAmount(type: RegistrationType): number {
  const base = CAMPAIGN_INFO.baseAmount / 1e9;
  if (type === 'whale') return base + CAMPAIGN_INFO.whaleBonus / 1e9;
  if (type === 'developer') return base + CAMPAIGN_INFO.devBonus / 1e9;
  return base; // open registration
}

export function AirdropClaim({ className }: AirdropClaimProps) {
  const wallet = useUnifiedWallet();
  const connection = useSolanaConnection();

  const [isChecking, setIsChecking] = useState(true);
  const [userRegistered, setUserRegistered] = useState(false);
  const [registrationType, setRegistrationType] = useState<RegistrationType>(null);
  const [campaignExists, setCampaignExists] = useState(true);
  const [checkCount, setCheckCount] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<{
    devVerified: boolean;
    whaleVerified: boolean;
  }>({ devVerified: false, whaleVerified: false });

  // Claim state
  const [destinationWallet, setDestinationWallet] = useState('');
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('idle');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTxSignature, setClaimTxSignature] = useState<string | null>(null);

  // ShadowWire balance state
  const [shadowBalance, setShadowBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [depositStatus, setDepositStatus] = useState<'idle' | 'depositing' | 'success' | 'error'>('idle');
  const [depositTxSignature, setDepositTxSignature] = useState<string | null>(null);

  // Check on-chain verification status (whale/dev proofs)
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

        // Compute nullifiers for both proof types
        const devNullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'developer');
        const whaleNullifier = computeNullifierForWallet(wallet.publicKey.toBase58(), 'whale');

        // Check both verifications in parallel
        const [devUsed, whaleUsed] = await Promise.all([
          isNullifierUsed(connection, devNullifier),
          isNullifierUsed(connection, whaleNullifier),
        ]);

        console.log('[AirdropClaim] On-chain verification: dev=', devUsed, 'whale=', whaleUsed);
        setVerificationStatus({ devVerified: devUsed, whaleVerified: whaleUsed });
      } catch (err) {
        console.error('[AirdropClaim] Error checking verification status:', err);
        setVerificationStatus({ devVerified: false, whaleVerified: false });
      }
    }

    checkVerificationStatus();
  }, [wallet.publicKey, connection]);

  // Check registration status on-chain
  useEffect(() => {
    async function checkRegistration() {
      if (!wallet.publicKey) {
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      try {
        const campaignIdBytes = hexToBytes(CAMPAIGN_INFO.campaignId);
        console.log('[AirdropClaim] Checking registration for wallet:', wallet.publicKey.toBase58());

        // First verify the campaign exists on-chain
        const { getCampaignPDA, getOpenRegistrationPDA } = await import('@/lib/airdrop-registry');
        const [campaignPDA] = getCampaignPDA(campaignIdBytes);
        const campaignAccount = await connection.getAccountInfo(campaignPDA);

        if (!campaignAccount) {
          console.log('[AirdropClaim] Campaign does not exist on-chain');
          setCampaignExists(false);
          setIsChecking(false);
          return;
        }
        setCampaignExists(true);
        console.log('[AirdropClaim] Campaign exists at PDA:', campaignPDA.toBase58());

        // Check open registration first
        const [openRegPDA] = getOpenRegistrationPDA(campaignPDA, wallet.publicKey);
        console.log('[AirdropClaim] Checking open registration PDA:', openRegPDA.toBase58());

        const isOpenRegistered = await isOpenRegisteredForCampaign(
          connection,
          campaignIdBytes,
          wallet.publicKey
        );
        console.log('[AirdropClaim] Open registration result:', isOpenRegistered);

        if (isOpenRegistered) {
          setUserRegistered(true);
          // Determine registration type from on-chain verification status (not localStorage)
          // whale > dev > open (best available)
          if (verificationStatus.whaleVerified) {
            setRegistrationType('whale');
          } else if (verificationStatus.devVerified) {
            setRegistrationType('developer');
          } else {
            setRegistrationType('open');
          }
          setIsChecking(false);
          return;
        }

        // Check verified registration using stored nullifier
        const storedNullifier = typeof window !== 'undefined'
          ? localStorage.getItem('vouch_nullifier')
          : null;

        if (storedNullifier) {
          const nullifierBytes = hexToBytes(storedNullifier);
          const isVerifiedRegistered = await isRegisteredForCampaign(
            connection,
            campaignIdBytes,
            nullifierBytes
          );
          console.log('[AirdropClaim] Verified registration result:', isVerifiedRegistered);

          if (isVerifiedRegistered) {
            setUserRegistered(true);
            // Use on-chain verification status
            if (verificationStatus.whaleVerified) {
              setRegistrationType('whale');
            } else if (verificationStatus.devVerified) {
              setRegistrationType('developer');
            } else {
              setRegistrationType('developer'); // Fallback for verified registration
            }
          }
        }
      } catch (err) {
        console.error('[AirdropClaim] Error checking registration:', err);
      }
      setIsChecking(false);
    }

    checkRegistration();
  }, [wallet.publicKey, connection, checkCount, verificationStatus]);

  const handleRefresh = () => setCheckCount(c => c + 1);

  const useCurrentWallet = () => {
    if (wallet.publicKey) {
      setDestinationWallet(wallet.publicKey.toBase58());
    }
  };

  // Check ShadowWire balance
  const checkShadowBalance = async () => {
    if (!wallet.publicKey) return;

    setIsLoadingBalance(true);
    try {
      const { getShadowBalance } = await import('@/lib/shadowwire');
      const balance = await getShadowBalance(wallet.publicKey.toBase58(), 'SOL');
      setShadowBalance(balance.available);
      console.log('[AirdropClaim] ShadowWire balance:', balance.available);
    } catch (err) {
      console.error('[AirdropClaim] Error checking balance:', err);
      setShadowBalance(0);
    }
    setIsLoadingBalance(false);
  };

  // Check balance when registered
  useEffect(() => {
    if (userRegistered && wallet.publicKey) {
      checkShadowBalance();
    }
  }, [userRegistered, wallet.publicKey]);

  // Demo deposit - user deposits SOL to their ShadowWire address
  const handleDemoDeposit = async () => {
    if (!wallet.publicKey) return;

    setDepositStatus('depositing');
    setClaimError(null);

    try {
      const { depositToShadow } = await import('@/lib/shadowwire');

      // Deposit 0.01 SOL for demo
      const demoAmount = 0.01;
      const txSignature = await depositToShadow(wallet, demoAmount, 'SOL', { timeoutMs: 60000 });

      if (txSignature) {
        setDepositTxSignature(txSignature);
        setDepositStatus('success');
        // Refresh balance after deposit
        setTimeout(checkShadowBalance, 2000);
      }
    } catch (err) {
      console.error('[AirdropClaim] Deposit error:', err);
      setDepositStatus('error');
      setClaimError(err instanceof Error ? err.message : 'Failed to deposit');
    }
  };

  // Withdraw from ShadowWire to destination wallet
  const handleClaim = async () => {
    if (!destinationWallet) {
      setClaimError('Please enter a destination wallet address');
      return;
    }

    // Validate address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(destinationWallet)) {
      setClaimError('Invalid Solana wallet address');
      return;
    }

    if (shadowBalance <= 0) {
      setClaimError('No ShadowWire balance to withdraw. Use "Demo Deposit" first to add funds.');
      return;
    }

    setClaimStatus('claiming');
    setClaimError(null);

    try {
      const { privateTransfer } = await import('@/lib/shadowwire');

      // Transfer from ShadowWire to destination wallet
      const transferAmount = shadowBalance * 0.95; // Leave some for fees
      const txSignature = await privateTransfer(
        wallet,
        destinationWallet,
        transferAmount,
        'SOL',
        'external', // external transfer to any wallet
        { timeoutMs: 60000 }
      );

      if (txSignature) {
        setClaimTxSignature(txSignature);
        setClaimStatus('success');
        setShadowBalance(0);
      }
    } catch (err) {
      console.error('[AirdropClaim] Claim error:', err);
      setClaimStatus('error');
      setClaimError(err instanceof Error ? err.message : 'Failed to withdraw');
    }
  };

  const rewardAmount = getRewardAmount(registrationType);

  if (!wallet.publicKey) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Claim Airdrop</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please connect your wallet to check your airdrop status.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Claim VOUCH Tokens
          <span className="text-xs font-normal px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
            DEVNET
          </span>
        </CardTitle>
        <CardDescription>
          Claim your airdrop tokens privately via ShadowWire
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Check */}
        {isChecking ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span className="text-slate-300">Checking registration status...</span>
          </div>
        ) : !campaignExists ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-amber-300 font-medium">Campaign Not Found</p>
              <p className="text-xs text-amber-400/70 mt-1">
                The campaign may not be deployed on devnet yet.
              </p>
            </div>
          </div>
        ) : !userRegistered ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <AlertCircle className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-slate-300 font-medium">Not Registered</p>
                <p className="text-xs text-slate-500 mt-1">
                  You need to register for this airdrop campaign first.
                </p>
              </div>
            </div>
            <Button
              onClick={() => window.location.href = '/airdrop'}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-500"
            >
              Go to Registration
            </Button>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="w-full"
            >
              Refresh Status
            </Button>
          </div>
        ) : (
          <>
            {/* Registered - Show Claim UI */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <div className="flex-1">
                <p className="text-green-300 font-medium">Registered for Airdrop</p>
                <p className="text-xs text-green-400/70 mt-1">
                  {registrationType === 'whale' && '🐋 Whale Verified - Maximum Reward!'}
                  {registrationType === 'developer' && '👨‍💻 Developer Verified - Bonus Reward!'}
                  {registrationType === 'open' && 'Open Registration - Base Reward'}
                </p>
              </div>
            </div>

            {/* Reward Amount Display */}
            <div className={`rounded-lg p-4 border ${
              registrationType === 'whale'
                ? 'bg-purple-500/10 border-purple-500/30'
                : registrationType === 'developer'
                  ? 'bg-cyan-500/10 border-cyan-500/30'
                  : 'bg-slate-800/50 border-slate-700'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Your Reward:</span>
                <span className={`text-2xl font-bold ${
                  registrationType === 'whale'
                    ? 'text-purple-300'
                    : registrationType === 'developer'
                      ? 'text-cyan-300'
                      : 'text-white'
                }`}>
                  {rewardAmount} {CAMPAIGN_INFO.tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 text-xs">
                <span className="text-slate-500">Token Mint:</span>
                <a
                  href={`https://explorer.solana.com/address/${CAMPAIGN_INFO.tokenMint}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  {CAMPAIGN_INFO.tokenMint.slice(0, 8)}...
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* ShadowWire Balance - Demo Flow */}
            <div className="rounded-lg p-4 border border-amber-500/30 bg-amber-500/5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-amber-300">ShadowWire Balance</span>
                <div className="flex items-center gap-2">
                  {isLoadingBalance ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <span className="text-lg font-bold text-white">{shadowBalance.toFixed(4)} SOL</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={checkShadowBalance}
                    disabled={isLoadingBalance}
                    className="h-6 w-6 p-0"
                  >
                    <Loader2 className={`w-3 h-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {shadowBalance <= 0 && depositStatus !== 'success' && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400/70">
                    Demo: In production, the campaign creator would deposit tokens here.
                    For testing, deposit some SOL to see real on-chain transactions.
                  </p>
                  <Button
                    onClick={handleDemoDeposit}
                    disabled={depositStatus === 'depositing'}
                    variant="outline"
                    className="w-full border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
                  >
                    {depositStatus === 'depositing' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Depositing 0.01 SOL...
                      </>
                    ) : (
                      'Demo Deposit (0.01 SOL)'
                    )}
                  </Button>
                </div>
              )}

              {depositStatus === 'success' && depositTxSignature && (
                <div className="rounded-md bg-green-500/10 p-2 text-xs">
                  <p className="text-green-300">Deposit successful!</p>
                  <a
                    href={`https://explorer.solana.com/tx/${depositTxSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300 flex items-center gap-1 mt-1"
                  >
                    View deposit tx <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Claim Form */}
            {claimStatus !== 'success' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="destination" className="text-white">
                    Destination Wallet
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="destination"
                      placeholder="Enter Solana wallet address"
                      value={destinationWallet}
                      onChange={(e) => setDestinationWallet(e.target.value)}
                      disabled={claimStatus === 'claiming'}
                      className="flex-1 bg-slate-800/50 border-slate-700"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={useCurrentWallet}
                      disabled={claimStatus === 'claiming'}
                    >
                      <Wallet className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Tokens will be privately transferred to this address via ShadowWire.
                  </p>
                </div>

                {claimError && (
                  <div className="rounded-md bg-red-500/20 p-3 text-sm text-red-300">
                    {claimError}
                  </div>
                )}

                <Button
                  onClick={handleClaim}
                  disabled={claimStatus === 'claiming' || !destinationWallet || shadowBalance <= 0}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50"
                >
                  {claimStatus === 'claiming' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Withdrawing via ShadowWire...
                    </>
                  ) : shadowBalance <= 0 ? (
                    'Deposit funds first to claim'
                  ) : (
                    <>
                      Withdraw {shadowBalance.toFixed(4)} SOL Privately
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Success State */}
            {claimStatus === 'success' && (
              <div className="space-y-3">
                <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4">
                  <div className="flex items-center gap-2 text-green-300 font-medium">
                    <CheckCircle2 className="w-5 h-5" />
                    Withdrawal Successful!
                  </div>
                  <p className="text-sm text-green-400/70 mt-2">
                    SOL has been privately transferred to {destinationWallet.slice(0, 8)}...
                  </p>
                  {claimTxSignature && (
                    <a
                      href={`https://explorer.solana.com/tx/${claimTxSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-green-400 hover:text-green-300"
                    >
                      View Transaction on Explorer
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Privacy Info */}
        <div className="rounded-md border border-slate-700 p-3 text-xs text-slate-400">
          <p className="font-medium mb-1 text-slate-300">How Private Claims Work:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your claim is processed via ShadowWire privacy layer</li>
            <li>No one can link your registration to the destination wallet</li>
            <li>Claim to any Solana wallet - use a fresh wallet for maximum privacy</li>
            <li>Transaction amounts are hidden from public view</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
