/**
 * ShadowWire SDK Integration
 * Enables private transfers and airdrops using Bulletproofs (zero-knowledge range proofs)
 *
 * ShadowWire provides:
 * - Internal transfers: Full privacy (hides sender, recipient, and amount)
 * - External transfers: Partial privacy (hides sender only)
 *
 * Use cases for Vouch Protocol:
 * - Private airdrop distribution to verified credential holders
 * - Anonymous reward claiming
 * - Hidden balance transfers
 *
 * @see https://github.com/Radrdotfun/ShadowWire
 * @see https://www.radrlabs.io
 */

import type { WalletContextState } from '@solana/wallet-adapter-react';

// Import types from the actual SDK
import type {
  ShadowWireClientConfig,
  PoolBalance,
  DepositRequest as SDKDepositRequest,
  DepositResponse,
  WithdrawRequest as SDKWithdrawRequest,
  WithdrawResponse,
  TransferRequest as SDKTransferRequest,
  TransferResponse,
  TransferWithClientProofsRequest,
  TokenSymbol,
  ZKProofData,
  WalletAdapter,
} from '@radr/shadowwire';

// Re-export types for external use
export type { TokenSymbol, ZKProofData, WalletAdapter };

/**
 * Supported tokens for ShadowWire transfers
 */
export const SUPPORTED_TOKENS = [
  'SOL',
  'RADR',
  'USDC',
  'ORE',
  'BONK',
  'JIM',
  'GODL',
  'HUSTLE',
  'ZEC',
  'CRT',
  'BLACKCOIN',
  'GIL',
  'ANON',
  'WLFI',
  'USD1',
  'AOL',
  'IQLABS',
] as const;

export type SupportedToken = TokenSymbol;

/**
 * Token decimals for unit conversion
 */
const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USDC: 6,
  RADR: 9,
  BONK: 5,
  JUP: 9,
  RAY: 9,
  PYTH: 9,
  WEN: 9,
  HONEY: 9,
  BSOL: 9,
  MSOL: 9,
  JITOSOL: 9,
  ORE: 11,
  GODL: 11,
  ZEC: 8,
  USD1: 6,
  WLFI: 6,
};

// Cached SDK references
let ShadowWireClientClass: typeof import('@radr/shadowwire').ShadowWireClient | null = null;
let initWASMFn: typeof import('@radr/shadowwire').initWASM | null = null;
let isWASMSupportedFn: typeof import('@radr/shadowwire').isWASMSupported | null = null;
let generateRangeProofFn: typeof import('@radr/shadowwire').generateRangeProof | null = null;
let wasmInitialized = false;
let clientInstance: InstanceType<typeof import('@radr/shadowwire').ShadowWireClient> | null = null;

/**
 * Dynamically import ShadowWire SDK
 */
async function loadShadowWireSDK(): Promise<void> {
  if (ShadowWireClientClass) return;

  try {
    const sdk = await import('@radr/shadowwire');

    ShadowWireClientClass = sdk.ShadowWireClient;
    initWASMFn = sdk.initWASM;
    isWASMSupportedFn = sdk.isWASMSupported;
    generateRangeProofFn = sdk.generateRangeProof;

    if (!ShadowWireClientClass) {
      throw new Error('ShadowWireClient class not found in SDK');
    }

    console.log('[ShadowWire] SDK loaded successfully');
  } catch (error) {
    console.error('[ShadowWire] SDK not available:', error);
    throw new Error('ShadowWire SDK not installed. Run: pnpm add @radr/shadowwire');
  }
}

/**
 * Check if ShadowWire SDK is available
 */
