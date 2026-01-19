/**
 * Privacy Cash SDK Integration (Production-Hardened)
 *
 * Enables anonymous funding for Vouch Protocol burner wallets using
 * Tornado Cash-style mixing on Solana.
 *
 * Security Features:
 * - Secure memory cleanup for ephemeral keys
 * - Retry logic with exponential backoff
 * - Dynamic fee estimation
 * - Abort/timeout support
 * - Proper transaction confirmation
 *
 * @see https://github.com/Privacy-Cash/privacy-cash-sdk
 * @see https://privacycash.co
 */

import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';

import {
  createLogger,
  secureZero,
  secureCleanupKeypair,
  withRetry,
  withTimeout,
  confirmTransaction,
  calculateFundingAmount,
  createResettableSingleton,
  isValidSolanaAddress,
  isValidAmount,
  assert,
  type RetryOptions,
} from './privacy-utils';

// ============================================================================
// Types
// ============================================================================

interface PrivacyCashConfig {
  RPC_url: string;
  owner: string | number[] | Uint8Array | Keypair;
  enableDebug?: boolean;
}

interface DepositResult {
  tx: string;
}

interface WithdrawResult {
  isPartial: boolean;
  tx: string;
  recipient: string;
  amount_in_lamports: number;
  fee_in_lamports: number;
}

interface BalanceResult {
  lamports: number;
}

interface SPLDepositResult {
  tx: string;
}

interface SPLWithdrawResult {
  isPartial: boolean;
  tx: string;
  recipient: string;
  base_units: number;
  fee_base_units: number;
}

interface SPLBalanceResult {
  base_units: number;
  amount: number;
  lamports: number;
}

interface PrivacyCashClient {
  deposit(options: { lamports: number }): Promise<DepositResult>;
  withdraw(options: {
    lamports: number;
    recipientAddress?: string;
    referrer?: string;
  }): Promise<WithdrawResult>;
  getPrivateBalance(abortSignal?: AbortSignal): Promise<BalanceResult>;
  depositSPL(options: {
    base_units?: number;
    amount?: number;
    mintAddress: PublicKey | string;
  }): Promise<SPLDepositResult>;
  withdrawSPL(options: {
    base_units?: number;
    amount?: number;
    mintAddress: PublicKey | string;
    recipientAddress?: string;
    referrer?: string;
  }): Promise<SPLWithdrawResult>;
  getPrivateBalanceSpl(mintAddress: PublicKey | string): Promise<SPLBalanceResult>;
  clearCache(): Promise<PrivacyCashClient>;
  publicKey: PublicKey;
}

type PrivacyCashConstructor = new (config: PrivacyCashConfig) => PrivacyCashClient;

// ============================================================================
// Logger
// ============================================================================

const logger = createLogger('PrivacyCash');

// ============================================================================
// SDK Management (Resettable Singleton)
// ============================================================================

let PrivacyCashClass: PrivacyCashConstructor | null = null;

const sdkLoader = createResettableSingleton(
  async () => {
    // Use webpackIgnore to prevent webpack from bundling this at build time
    // NOTE: privacycash SDK uses node:path and is not browser-compatible
    // This will fail at runtime in browser - Privacy Cash requires server-side execution
    const sdk = await import(/* webpackIgnore: true */ 'privacycash');
    PrivacyCashClass = sdk.PrivacyCash as unknown as PrivacyCashConstructor;

    if (!PrivacyCashClass) {
      throw new Error('PrivacyCash class not found in SDK');
    }

    logger.debug('SDK loaded successfully');
    return PrivacyCashClass;
  },
  () => {
    PrivacyCashClass = null;
    logger.debug('SDK unloaded');
  }
);

/**
 * Check if Privacy Cash SDK is available
 */
