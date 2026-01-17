'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
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

interface AirdropRegistrationProps {
  nullifier?: string; // From Vouch proof
  onRegistered?: (shadowWireAddress: string) => void;
  className?: string;
}

type RegistrationStatus = 'idle' | 'loading' | 'success' | 'error';

export function AirdropRegistration({
  nullifier,
  onRegistered,
  className,
}: AirdropRegistrationProps) {
  const wallet = useWallet();

  const [shadowWireAddress, setShadowWireAddress] = useState('');
  const [status, setStatus] = useState<RegistrationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use wallet address as ShadowWire address by default
  const useWalletAddress = useCallback(() => {
    if (wallet.publicKey) {
      setShadowWireAddress(wallet.publicKey.toBase58());
    }
  }, [wallet.publicKey]);

  const handleRegister = async () => {
    if (!nullifier) {
      setStatus('error');
      setErrorMessage('No Vouch credential found. Please complete the proof flow first.');
      return;
    }

    if (!shadowWireAddress) {
      setStatus('error');
      setErrorMessage('Please enter your ShadowWire address');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      // TODO: Call the on-chain airdrop registry contract
      // For now, we'll simulate the registration
      console.log('Registering for airdrop:', {
        nullifier,
        shadowWireAddress,
      });

      // Simulated delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

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

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Airdrop Registration</CardTitle>
        <CardDescription>
          Register your ShadowWire address to receive private airdrops.
          Your identity remains hidden while receiving tokens!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credential Status */}
        <div className="rounded-md bg-muted p-3">
          <p className="text-sm font-medium">Vouch Credential</p>
          {nullifier ? (
            <p className="text-sm text-green-600">
              Verified (nullifier: {nullifier.slice(0, 16)}...)
            </p>
          ) : (
            <p className="text-sm text-yellow-600">
              No credential found. Complete a proof first to register.
            </p>
          )}
        </div>

        {/* ShadowWire Address Input */}
        <div className="space-y-2">
          <Label htmlFor="shadowwire-address">ShadowWire Address</Label>
          <div className="flex space-x-2">
            <Input
              id="shadowwire-address"
              placeholder="Enter your ShadowWire address"
              value={shadowWireAddress}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShadowWireAddress(e.target.value)}
              disabled={status === 'loading' || status === 'success'}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={useWalletAddress}
              disabled={status === 'loading' || status === 'success'}
            >
              Use Wallet
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This is where you will receive airdrop tokens privately.
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        {/* Success Message */}
        {status === 'success' && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
            Successfully registered for airdrops! You will receive tokens at your ShadowWire address.
          </div>
        )}

        {/* Register Button */}
        <Button
          onClick={handleRegister}
          className="w-full"
          disabled={!nullifier || status === 'loading' || status === 'success'}
        >
          {status === 'loading' ? 'Registering...' : status === 'success' ? 'Registered!' : 'Register for Airdrop'}
        </Button>

        {/* Info Box */}
        <div className="rounded-md border p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">How it works:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Complete a Vouch proof to verify your credential</li>
            <li>Register your ShadowWire address (above)</li>
            <li>Projects will send airdrops to verified addresses</li>
            <li>Claim your tokens privately via ShadowWire</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
