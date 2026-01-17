'use client';

import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Keypair } from '@solana/web3.js';
import {
  fundBurnerViaPrivacyCash,
  generateEphemeralKeypair,
  isPrivacyCashAvailable,
  type PrivacyFundingResult,
} from '@/lib/privacy-cash';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FundingStep = 'idle' | 'generating' | 'funding' | 'connecting' | 'depositing' | 'withdrawing' | 'complete' | 'error';

interface PrivacyFundingModalProps {
  onFundingComplete?: (result: PrivacyFundingResult) => void;
  triggerButton?: React.ReactNode;
  defaultAmount?: number;
}

const STEP_MESSAGES: Record<FundingStep, string> = {
  idle: 'Ready to fund burner wallet',
  generating: 'Generating ephemeral wallet...',
  funding: 'Funding ephemeral wallet...',
  connecting: 'Connecting to Privacy Cash...',
  depositing: 'Depositing to privacy pool...',
  withdrawing: 'Withdrawing to burner wallet...',
  complete: 'Burner wallet funded anonymously!',
  error: 'An error occurred',
};

export function PrivacyFundingModal({
  onFundingComplete,
  triggerButton,
  defaultAmount = 0.05,
}: PrivacyFundingModalProps) {
  const wallet = useWallet();
  const { connection } = useConnection();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaultAmount.toString());
  const [burnerAddress, setBurnerAddress] = useState('');
  const [step, setStep] = useState<FundingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrivacyFundingResult | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Check SDK availability on mount
  const checkAvailability = useCallback(async () => {
    const available = await isPrivacyCashAvailable();
    setIsAvailable(available);
  }, []);

  // Generate a new burner wallet
  const generateBurner = useCallback(() => {
    const keypair = Keypair.generate();
    setBurnerAddress(keypair.publicKey.toBase58());
  }, []);

  // Start funding flow
  const startFunding = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    if (!burnerAddress) {
      setError('Please enter or generate a burner wallet address');
      return;
    }

    const amountSol = parseFloat(amount);
    if (isNaN(amountSol) || amountSol <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setError(null);
    setStep('generating');

    try {
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

      const fundingResult = await fundBurnerViaPrivacyCash({
        connection,
        wallet,
        burnerPublicKey: new PublicKey(burnerAddress),
        amountSol,
        rpcUrl,
        onProgress: (progressStep) => {
          setStep(progressStep as FundingStep);
        },
      });

      if (fundingResult.success) {
        setResult(fundingResult);
        setStep('complete');
        onFundingComplete?.(fundingResult);
      } else {
        setError(fundingResult.error || 'Unknown error');
        setStep('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  };

  // Reset modal state
  const reset = () => {
    setStep('idle');
    setError(null);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(value: boolean) => {
      setOpen(value);
      if (value) {
        checkAvailability();
        reset();
      }
    }}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline">Fund Burner Wallet</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Privacy Cash Funding</DialogTitle>
          <DialogDescription>
            Fund your burner wallet anonymously through Privacy Cash.
            No on-chain link between your wallet and the burner!
          </DialogDescription>
        </DialogHeader>

        {isAvailable === false && (
          <div className="rounded-md bg-yellow-50 p-4 text-yellow-800">
            Privacy Cash SDK is not available. Please ensure it is properly installed.
          </div>
        )}

        {isAvailable !== false && (
          <div className="space-y-4">
            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (SOL)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                disabled={step !== 'idle'}
              />
            </div>

            {/* Burner Address Input */}
            <div className="space-y-2">
              <Label htmlFor="burner">Burner Wallet Address</Label>
              <div className="flex space-x-2">
                <Input
                  id="burner"
                  type="text"
                  placeholder="Enter or generate burner address"
                  value={burnerAddress}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBurnerAddress(e.target.value)}
                  disabled={step !== 'idle'}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateBurner}
                  disabled={step !== 'idle'}
                >
                  Generate
                </Button>
              </div>
            </div>

            {/* Progress Indicator */}
            {step !== 'idle' && step !== 'complete' && step !== 'error' && (
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span className="text-blue-800">{STEP_MESSAGES[step]}</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4 text-red-800">
                {error}
              </div>
            )}

            {/* Success Message */}
            {step === 'complete' && result && (
              <div className="space-y-2 rounded-md bg-green-50 p-4 text-green-800">
                <p className="font-medium">Funding complete!</p>
                {result.fundEphemeralTx && (
                  <p className="text-xs break-all">
                    Fund TX: {result.fundEphemeralTx.slice(0, 20)}...
                  </p>
                )}
                {result.depositTx && (
                  <p className="text-xs break-all">
                    Deposit TX: {result.depositTx.slice(0, 20)}...
                  </p>
                )}
                {result.withdrawTx && (
                  <p className="text-xs break-all">
                    Withdraw TX: {result.withdrawTx.slice(0, 20)}...
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              {step === 'idle' && (
                <Button
                  onClick={startFunding}
                  disabled={!wallet.publicKey || !burnerAddress}
                >
                  Start Anonymous Funding
                </Button>
              )}
              {(step === 'complete' || step === 'error') && (
                <Button onClick={reset} variant="outline">
                  Start Over
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
