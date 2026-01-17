/**
 * ShadowWire SDK Integration (Production-Hardened)
 *
 * Enables private transfers and airdrops using Bulletproofs (zero-knowledge range proofs)
 *
 * Security Features:
 * - Retry logic with exponential backoff
 * - Abort/timeout support
 * - Structured logging
 * - Input validation
 * - State reset capability
 *
 * ShadowWire provides:
 * - Internal transfers: Full privacy (hides sender, recipient, and amount)
 * - External transfers: Partial privacy (hides sender only)
 *
 * @see https://github.com/Radrdotfun/ShadowWire
 * @see https://www.radrlabs.io
 */

import type { WalletContextState } from '@solana/wallet-adapter-react';

import type {
  DepositRequest as SDKDepositRequest,
  WithdrawRequest as SDKWithdrawRequest,
  TransferRequest as SDKTransferRequest,
  TransferWithClientProofsRequest,
  TokenSymbol,
  ZKProofData,
  WalletAdapter,
} from '@radr/shadowwire';

import {
  createLogger,
  withRetry,
  withTimeout,
  sleep,
  createResettableSingleton,
  isValidSolanaAddress,
  isValidAmount,
  assert,
  type RetryOptions,
} from './privacy-utils';

// ============================================================================
// Re-exports
// ============================================================================

export type { TokenSymbol, ZKProofData, WalletAdapter };

// ============================================================================
// Constants
// ============================================================================

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

// ============================================================================
// Logger
// ============================================================================

const logger = createLogger('ShadowWire');

// ============================================================================
// SDK Management (Resettable Singleton)
// ============================================================================

interface ShadowWireSDK {
  ShadowWireClient: typeof import('@radr/shadowwire').ShadowWireClient;
  initWASM: typeof import('@radr/shadowwire').initWASM;
  isWASMSupported: typeof import('@radr/shadowwire').isWASMSupported;
  generateRangeProof: typeof import('@radr/shadowwire').generateRangeProof;
}

let sdk: ShadowWireSDK | null = null;
let wasmInitialized = false;

const sdkLoader = createResettableSingleton(
  async (): Promise<ShadowWireSDK> => {
    const imported = await import('@radr/shadowwire');

    if (!imported.ShadowWireClient) {
      throw new Error('ShadowWireClient class not found in SDK');
    }

    sdk = {
      ShadowWireClient: imported.ShadowWireClient,
      initWASM: imported.initWASM,
      isWASMSupported: imported.isWASMSupported,
      generateRangeProof: imported.generateRangeProof,
    };

    logger.debug('SDK loaded successfully');
    return sdk;
  },
  () => {
    sdk = null;
    wasmInitialized = false;
    clientSingleton.reset();
    logger.debug('SDK unloaded');
  }
);

const clientSingleton = createResettableSingleton(
  async () => {
    const { ShadowWireClient } = await sdkLoader.get();
    return new ShadowWireClient({
      debug: process.env.NODE_ENV === 'development',
    });
  },
  () => {
    logger.debug('Client instance reset');
  }
);

// ============================================================================
// SDK Availability
// ============================================================================

/**
 * Check if ShadowWire SDK is available
 */
