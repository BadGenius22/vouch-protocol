/**
 * ShadowWire SDK Integration
 * Enables private credential transfers using Bulletproofs (zero-knowledge range proofs)
 *
 * ShadowWire provides:
 * - Internal transfers: Full privacy (hides sender, recipient, and amount)
 * - External transfers: Partial privacy (hides sender only)
 *
 * Supported tokens: SOL, USDC, BONK, ORE, RADR, and 8 more
 *
 * @see https://github.com/Radrdotfun/ShadowWire
 */

import type { WalletContextState } from '@solana/wallet-adapter-react';

/**
 * ShadowWire SDK types (based on SDK documentation)
 */
interface ShadowWireClientOptions {
  debug?: boolean;
}

interface DepositOptions {
  wallet: WalletContextState;
  amount: number;
  token: string;
}

interface TransferOptions {
  sender: string;
  recipient: string;
  amount: number;
  token: string;
  type: 'internal' | 'external';
  wallet: {
    signMessage: NonNullable<WalletContextState['signMessage']>;
  };
}

interface WithdrawOptions {
  wallet: WalletContextState;
  amount: number;
  token: string;
}

interface ShadowWireSDK {
  new (options?: ShadowWireClientOptions): ShadowWireClientInstance;
}

interface ShadowWireClientInstance {
  deposit(options: DepositOptions): Promise<string>;
  transfer(options: TransferOptions): Promise<string>;
  withdraw(options: WithdrawOptions): Promise<string>;
  getBalance(walletAddress: string, token: string): Promise<number>;
}

type InitWASMFn = (wasmPath?: string) => Promise<void>;
type GenerateRangeProofFn = (amount: bigint, bits: number) => Promise<Uint8Array>;

// SDK client singleton
let shadowWire: ShadowWireClientInstance | null = null;
let wasmInitialized = false;

// Cached SDK functions
let initWASMFn: InitWASMFn | null = null;
let generateRangeProofFn: GenerateRangeProofFn | null = null;

/**
 * Supported tokens for ShadowWire transfers
 */
export const SUPPORTED_TOKENS = [
  'SOL',
  'USDC',
  'BONK',
  'ORE',
  'RADR',
  'JUP',
  'RAY',
  'PYTH',
  'WEN',
  'HONEY',
  'BSOL',
  'MSOL',
  'JITOSOL',
] as const;

export type SupportedToken = (typeof SUPPORTED_TOKENS)[number];

/**
 * Initialize ShadowWire SDK (lazy load)
 */
async function getShadowWireClient(): Promise<ShadowWireClientInstance> {
  if (shadowWire) return shadowWire;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk = await import('@radr/shadowwire' as any);
    const ShadowWireClient = (sdk.ShadowWireClient || sdk.default?.ShadowWireClient || sdk.default) as unknown as ShadowWireSDK;
    initWASMFn = (sdk.initWASM || sdk.default?.initWASM) as InitWASMFn;
    generateRangeProofFn = (sdk.generateRangeProof || sdk.default?.generateRangeProof) as GenerateRangeProofFn;

    if (!ShadowWireClient) {
      throw new Error('ShadowWireClient class not found in SDK');
    }

    shadowWire = new ShadowWireClient({
      debug: process.env.NODE_ENV === 'development',
    });

    return shadowWire;
  } catch (error) {
    console.error('[ShadowWire] SDK not available:', error);
    throw new Error(
      'ShadowWire SDK not installed. Run: pnpm add @radr/shadowwire'
    );
  }
}

/**
 * Initialize Bulletproofs WASM (required before transfers)
 * Call this early in your app initialization for better UX
 *
 * @param wasmPath - Optional custom path to WASM files
 */
export async function initializeShadowWire(wasmPath?: string): Promise<void> {
  if (wasmInitialized) return;

  console.log('[ShadowWire] Initializing WASM...');

  // Ensure SDK is loaded
  await getShadowWireClient();

  if (!initWASMFn) {
    throw new Error('ShadowWire SDK not properly initialized');
  }

  await initWASMFn(wasmPath);
  wasmInitialized = true;

  console.log('[ShadowWire] WASM initialized');
}

/**
 * Deposit funds to ShadowWire for private transfers
 *
 * @param wallet - Connected wallet adapter
 * @param amountSol - Amount to deposit
 * @param token - Token type (default: SOL)
 * @returns Transaction signature
 */
export async function depositToShadow(
  wallet: WalletContextState,
  amountSol: number,
  token: SupportedToken = 'SOL'
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  if (amountSol <= 0) {
    throw new Error('Amount must be positive');
  }

  await initializeShadowWire();
  const client = await getShadowWireClient();

  console.log(`[ShadowWire] Depositing ${amountSol} ${token}...`);

  const txSignature = await client.deposit({
    wallet,
    amount: amountSol,
    token,
  });

  console.log(`[ShadowWire] Deposit complete: ${txSignature}`);
  return txSignature;
}

