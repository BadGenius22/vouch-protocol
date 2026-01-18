'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUnifiedWallet } from '@jup-ag/wallet-adapter';
import {
  getShadowBalance,
  claimAirdropToWallet,
  isShadowWireAvailable,
  initializeShadowWire,
  type SupportedToken,
} from '@/lib/shadowwire';
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

interface AirdropClaimProps {
  token?: SupportedToken;
  className?: string;
}

type ClaimStatus = 'idle' | 'loading' | 'success' | 'error' | 'no-balance';

export function AirdropClaim({ token = 'SOL', className }: AirdropClaimProps) {
  const wallet = useUnifiedWallet();

  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [showBalance, setShowBalance] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [status, setStatus] = useState<ClaimStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [txSignature, setTxSignature] = useState('');

  // Check SDK availability
  useEffect(() => {
    const init = async () => {
      const available = await isShadowWireAvailable();
      setIsAvailable(available);
      if (available) {
        await initializeShadowWire();
      }
    };
    init();
  }, []);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    if (!wallet.publicKey || !isAvailable) return;

    const result = await getShadowBalance(wallet.publicKey.toBase58(), token);
    setBalance(result.available);

    if (result.available <= 0) {
      setStatus('no-balance');
    }
  }, [wallet.publicKey, token, isAvailable]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Reveal balance
  const handleRevealBalance = () => {
    setShowBalance(true);
  };

  // Use wallet address as destination
  const useWalletAddress = () => {
    if (wallet.publicKey) {
      setDestinationAddress(wallet.publicKey.toBase58());
    }
  };

  // Claim airdrop
  const handleClaim = async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      setStatus('error');
      setStatusMessage('Wallet not connected');
      return;
    }

    if (!destinationAddress) {
      setStatus('error');
      setStatusMessage('Please enter a destination address');
      return;
    }

    setStatus('loading');
    setStatusMessage('Claiming tokens...');

    try {
      const result = await claimAirdropToWallet(wallet, destinationAddress, token);

      if (result.txSignature) {
        setTxSignature(result.txSignature);
        setStatus('success');
        setStatusMessage(`Successfully claimed ${result.balance.toFixed(4)} ${token}!`);
        fetchBalance(); // Refresh balance
      } else {
        setStatus('no-balance');
        setStatusMessage('No tokens to claim');
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Claim failed');
    }
  };

  if (!wallet.publicKey) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Claim Airdrop</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please connect your wallet to claim airdrops.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isAvailable === false) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Claim Airdrop</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            ShadowWire SDK is not available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Claim Airdrop</CardTitle>
        <CardDescription>
          Claim your private airdrop tokens via ShadowWire
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Private Balance Display */}
        <div className="rounded-md bg-muted p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Private Balance ({token})</p>
              {showBalance ? (
                <p className="text-2xl font-bold">{balance.toFixed(4)} {token}</p>
              ) : (
                <button
                  onClick={handleRevealBalance}
                  className="text-2xl font-bold text-primary hover:underline"
                >
                  Click to reveal
                </button>
              )}
            </div>
          </div>
        </div>

        {/* No Balance Message */}
        {status === 'no-balance' && (
          <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
            No tokens available to claim. Make sure you have registered for airdrops
            and that distributions have been made.
          </div>
        )}

        {/* Destination Address */}
        <div className="space-y-2">
          <Label htmlFor="destination">Withdraw to Address</Label>
          <div className="flex space-x-2">
            <Input
              id="destination"
              placeholder="Enter destination wallet address"
              value={destinationAddress}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestinationAddress(e.target.value)}
              disabled={status === 'loading'}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={useWalletAddress}
              disabled={status === 'loading'}
            >
              Use Wallet
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tokens will be sent to this address. Can be any Solana wallet.
          </p>
        </div>

        {/* Status Messages */}
        {status === 'loading' && (
          <div className="flex items-center space-x-2 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span>{statusMessage}</span>
          </div>
        )}

        {status === 'success' && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
            <p>{statusMessage}</p>
            {txSignature && (
              <p className="mt-1 text-xs break-all">TX: {txSignature}</p>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {statusMessage}
          </div>
        )}

        {/* Claim Button */}
        <Button
          onClick={handleClaim}
          className="w-full"
          disabled={status === 'loading' || balance <= 0}
        >
          {status === 'loading' ? 'Claiming...' : 'Claim All Privately'}
        </Button>

        {/* Privacy Notice */}
        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Privacy Notice:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your airdrop amount is hidden from everyone else</li>
            <li>You can withdraw to any wallet address</li>
            <li>The withdrawal transaction hides the sender (you)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