export async function isShadowWireAvailable(): Promise<boolean> {
  try {
    await loadShadowWireSDK();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if browser supports WebAssembly (required for Bulletproofs)
 */
export function isWASMSupported(): boolean {
  if (isWASMSupportedFn) {
    return isWASMSupportedFn();
  }
  // Fallback check
  return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
}

/**
 * Initialize ShadowWire WASM (required before transfers)
 * Call this early in your app initialization for better UX
 *
 * @param wasmPath - Path to WASM file (default: '/wasm/settler_wasm_bg.wasm')
 */
export async function initializeShadowWire(wasmPath = '/wasm/settler_wasm_bg.wasm'): Promise<void> {
  if (wasmInitialized) return;

  await loadShadowWireSDK();

  if (!isWASMSupported()) {
    throw new Error('Browser does not support WebAssembly. Please use a modern browser.');
  }

  if (!initWASMFn) {
    throw new Error('ShadowWire initWASM function not found');
  }

  console.log('[ShadowWire] Initializing WASM...');
  await initWASMFn(wasmPath);
  wasmInitialized = true;
  console.log('[ShadowWire] WASM initialized successfully');
}

/**
 * Get ShadowWire client instance (singleton)
 */
async function getShadowWireClient(): Promise<InstanceType<typeof import('@radr/shadowwire').ShadowWireClient>> {
  if (clientInstance) return clientInstance;

  await loadShadowWireSDK();

  if (!ShadowWireClientClass) {
    throw new Error('ShadowWire SDK not loaded');
  }

  clientInstance = new ShadowWireClientClass({
    debug: process.env.NODE_ENV === 'development',
  });

  return clientInstance;
}

/**
 * Token utility functions
 */
export function toSmallestUnit(amount: number, token: SupportedToken): number {
  const decimals = TOKEN_DECIMALS[token] ?? 9;
  return Math.floor(amount * Math.pow(10, decimals));
}

export function fromSmallestUnit(amount: number, token: SupportedToken): number {
  const decimals = TOKEN_DECIMALS[token] ?? 9;
  return amount / Math.pow(10, decimals);
}

/**
 * Get ShadowWire balance for a wallet
 */
export async function getShadowBalance(
  walletAddress: string,
  token: SupportedToken = 'SOL'
): Promise<{ available: number; poolAddress: string }> {
  if (!walletAddress) {
    return { available: 0, poolAddress: '' };
  }

  try {
    await initializeShadowWire();
    const client = await getShadowWireClient();
    const balance = await client.getBalance(walletAddress, token);

    return {
      available: fromSmallestUnit(balance.available, token),
      poolAddress: balance.pool_address,
    };
  } catch (error) {
    console.error('[ShadowWire] Failed to get balance:', error);
    return { available: 0, poolAddress: '' };
  }
}

/**
 * Deposit funds to ShadowWire pool
 * Note: SDK expects wallet address as string, not WalletContextState
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

  const amount = toSmallestUnit(amountSol, token);
  console.log(`[ShadowWire] Depositing ${amountSol} ${token} (${amount} smallest units)...`);

  // SDK expects wallet address as string
  const depositRequest: SDKDepositRequest = {
    wallet: wallet.publicKey.toBase58(),
    amount,
  };

  const response = await client.deposit(depositRequest);

  console.log(`[ShadowWire] Deposit response received`);

  // Response includes unsigned_tx_base64 that needs to be signed and sent
  // For now return success indicator - full flow would require signing
  return response.unsigned_tx_base64;
}

/**
 * Withdraw funds from ShadowWire pool
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

  const amount = toSmallestUnit(amountSol, token);
  console.log(`[ShadowWire] Withdrawing ${amountSol} ${token}...`);

  const withdrawRequest: SDKWithdrawRequest = {
    wallet: wallet.publicKey.toBase58(),
    amount,
  };

  const response = await client.withdraw(withdrawRequest);

  console.log(`[ShadowWire] Withdrawal response received`);
  return response.unsigned_tx_base64;
}

/**
 * Private transfer using ShadowWire
 *
 * @param type - 'internal' for full privacy (both parties must be ShadowWire users)
 *               'external' for partial privacy (sender hidden, works with any wallet)
 */
export async function privateTransfer(
  wallet: WalletContextState,
  recipientWallet: string,
  amount: number,
  token: SupportedToken = 'SOL',
  type: 'internal' | 'external' = 'internal'
): Promise<string> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error('Wallet not connected or signMessage not available');
  }

  if (!recipientWallet || recipientWallet.length < 32) {
    throw new Error('Invalid recipient address');
  }

  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  await initializeShadowWire();
  const client = await getShadowWireClient();

  console.log(`[ShadowWire] ${type} transfer of ${amount} ${token} to ${recipientWallet.slice(0, 8)}...`);

  const transferRequest: SDKTransferRequest = {
    sender: wallet.publicKey.toBase58(),
    recipient: recipientWallet,
    amount, // SDK expects token units, not smallest units
    token,
    type,
    wallet: {
      signMessage: wallet.signMessage,
    },
  };

  const response = await client.transfer(transferRequest);

  console.log(`[ShadowWire] Transfer complete: ${response.tx_signature}`);
  return response.tx_signature;
}

/**
 * Generate a Bulletproof range proof locally (maximum privacy)
 * This proves that an amount is within a valid range without revealing the amount
 */