/**
 * Transfer credential privately using Bulletproofs
 *
 * @param wallet - Connected wallet adapter
 * @param recipientWallet - Destination wallet address
 * @param amountSol - Amount to transfer (default: 0.01 SOL)
 * @param type - 'internal' (full privacy) or 'external' (hides sender)
 * @param token - Token type (default: SOL)
 * @returns Transaction signature
 */
export async function privateCredentialTransfer(
  wallet: WalletContextState,
  recipientWallet: string,
  amountSol: number = 0.01,
  type: 'internal' | 'external' = 'internal',
  token: SupportedToken = 'SOL'
): Promise<string> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error('Wallet not connected or signMessage not available');
  }

  if (!recipientWallet || recipientWallet.length < 32) {
    throw new Error('Invalid recipient address');
  }

  await initializeShadowWire();
  const client = await getShadowWireClient();

  console.log(
    `[ShadowWire] Private ${type} transfer of ${amountSol} ${token} to ${recipientWallet.slice(0, 8)}...`
  );

  const txSignature = await client.transfer({
    sender: wallet.publicKey.toBase58(),
    recipient: recipientWallet,
    amount: amountSol,
    token,
    type,
    wallet: {
      signMessage: wallet.signMessage,
    },
  });

  console.log(`[ShadowWire] Transfer complete: ${txSignature}`);
  return txSignature;
}

/**
 * Get ShadowWire balance for a token
 *
 * @param walletAddress - Wallet address to check
 * @param token - Token type (default: SOL)
 * @returns Balance in token units
 */
export async function getShadowBalance(
  walletAddress: string,
  token: SupportedToken = 'SOL'
): Promise<number> {
  if (!walletAddress) return 0;

  try {
    await initializeShadowWire();
    const client = await getShadowWireClient();
    return await client.getBalance(walletAddress, token);
  } catch {
    return 0;
  }
}

/**
 * Withdraw from ShadowWire back to regular wallet
 *
 * @param wallet - Connected wallet adapter
 * @param amountSol - Amount to withdraw
 * @param token - Token type (default: SOL)
 * @returns Transaction signature
 */
export async function withdrawFromShadow(
  wallet: WalletContextState,
  amountSol: number,
  token: SupportedToken = 'SOL'
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  if (amountSol <= 0) {
    throw new Error('Amount must be positive');
  }

  await initializeShadowWire();
  const client = await getShadowWireClient();

  console.log(`[ShadowWire] Withdrawing ${amountSol} ${token}...`);

  const txSignature = await client.withdraw({
    wallet,
    amount: amountSol,
    token,
  });

  console.log(`[ShadowWire] Withdrawal complete: ${txSignature}`);
  return txSignature;
}

/**
 * Generate a Bulletproof range proof (for custom use cases)
 * Proves that a value is within a range without revealing the value
 *
 * @param amountLamports - Amount in lamports (bigint)
 * @param bits - Number of bits for range (default: 64)
 * @returns Range proof bytes
 */
export async function generatePrivateRangeProof(
  amountLamports: bigint,
  bits: number = 64
): Promise<Uint8Array> {
  await initializeShadowWire();

  if (!generateRangeProofFn) {
    throw new Error('ShadowWire SDK not properly initialized');
  }

  return await generateRangeProofFn(amountLamports, bits);
}

/**
 * Check if ShadowWire SDK is available
 */
export async function isShadowWireAvailable(): Promise<boolean> {
  try {
    await getShadowWireClient();
    return true;
  } catch {
    return false;
  }
}

/**
 * ShadowWire credential transfer flow helper
 */
export interface ShadowWireFlowOptions {
  wallet: WalletContextState;
  recipientWallet: string;
  amount: number;
  token?: SupportedToken;
  transferType?: 'internal' | 'external';
  onDepositComplete?: (txSignature: string) => void;
  onTransferComplete?: (txSignature: string) => void;
}

export async function executeShadowWireFlow(
  options: ShadowWireFlowOptions
): Promise<{
  depositTx: string;
  transferTx: string;
}> {
  const {
    wallet,
    recipientWallet,
    amount,
    token = 'SOL',
    transferType = 'internal',
    onDepositComplete,
    onTransferComplete,
  } = options;

  // Step 1: Deposit to ShadowWire
  const depositTx = await depositToShadow(wallet, amount, token);
  onDepositComplete?.(depositTx);

  // Step 2: Private transfer
  const transferTx = await privateCredentialTransfer(
    wallet,
    recipientWallet,
    amount,
    transferType,
    token
  );
  onTransferComplete?.(transferTx);

  return { depositTx, transferTx };
}