export async function isShadowWireAvailable(): Promise<boolean> {
  try {
    await sdkLoader.get();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if browser supports WebAssembly (required for Bulletproofs)
 */
export function isWASMSupported(): boolean {
  if (sdk?.isWASMSupported) {
    return sdk.isWASMSupported();
  }
  // Fallback check
  return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
}

/**
 * Reset SDK state (for testing or cleanup)
 */
export async function resetShadowWireSDK(): Promise<void> {
  await clientSingleton.reset();
  await sdkLoader.reset();
  wasmInitialized = false;
}

// ============================================================================
// WASM Initialization
// ============================================================================

/**
 * Initialize ShadowWire WASM (required before transfers)
 * Call this early in your app initialization for better UX
 */
export async function initializeShadowWire(
  wasmPath = '/wasm/settler_wasm_bg.wasm',
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<void> {
  const { signal, timeoutMs = 30000 } = options;

  if (wasmInitialized) return;

  return withTimeout(
    async () => {
      const loadedSdk = await sdkLoader.get();

      if (!isWASMSupported()) {
        throw new Error('Browser does not support WebAssembly. Please use a modern browser.');
      }

      if (!loadedSdk.initWASM) {
        throw new Error('ShadowWire initWASM function not found');
      }

      logger.info('Initializing WASM...', { path: wasmPath });
      await loadedSdk.initWASM(wasmPath);
      wasmInitialized = true;
      logger.info('WASM initialized successfully');
    },
    timeoutMs,
    signal
  );
}

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Convert human-readable amount to smallest unit
 */
export function toSmallestUnit(amount: number, token: SupportedToken): number {
  const decimals = TOKEN_DECIMALS[token] ?? 9;
  return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Convert smallest unit to human-readable amount
 */
export function fromSmallestUnit(amount: number, token: SupportedToken): number {
  const decimals = TOKEN_DECIMALS[token] ?? 9;
  return amount / Math.pow(10, decimals);
}

/**
 * Validate token is supported
 */
export function isSupportedToken(token: string): token is SupportedToken {
  return SUPPORTED_TOKENS.includes(token as SupportedToken);
}

// ============================================================================
// Operation Options
// ============================================================================

export interface ShadowWireOperationOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Timeout in ms (default: 120000) */
  timeoutMs?: number;
  /** Retry options */
  retry?: RetryOptions;
}

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 15000,
};

// ============================================================================
// Balance Operations
// ============================================================================

/**
 * Get ShadowWire balance for a wallet
 */
export async function getShadowBalance(
  walletAddress: string,
  token: SupportedToken = 'SOL',
  options: ShadowWireOperationOptions = {}
): Promise<{ available: number; poolAddress: string }> {
  if (!walletAddress) {
    return { available: 0, poolAddress: '' };
  }

  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, retry = DEFAULT_RETRY_OPTIONS } = options;

  try {
    return await withTimeout(
      async () => {
        await initializeShadowWire();
        const client = await clientSingleton.get();

        const balance = await withRetry(() => client.getBalance(walletAddress, token), {
          ...retry,
          signal,
        });

        return {
          available: fromSmallestUnit(balance.available, token),
          poolAddress: balance.pool_address,
        };
      },
      timeoutMs,
      signal
    );
  } catch (error) {
    logger.error('Failed to get balance', error);
    return { available: 0, poolAddress: '' };
  }
}

// ============================================================================
// Deposit/Withdraw Operations
// ============================================================================

/**
 * Deposit funds to ShadowWire pool
 */
export async function depositToShadow(
  wallet: WalletContextState,
  amountSol: number,
  token: SupportedToken = 'SOL',
  options: ShadowWireOperationOptions = {}
): Promise<string> {
  assert(wallet.publicKey !== null, 'Wallet not connected');
  assert(wallet.signTransaction !== undefined, 'Wallet cannot sign transactions');
  assert(isValidAmount(amountSol), `Invalid amount: ${amountSol}`);

  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, retry = DEFAULT_RETRY_OPTIONS } = options;

  return withTimeout(
    async () => {
      await initializeShadowWire();
      const client = await clientSingleton.get();

      const amount = toSmallestUnit(amountSol, token);
      logger.info('Depositing', { amount: amountSol, token });

      const depositRequest: SDKDepositRequest = {
        wallet: wallet.publicKey!.toBase58(),
        amount,
      };

      const response = await withRetry(() => client.deposit(depositRequest), {
        ...retry,
        signal,
        onRetry: (err, attempt, delay) => {
          logger.warn(`Deposit retry ${attempt}`, { error: String(err), delayMs: delay });
        },
      });

      logger.info('Deposit complete', { tx: response.unsigned_tx_base64.slice(0, 20) + '...' });
      return response.unsigned_tx_base64;
    },
    timeoutMs,
    signal
  );
}

/**
 * Withdraw funds from ShadowWire pool
 */
export async function withdrawFromShadow(
  wallet: WalletContextState,
  amountSol: number,
  token: SupportedToken = 'SOL',
  options: ShadowWireOperationOptions = {}
): Promise<string> {
  assert(wallet.publicKey !== null, 'Wallet not connected');
  assert(wallet.signTransaction !== undefined, 'Wallet cannot sign transactions');
  assert(isValidAmount(amountSol), `Invalid amount: ${amountSol}`);

  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, retry = DEFAULT_RETRY_OPTIONS } = options;

  return withTimeout(
    async () => {
      await initializeShadowWire();
      const client = await clientSingleton.get();

      const amount = toSmallestUnit(amountSol, token);
      logger.info('Withdrawing', { amount: amountSol, token });

      const withdrawRequest: SDKWithdrawRequest = {
        wallet: wallet.publicKey!.toBase58(),
        amount,
      };

      const response = await withRetry(() => client.withdraw(withdrawRequest), {
        ...retry,
        signal,
        onRetry: (err, attempt, delay) => {
          logger.warn(`Withdraw retry ${attempt}`, { error: String(err), delayMs: delay });
        },
      });

      logger.info('Withdrawal complete');
      return response.unsigned_tx_base64;
    },
    timeoutMs,
    signal
  );
}