export async function isPrivacyCashAvailable(): Promise<boolean> {
  try {
    await sdkLoader.get();
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset SDK state (for testing or cleanup)
 */
export async function resetPrivacyCashSDK(): Promise<void> {
  await sdkLoader.reset();
}

// ============================================================================
// Ephemeral Keypair Management
// ============================================================================

/**
 * Ephemeral keypair with secure cleanup support
 */
export interface EphemeralKeypair {
  keypair: Keypair;
  publicKey: string;
  secretKey: Uint8Array;
  /** Mark keypair as used (triggers cleanup warning if accessed after) */
  _used?: boolean;
}

/**
 * Generate a new ephemeral keypair for Privacy Cash operations
 */
export function generateEphemeralKeypair(): EphemeralKeypair {
  const keypair = Keypair.generate();
  return {
    keypair,
    publicKey: keypair.publicKey.toBase58(),
    secretKey: keypair.secretKey,
    _used: false,
  };
}

/**
 * Securely cleanup an ephemeral keypair (zeros memory)
 * IMPORTANT: Call this after you're done with the keypair
 */
export function cleanupEphemeralKeypair(ephemeral: EphemeralKeypair): void {
  if (ephemeral._used) {
    logger.warn('Keypair already cleaned up');
    return;
  }

  secureCleanupKeypair(ephemeral);
  secureZero(ephemeral.keypair.secretKey);
  ephemeral._used = true;

  logger.debug('Ephemeral keypair securely cleaned up');
}

// ============================================================================
// Core Operations
// ============================================================================

/**
 * Options for Privacy Cash operations
 */
export interface PrivacyCashOperationOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Timeout in ms (default: 120000) */
  timeoutMs?: number;
  /** Retry options */
  retry?: RetryOptions;
  /** Enable debug logging */
  debug?: boolean;
}

const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 15000,
};

/**
 * Fund an ephemeral wallet from the user's main wallet
 */
export async function fundEphemeralWallet(
  connection: Connection,
  wallet: WalletContextState,
  ephemeralPublicKey: PublicKey,
  amountSol: number,
  options: PrivacyCashOperationOptions = {}
): Promise<string> {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  assert(wallet.publicKey !== null, 'Wallet not connected');
  assert(wallet.signTransaction !== undefined, 'Wallet cannot sign transactions');
  assert(isValidAmount(amountSol), `Invalid amount: ${amountSol}`);

  return withTimeout(
    async (sig) => {
      const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey!,
          toPubkey: ephemeralPublicKey,
          lamports,
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey!;

      const signed = await wallet.signTransaction!(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());

      // Confirm with proper commitment
      await confirmTransaction(connection, signature, {
        commitment: 'confirmed',
        timeoutMs: 30000,
        signal: sig,
      });

      logger.info('Funded ephemeral wallet', {
        amount: amountSol,
        signature: signature.slice(0, 16) + '...',
      });

      return signature;
    },
    timeoutMs,
    signal
  );
}

/**
 * Create Privacy Cash client with ephemeral keypair
 */
export async function createPrivacyCashClient(
  rpcUrl: string,
  ephemeralKeypair: Keypair,
  enableDebug = false
): Promise<PrivacyCashClient> {
  const PrivacyCash = await sdkLoader.get();

  return new PrivacyCash({
    RPC_url: rpcUrl,
    owner: ephemeralKeypair.secretKey,
    enableDebug,
  });
}

/**
 * Deposit SOL to Privacy Cash pool with retry
 */
export async function depositToPrivacyCash(
  client: PrivacyCashClient,
  amountSol: number,
  options: PrivacyCashOperationOptions = {}
): Promise<string> {
  const { signal, retry = DEFAULT_RETRY_OPTIONS } = options;

  assert(isValidAmount(amountSol), `Invalid amount: ${amountSol}`);

  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  logger.info('Depositing to pool', { amount: amountSol });

  const result = await withRetry(
    () => client.deposit({ lamports }),
    {
      ...retry,
      signal,
      onRetry: (err, attempt, delay) => {
        logger.warn(`Deposit retry ${attempt}`, { error: String(err), delayMs: delay });
      },
    }
  );

  logger.info('Deposit complete', { tx: result.tx.slice(0, 16) + '...' });
  return result.tx;
}

/**
 * Withdraw SOL from Privacy Cash to any address with retry
 */