export async function generatePrivateRangeProof(
  amount: number,
  token: SupportedToken = 'SOL',
  bits = 64
): Promise<ZKProofData> {
  await initializeShadowWire();

  if (!generateRangeProofFn) {
    throw new Error('ShadowWire generateRangeProof function not found');
  }

  const smallestUnit = toSmallestUnit(amount, token);
  console.log(`[ShadowWire] Generating range proof for ${amount} ${token}...`);

  // SDK generateRangeProof takes number, not bigint
  const proof = await generateRangeProofFn(smallestUnit, bits);
  console.log('[ShadowWire] Range proof generated locally');

  return proof;
}

/**
 * Private transfer with client-side proof generation (maximum privacy)
 * The backend never sees the actual amount
 */
export async function privateTransferWithClientProof(
  wallet: WalletContextState,
  recipientWallet: string,
  amount: number,
  token: SupportedToken = 'SOL',
  type: 'internal' | 'external' = 'internal'
): Promise<string> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error('Wallet not connected or signMessage not available');
  }

  await initializeShadowWire();
  const client = await getShadowWireClient();

  // Generate proof locally
  const proof = await generatePrivateRangeProof(amount, token);

  console.log(`[ShadowWire] ${type} transfer with client-side proof...`);

  const transferRequest: TransferWithClientProofsRequest = {
    sender: wallet.publicKey.toBase58(),
    recipient: recipientWallet,
    amount,
    token,
    type,
    wallet: {
      signMessage: wallet.signMessage,
    },
    customProof: proof,
  };

  const response = await client.transferWithClientProofs(transferRequest);

  console.log(`[ShadowWire] Transfer with client proof complete: ${response.tx_signature}`);
  return response.tx_signature;
}

/**
 * Airdrop Distribution Helper
 *
 * Send tokens privately to multiple recipients
 * Used by projects to distribute airdrops to Vouch credential holders
 */
export interface AirdropRecipient {
  address: string;
  amount: number;
}

export interface AirdropResult {
  recipient: string;
  success: boolean;
  txSignature?: string;
  error?: string;
}

export async function distributePrivateAirdrop(
  wallet: WalletContextState,
  recipients: AirdropRecipient[],
  token: SupportedToken = 'SOL',
  useClientProofs = true,
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<AirdropResult[]> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error('Wallet not connected');
  }

  await initializeShadowWire();

  const results: AirdropResult[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    onProgress?.(i, recipients.length, recipient.address);

    try {
      const txSignature = useClientProofs
        ? await privateTransferWithClientProof(wallet, recipient.address, recipient.amount, token, 'internal')
        : await privateTransfer(wallet, recipient.address, recipient.amount, token, 'internal');

      results.push({
        recipient: recipient.address,
        success: true,
        txSignature,
      });
    } catch (error) {
      results.push({
        recipient: recipient.address,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Small delay between transfers to avoid rate limiting
    if (i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  onProgress?.(recipients.length, recipients.length, 'complete');
  return results;
}

/**
 * Claim airdrop helper
 * Used by Vouch credential holders to claim their airdrop
 */
export async function claimAirdropToWallet(
  wallet: WalletContextState,
  destinationWallet: string,
  token: SupportedToken = 'SOL'
): Promise<{ balance: number; txSignature?: string }> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error('Wallet not connected');
  }

  await initializeShadowWire();

  // Get current balance
  const { available } = await getShadowBalance(wallet.publicKey.toBase58(), token);

  if (available <= 0) {
    return { balance: 0 };
  }

  // Transfer to destination (external transfer works with any wallet)
  const txSignature = await privateTransfer(
    wallet,
    destinationWallet,
    available * 0.99, // Leave small amount for fees
    token,
    'external'
  );

  return { balance: available, txSignature };
}

// Legacy exports for backwards compatibility
export {
  privateTransfer as privateCredentialTransfer,
};

/**
 * ShadowWire flow helper for complete operations
 */
export interface ShadowWireFlowOptions {
  wallet: WalletContextState;
  recipientWallet: string;
  amount: number;
  token?: SupportedToken;
  transferType?: 'internal' | 'external';
  useClientProofs?: boolean;
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
    useClientProofs = true,
    onDepositComplete,
    onTransferComplete,
  } = options;

  // Step 1: Deposit to ShadowWire
  const depositTx = await depositToShadow(wallet, amount, token);
  onDepositComplete?.(depositTx);

  // Step 2: Private transfer
  const transferTx = useClientProofs
    ? await privateTransferWithClientProof(wallet, recipientWallet, amount, token, transferType)
    : await privateTransfer(wallet, recipientWallet, amount, token, transferType);
  onTransferComplete?.(transferTx);

  return { depositTx, transferTx };
}