// ============================================================================
// Transfer Operations
// ============================================================================

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
  type: 'internal' | 'external' = 'internal',
  options: ShadowWireOperationOptions = {}
): Promise<string> {
  assert(wallet.publicKey !== null, 'Wallet not connected');
  assert(wallet.signMessage !== undefined, 'Wallet cannot sign messages');
  assert(isValidSolanaAddress(recipientWallet), `Invalid recipient: ${recipientWallet}`);
  assert(isValidAmount(amount), `Invalid amount: ${amount}`);

  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, retry = DEFAULT_RETRY_OPTIONS } = options;

  return withTimeout(
    async () => {
      await initializeShadowWire();
      const client = await clientSingleton.get();

      logger.info('Private transfer', {
        type,
        amount,
        token,
        recipient: recipientWallet.slice(0, 8) + '...',
      });

      const transferRequest: SDKTransferRequest = {
        sender: wallet.publicKey!.toBase58(),
        recipient: recipientWallet,
        amount,
        token,
        type,
        wallet: {
          signMessage: wallet.signMessage!,
        },
      };

      const response = await withRetry(() => client.transfer(transferRequest), {
        ...retry,
        signal,
        onRetry: (err, attempt, delay) => {
          logger.warn(`Transfer retry ${attempt}`, { error: String(err), delayMs: delay });
        },
      });

      logger.info('Transfer complete', { tx: response.tx_signature.slice(0, 16) + '...' });
      return response.tx_signature;
    },
    timeoutMs,
    signal
  );
}

// ============================================================================
// Range Proof Generation
// ============================================================================

/**
 * Generate a Bulletproof range proof locally (maximum privacy)
 * This proves that an amount is within a valid range without revealing the amount
 */
export async function generatePrivateRangeProof(
  amount: number,
  token: SupportedToken = 'SOL',
  bits = 64,
  options: ShadowWireOperationOptions = {}
): Promise<ZKProofData> {
  assert(isValidAmount(amount), `Invalid amount: ${amount}`);

  const { signal, timeoutMs = 60000 } = options;

  return withTimeout(
    async () => {
      await initializeShadowWire();
      const loadedSdk = await sdkLoader.get();

      if (!loadedSdk.generateRangeProof) {
        throw new Error('ShadowWire generateRangeProof function not found');
      }

      const smallestUnit = toSmallestUnit(amount, token);
      logger.info('Generating range proof', { amount, token });

      const proof = await loadedSdk.generateRangeProof(smallestUnit, bits);
      logger.info('Range proof generated');

      return proof;
    },
    timeoutMs,
    signal
  );
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
  type: 'internal' | 'external' = 'internal',
  options: ShadowWireOperationOptions = {}
): Promise<string> {
  assert(wallet.publicKey !== null, 'Wallet not connected');
  assert(wallet.signMessage !== undefined, 'Wallet cannot sign messages');
  assert(isValidSolanaAddress(recipientWallet), `Invalid recipient: ${recipientWallet}`);
  assert(isValidAmount(amount), `Invalid amount: ${amount}`);

  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, retry = DEFAULT_RETRY_OPTIONS } = options;

  return withTimeout(
    async () => {
      await initializeShadowWire();
      const client = await clientSingleton.get();

      // Generate proof locally
      const proof = await generatePrivateRangeProof(amount, token, 64, { signal });

      logger.info('Transfer with client-side proof', {
        type,
        recipient: recipientWallet.slice(0, 8) + '...',
      });

      const transferRequest: TransferWithClientProofsRequest = {
        sender: wallet.publicKey!.toBase58(),
        recipient: recipientWallet,
        amount,
        token,
        type,
        wallet: {
          signMessage: wallet.signMessage!,
        },
        customProof: proof,
      };

      const response = await withRetry(() => client.transferWithClientProofs(transferRequest), {
        ...retry,
        signal,
        onRetry: (err, attempt, delay) => {
          logger.warn(`Transfer retry ${attempt}`, { error: String(err), delayMs: delay });
        },
      });

      logger.info('Transfer with client proof complete', {
        tx: response.tx_signature.slice(0, 16) + '...',
      });
      return response.tx_signature;
    },
    timeoutMs,
    signal
  );
}

// ============================================================================
// Airdrop Distribution
// ============================================================================

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