export async function withdrawFromPrivacyCash(
  client: PrivacyCashClient,
  amountSol: number,
  recipientAddress: string,
  options: PrivacyCashOperationOptions = {}
): Promise<WithdrawResult> {
  const { signal, retry = DEFAULT_RETRY_OPTIONS } = options;

  assert(isValidAmount(amountSol), `Invalid amount: ${amountSol}`);
  assert(isValidSolanaAddress(recipientAddress), `Invalid recipient: ${recipientAddress}`);

  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  logger.info('Withdrawing from pool', {
    amount: amountSol,
    recipient: recipientAddress.slice(0, 8) + '...',
  });

  const result = await withRetry(
    () => client.withdraw({ lamports, recipientAddress }),
    {
      ...retry,
      signal,
      onRetry: (err, attempt, delay) => {
        logger.warn(`Withdraw retry ${attempt}`, { error: String(err), delayMs: delay });
      },
    }
  );

  logger.info('Withdrawal complete', {
    tx: result.tx.slice(0, 16) + '...',
    isPartial: result.isPartial,
    fee: result.fee_in_lamports / LAMPORTS_PER_SOL,
  });

  return result;
}

/**
 * Get private balance in Privacy Cash pool
 */
export async function getPrivateCashBalance(
  client: PrivacyCashClient,
  signal?: AbortSignal
): Promise<number> {
  const result = await client.getPrivateBalance(signal);
  return result.lamports / LAMPORTS_PER_SOL;
}

// ============================================================================
// High-Level Flow APIs
// ============================================================================

/**
 * Options for the complete privacy funding flow
 */
export interface PrivacyFundingOptions {
  connection: Connection;
  wallet: WalletContextState;
  burnerPublicKey: PublicKey;
  amountSol: number;
  rpcUrl?: string;
  /** Abort signal */
  signal?: AbortSignal;
  /** Timeout for entire flow in ms (default: 300000 = 5 min) */
  timeoutMs?: number;
  /** Progress callback */
  onProgress?: (step: string, message: string, percentage: number) => void;
  /** Whether to auto-cleanup ephemeral keypair on completion (default: true) */
  autoCleanup?: boolean;
}

export interface PrivacyFundingResult {
  success: boolean;
  ephemeralKeypair?: EphemeralKeypair;
  fundEphemeralTx?: string;
  depositTx?: string;
  withdrawTx?: string;
  withdrawResult?: WithdrawResult;
  actualAmountReceived?: number;
  error?: string;
  /** Call this to cleanup the ephemeral keypair */
  cleanup: () => void;
}

/**
 * Complete flow: Fund burner wallet anonymously via Privacy Cash
 */
