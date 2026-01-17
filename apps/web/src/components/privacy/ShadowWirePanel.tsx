'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  getShadowBalance,
  privateTransfer,
  privateTransferWithClientProof,
  depositToShadow,
  withdrawFromShadow,
  isShadowWireAvailable,
  initializeShadowWire,
  SUPPORTED_TOKENS,
  type SupportedToken,
} from '@/lib/shadowwire';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TransferType = 'internal' | 'external';
type OperationStatus = 'idle' | 'loading' | 'success' | 'error';

interface ShadowWirePanelProps {
  className?: string;
}

export function ShadowWirePanel({ className }: ShadowWirePanelProps) {
  const wallet = useWallet();

  // SDK state
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Balance state
  const [balance, setBalance] = useState<number>(0);
  const [poolAddress, setPoolAddress] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<SupportedToken>('SOL');

  // Transfer state
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferType, setTransferType] = useState<TransferType>('internal');
  const [useClientProofs, setUseClientProofs] = useState(true);

  // Operation state
  const [status, setStatus] = useState<OperationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastTxSignature, setLastTxSignature] = useState<string>('');

  // Check availability on mount
  useEffect(() => {
    const checkAndInit = async () => {
      const available = await isShadowWireAvailable();
      setIsAvailable(available);

      if (available) {
        try {
          await initializeShadowWire();
          setIsInitialized(true);
        } catch (err) {
          setInitError(err instanceof Error ? err.message : 'Failed to initialize WASM');
        }
      }
    };
    checkAndInit();
  }, []);

  // Fetch balance when wallet or token changes
  const fetchBalance = useCallback(async () => {
    if (!wallet.publicKey || !isInitialized) return;

    try {
      const result = await getShadowBalance(wallet.publicKey.toBase58(), selectedToken);
      setBalance(result.available);
      setPoolAddress(result.poolAddress);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  }, [wallet.publicKey, selectedToken, isInitialized]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Handle deposit
  const handleDeposit = async () => {
    if (!wallet.publicKey) return;

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setStatus('error');
      setStatusMessage('Please enter a valid amount');
      return;
    }

    setStatus('loading');
    setStatusMessage('Processing deposit...');

    try {
      const txSig = await depositToShadow(wallet, amount, selectedToken);
      setLastTxSignature(txSig);
      setStatus('success');
      setStatusMessage('Deposit successful!');
      fetchBalance();
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Deposit failed');
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!wallet.publicKey) return;

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setStatus('error');
      setStatusMessage('Please enter a valid amount');
      return;
    }

    setStatus('loading');
    setStatusMessage('Processing withdrawal...');

    try {
      const txSig = await withdrawFromShadow(wallet, amount, selectedToken);
      setLastTxSignature(txSig);
      setStatus('success');
      setStatusMessage('Withdrawal successful!');
      fetchBalance();
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Withdrawal failed');
    }
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!wallet.publicKey || !wallet.signMessage) return;

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setStatus('error');
      setStatusMessage('Please enter a valid amount');
      return;
    }

    if (!recipientAddress) {
      setStatus('error');
      setStatusMessage('Please enter a recipient address');
      return;
    }

    setStatus('loading');
    setStatusMessage(useClientProofs ? 'Generating proof and transferring...' : 'Processing transfer...');

    try {
      const txSig = useClientProofs
        ? await privateTransferWithClientProof(wallet, recipientAddress, amount, selectedToken, transferType)
        : await privateTransfer(wallet, recipientAddress, amount, selectedToken, transferType);

      setLastTxSignature(txSig);
      setStatus('success');
      setStatusMessage('Transfer successful!');
      fetchBalance();
    } catch (err) {
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Transfer failed');
    }
  };

  if (isAvailable === null) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="ml-2">Checking ShadowWire availability...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAvailable) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>ShadowWire</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            ShadowWire SDK is not available. Please ensure it is properly installed.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (initError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>ShadowWire</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{initError}</p>
        </CardContent>
      </Card>
    );
  }

  if (!wallet.publicKey) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>ShadowWire</CardTitle>
          <CardDescription>Private transfers with Bulletproofs</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please connect your wallet to use ShadowWire.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>ShadowWire</CardTitle>
        <CardDescription>Private transfers using Bulletproofs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className="rounded-md bg-muted p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Private Balance</p>
              <p className="text-2xl font-bold">{balance.toFixed(4)} {selectedToken}</p>
            </div>
            <Select
              value={selectedToken}
              onValueChange={(value: string) => setSelectedToken(value as SupportedToken)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TOKENS.map((token) => (
                  <SelectItem key={token} value={token}>
                    {token}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {poolAddress && (
            <p className="mt-2 text-xs text-muted-foreground break-all">
              Pool: {poolAddress.slice(0, 16)}...
            </p>
          )}
        </div>

        {/* Tabs for different operations */}
        <Tabs defaultValue="transfer" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>

          <TabsContent value="transfer" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input
                id="recipient"
                placeholder="Enter recipient wallet address"
                value={recipientAddress}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-amount">Amount</Label>
              <Input
                id="transfer-amount"
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTransferAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Transfer Type</Label>
              <Select
                value={transferType}
                onValueChange={(value: string) => setTransferType(value as TransferType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (Full Privacy)</SelectItem>
                  <SelectItem value="external">External (Sender Hidden)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {transferType === 'internal'
                  ? 'Both parties must be ShadowWire users. Amount is hidden.'
                  : 'Works with any wallet. Amount is visible, sender is hidden.'}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="client-proofs"
                checked={useClientProofs}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseClientProofs(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="client-proofs" className="text-sm">
                Generate proofs locally (maximum privacy)
              </Label>
            </div>

            <Button onClick={handleTransfer} className="w-full" disabled={status === 'loading'}>
              {status === 'loading' ? 'Processing...' : 'Send Privately'}
            </Button>
          </TabsContent>

          <TabsContent value="deposit" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Amount to Deposit</Label>
              <Input
                id="deposit-amount"
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTransferAmount(e.target.value)}
              />
            </div>
            <Button onClick={handleDeposit} className="w-full" disabled={status === 'loading'}>
              {status === 'loading' ? 'Processing...' : `Deposit ${selectedToken}`}
            </Button>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">Amount to Withdraw</Label>
              <Input
                id="withdraw-amount"
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTransferAmount(e.target.value)}
              />
            </div>
            <Button onClick={handleWithdraw} className="w-full" disabled={status === 'loading'}>
              {status === 'loading' ? 'Processing...' : `Withdraw ${selectedToken}`}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Status Message */}
        {status !== 'idle' && statusMessage && (
          <div
            className={`rounded-md p-3 text-sm ${
              status === 'success'
                ? 'bg-green-50 text-green-800'
                : status === 'error'
                ? 'bg-red-50 text-red-800'
                : 'bg-blue-50 text-blue-800'
            }`}
          >
            {statusMessage}
            {lastTxSignature && status === 'success' && (
              <p className="mt-1 text-xs break-all">TX: {lastTxSignature}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