export interface AirdropProgress {
  completed: number;
  total: number;
  current: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

/**
 * Distribute tokens privately to multiple recipients
 */
export async function distributePrivateAirdrop(
  wallet: WalletContextState,
  recipients: AirdropRecipient[],
  token: SupportedToken = 'SOL',
  options: {
    useClientProofs?: boolean;
    signal?: AbortSignal;
    delayBetweenTransfers?: number;
    onProgress?: (progress: AirdropProgress) => void;
  } = {}
): Promise<AirdropResult[]> {
  assert(wallet.publicKey !== null, 'Wallet not connected');
  assert(wallet.signMessage !== undefined, 'Wallet cannot sign messages');
  assert(recipients.length > 0, 'No recipients provided');

  const {
    useClientProofs = true,
    signal,
    delayBetweenTransfers = 500,
    onProgress,
  } = options;

  await initializeShadowWire();

  const results: AirdropResult[] = [];

  for (let i = 0; i < recipients.length; i++) {
    // Check for abort
    if (signal?.aborted) {
      logger.warn('Airdrop aborted', { completed: i, total: recipients.length });
      break;
    }

    const recipient = recipients[i];

    onProgress?.({
      completed: i,
      total: recipients.length,
      current: recipient.address,
      status: 'processing',
    });

    // Validate recipient
    if (!isValidSolanaAddress(recipient.address)) {
      results.push({
        recipient: recipient.address,
        success: false,
        error: 'Invalid address',
      });
      continue;
    }

    if (!isValidAmount(recipient.amount)) {
      results.push({
        recipient: recipient.address,
        success: false,
        error: 'Invalid amount',
      });
      continue;
    }

    try {
      const txSignature = useClientProofs
        ? await privateTransferWithClientProof(
            wallet,
            recipient.address,
            recipient.amount,
            token,
            'internal',
            { signal }
          )
        : await privateTransfer(
            wallet,
            recipient.address,
            recipient.amount,
            token,
            'internal',
            { signal }
          );

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

    // Delay between transfers to avoid rate limiting
    if (i < recipients.length - 1 && delayBetweenTransfers > 0) {
      await sleep(delayBetweenTransfers, signal);
    }
  }

  onProgress?.({
    completed: recipients.length,
    total: recipients.length,
    current: 'complete',
    status: 'complete',
  });

  const successCount = results.filter(r => r.success).length;
  logger.info('Airdrop complete', {
    total: recipients.length,
    success: successCount,
    failed: recipients.length - successCount,
  });

  return results;
}

/**
 * Claim airdrop to wallet
 */
export async function claimAirdropToWallet(
  wallet: WalletContextState,
  destinationWallet: string,
  token: SupportedToken = 'SOL',
  options: ShadowWireOperationOptions = {}
): Promise<{ balance: number; txSignature?: string }> {
  assert(wallet.publicKey !== null, 'Wallet not connected');
  assert(wallet.signMessage !== undefined, 'Wallet cannot sign messages');
  assert(isValidSolanaAddress(destinationWallet), `Invalid destination: ${destinationWallet}`);

  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  return withTimeout(
    async () => {
      await initializeShadowWire();

      // Get current balance
      const { available } = await getShadowBalance(wallet.publicKey!.toBase58(), token, { signal });

      if (available <= 0) {
        return { balance: 0 };
      }

      // Transfer to destination (external transfer works with any wallet)
      // Leave small amount for fees
      const transferAmount = available * 0.99;

      const txSignature = await privateTransfer(
        wallet,
        destinationWallet,
        transferAmount,
        token,
        'external',
        { signal }
      );

      return { balance: available, txSignature };
    },
    timeoutMs,
    signal
  );
}

// ============================================================================
// Legacy Exports
// ============================================================================

export { privateTransfer as privateCredentialTransfer };

// ============================================================================
// Flow Helper
// ============================================================================

export interface ShadowWireFlowOptions {
  wallet: WalletContextState;
  recipientWallet: string;
  amount: number;
  token?: SupportedToken;
  transferType?: 'internal' | 'external';
  useClientProofs?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  onDepositComplete?: (txSignature: string) => void;
  onTransferComplete?: (txSignature: string) => void;
}

export interface ShadowWireFlowResult {
  success: boolean;
  depositTx?: string;
  transferTx?: string;
  error?: string;
}

/**
 * Execute complete ShadowWire flow (deposit + transfer)
 */
export async function executeShadowWireFlow(
  options: ShadowWireFlowOptions
): Promise<ShadowWireFlowResult> {
  const {
    wallet,
    recipientWallet,
    amount,
    token = 'SOL',
    transferType = 'internal',
    useClientProofs = true,
    signal,
    timeoutMs = 300000,
    onDepositComplete,
    onTransferComplete,
  } = options;

  try {
    return await withTimeout(
      async (sig) => {
        // Step 1: Deposit to ShadowWire
        const depositTx = await depositToShadow(wallet, amount, token, { signal: sig });
        onDepositComplete?.(depositTx);

        // Step 2: Private transfer
        const transferTx = useClientProofs
          ? await privateTransferWithClientProof(
              wallet,
              recipientWallet,
              amount,
              token,
              transferType,
              { signal: sig }
            )
          : await privateTransfer(wallet, recipientWallet, amount, token, transferType, {
              signal: sig,
            });
        onTransferComplete?.(transferTx);

        return { success: true, depositTx, transferTx };
      },
      timeoutMs,
      signal
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('ShadowWire flow failed', error);
    return { success: false, error: errorMessage };
  }
}