export async function fundBurnerViaPrivacyCash(
  options: PrivacyFundingOptions
): Promise<PrivacyFundingResult> {
  const {
    connection,
    wallet,
    burnerPublicKey,
    amountSol,
    rpcUrl,
    signal,
    timeoutMs = 300000,
    onProgress,
    autoCleanup = true,
  } = options;

  const effectiveRpcUrl =
    rpcUrl || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  let ephemeral: EphemeralKeypair | undefined;

  const cleanup = () => {
    if (ephemeral && !ephemeral._used) {
      cleanupEphemeralKeypair(ephemeral);
    }
  };

  const report = (step: string, message: string, percentage: number) => {
    logger.debug(`${step}: ${message}`);
    onProgress?.(step, message, percentage);
  };

  try {
    return await withTimeout(
      async (sig) => {
        // Step 1: Calculate required funding with dynamic fees
        report('calculating', 'Estimating fees...', 5);
        const { totalRequired } = await calculateFundingAmount(connection, amountSol, {
          includePrivacyCashFees: true,
          priorityLevel: 'medium',
        });

        // Step 2: Generate ephemeral keypair
        report('generating', 'Creating ephemeral wallet...', 10);
        ephemeral = generateEphemeralKeypair();

        // Step 3: Fund ephemeral
        report('funding', `Funding ephemeral with ${totalRequired.toFixed(4)} SOL...`, 20);
        const fundEphemeralTx = await fundEphemeralWallet(
          connection,
          wallet,
          ephemeral.keypair.publicKey,
          totalRequired,
          { signal: sig }
        );

        // Step 4: Create Privacy Cash client
        report('connecting', 'Connecting to Privacy Cash...', 40);
        const client = await createPrivacyCashClient(
          effectiveRpcUrl,
          ephemeral.keypair,
          process.env.NODE_ENV === 'development'
        );

        // Step 5: Deposit to Privacy Cash pool
        report('depositing', 'Depositing to privacy pool...', 50);
        const depositTx = await depositToPrivacyCash(client, amountSol, { signal: sig });

        // Step 6: Withdraw to burner
        report('withdrawing', 'Withdrawing to burner wallet...', 75);
        const withdrawResult = await withdrawFromPrivacyCash(
          client,
          amountSol * 0.995, // Leave 0.5% for fees
          burnerPublicKey.toBase58(),
          { signal: sig }
        );

        report('complete', 'Burner wallet funded anonymously!', 100);

        // Auto cleanup if enabled
        if (autoCleanup) {
          cleanup();
        }

        return {
          success: true,
          ephemeralKeypair: autoCleanup ? undefined : ephemeral,
          fundEphemeralTx,
          depositTx,
          withdrawTx: withdrawResult.tx,
          withdrawResult,
          actualAmountReceived: withdrawResult.amount_in_lamports / LAMPORTS_PER_SOL,
          cleanup,
        };
      },
      timeoutMs,
      signal
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Privacy funding failed', error);

    // Always cleanup on error
    cleanup();

    return {
      success: false,
      error: errorMessage,
      cleanup: () => {}, // No-op, already cleaned up
    };
  }
}

/**
 * Shield SOL for proof generation (simplified API for prove-flow.ts)
 */
export async function shieldForProof(
  connection: Connection,
  wallet: WalletContextState,
  amountSol: number,
  options: {
    rpcUrl?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {}
): Promise<{ ephemeralKeypair: EphemeralKeypair; depositTx: string; cleanup: () => void }> {
  const {
    rpcUrl,
    signal,
    timeoutMs = 180000,
  } = options;

  assert(wallet.publicKey !== null, 'Wallet not connected');
  assert(wallet.signTransaction !== undefined, 'Wallet cannot sign');
  assert(isValidAmount(amountSol), `Invalid amount: ${amountSol}`);

  const effectiveRpcUrl =
    rpcUrl || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  const ephemeral = generateEphemeralKeypair();

  const cleanup = () => {
    if (!ephemeral._used) {
      cleanupEphemeralKeypair(ephemeral);
    }
  };

  try {
    return await withTimeout(
      async (sig) => {
        // Calculate funding with fees
        const { totalRequired } = await calculateFundingAmount(connection, amountSol);

        // Fund ephemeral wallet
        await fundEphemeralWallet(
          connection,
          wallet,
          ephemeral.keypair.publicKey,
          totalRequired,
          { signal: sig }
        );

        // Create Privacy Cash client with ephemeral
        const client = await createPrivacyCashClient(
          effectiveRpcUrl,
          ephemeral.keypair,
          process.env.NODE_ENV === 'development'
        );

        // Deposit to Privacy Cash
        const depositTx = await depositToPrivacyCash(client, amountSol, { signal: sig });

        return { ephemeralKeypair: ephemeral, depositTx, cleanup };
      },
      timeoutMs,
      signal
    );
  } catch (error) {
    cleanup();
    throw error;
  }
}

/**
 * Withdraw privately to recipient (simplified API for prove-flow.ts)
 */
export async function withdrawPrivately(
  ephemeralKeypair: EphemeralKeypair,
  recipientAddress: string,
  amountSol: number,
  options: {
    rpcUrl?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    autoCleanup?: boolean;
  } = {}
): Promise<{ tx: string; actualAmount: number }> {
  const {
    rpcUrl,
    signal,
    timeoutMs = 120000,
    autoCleanup = true,
  } = options;

  assert(!ephemeralKeypair._used, 'Ephemeral keypair already used/cleaned up');
  assert(isValidSolanaAddress(recipientAddress), `Invalid recipient: ${recipientAddress}`);
  assert(isValidAmount(amountSol), `Invalid amount: ${amountSol}`);

  const effectiveRpcUrl =
    rpcUrl || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  try {
    return await withTimeout(
      async (sig) => {
        // Create client with ephemeral keypair
        const client = await createPrivacyCashClient(
          effectiveRpcUrl,
          ephemeralKeypair.keypair,
          process.env.NODE_ENV === 'development'
        );

        // Withdraw to recipient (leave room for fees)
        const withdrawAmount = amountSol * 0.995;
        const result = await withdrawFromPrivacyCash(client, withdrawAmount, recipientAddress, {
          signal: sig,
        });

        return {
          tx: result.tx,
          actualAmount: result.amount_in_lamports / LAMPORTS_PER_SOL,
        };
      },
      timeoutMs,
      signal
    );
  } finally {
    if (autoCleanup) {
      cleanupEphemeralKeypair(ephemeralKeypair);
    }
  }
}

/**
 * Get private balance helper
 */
export async function getPrivateBalance(
  ephemeralKeypair: EphemeralKeypair,
  options: {
    rpcUrl?: string;
    signal?: AbortSignal;
  } = {}
): Promise<number> {
  const { rpcUrl, signal } = options;

  assert(!ephemeralKeypair._used, 'Ephemeral keypair already used/cleaned up');

  const effectiveRpcUrl =
    rpcUrl || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  const client = await createPrivacyCashClient(effectiveRpcUrl, ephemeralKeypair.keypair, false);

  return getPrivateCashBalance(client, signal);
}

// ============================================================================
// SPL Token Operations
// ============================================================================

export async function depositSPLToPrivacyCash(
  client: PrivacyCashClient,
  mintAddress: string,
  amount: number,
  options: PrivacyCashOperationOptions = {}
): Promise<string> {
  const { signal, retry = DEFAULT_RETRY_OPTIONS } = options;

  assert(isValidSolanaAddress(mintAddress), `Invalid mint: ${mintAddress}`);
  assert(isValidAmount(amount), `Invalid amount: ${amount}`);

  logger.info('Depositing SPL tokens', { mint: mintAddress.slice(0, 8), amount });

  const result = await withRetry(() => client.depositSPL({ amount, mintAddress }), {
    ...retry,
    signal,
  });

  logger.info('SPL deposit complete', { tx: result.tx.slice(0, 16) + '...' });
  return result.tx;
}

export async function withdrawSPLFromPrivacyCash(
  client: PrivacyCashClient,
  mintAddress: string,
  amount: number,
  recipientAddress: string,
  options: PrivacyCashOperationOptions = {}
): Promise<string> {
  const { signal, retry = DEFAULT_RETRY_OPTIONS } = options;

  assert(isValidSolanaAddress(mintAddress), `Invalid mint: ${mintAddress}`);
  assert(isValidSolanaAddress(recipientAddress), `Invalid recipient: ${recipientAddress}`);
  assert(isValidAmount(amount), `Invalid amount: ${amount}`);

  logger.info('Withdrawing SPL tokens', {
    mint: mintAddress.slice(0, 8),
    amount,
    recipient: recipientAddress.slice(0, 8),
  });

  const result = await withRetry(
    () => client.withdrawSPL({ amount, mintAddress, recipientAddress }),
    { ...retry, signal }
  );

  logger.info('SPL withdrawal complete', { tx: result.tx.slice(0, 16) + '...' });
  return result.tx;
}

export async function getSPLPrivateBalance(
  client: PrivacyCashClient,
  mintAddress: string
): Promise<number> {
  assert(isValidSolanaAddress(mintAddress), `Invalid mint: ${mintAddress}`);

  const result = await client.getPrivateBalanceSpl(mintAddress);
  return result.amount;
}
