/**
 * Privacy SDK Utilities
 * Shared utilities for Privacy Cash and ShadowWire integrations
 *
 * Provides:
 * - Secure memory cleanup for cryptographic material
 * - Retry logic with exponential backoff
 * - Structured logging with levels
 * - Abort/timeout handling
 * - Dynamic fee estimation
 */

import type { Connection, Commitment } from '@solana/web3.js';

// ============================================================================
// Logging
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  enabled: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
  prefix: 'Privacy',
  enabled: process.env.NODE_ENV !== 'test',
};

/**
 * Structured logger that respects log levels and environment
 */
export function createLogger(prefix: string, config?: Partial<LoggerConfig>) {
  const cfg: LoggerConfig = { ...DEFAULT_CONFIG, ...config, prefix };

  const shouldLog = (level: LogLevel): boolean => {
    return cfg.enabled && LOG_LEVELS[level] >= LOG_LEVELS[cfg.level];
  };

  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog('debug')) {
        console.debug(`[${cfg.prefix}] ${message}`, data ?? '');
      }
    },
    info: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog('info')) {
        console.info(`[${cfg.prefix}] ${message}`, data ?? '');
      }
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      if (shouldLog('warn')) {
        console.warn(`[${cfg.prefix}] ${message}`, data ?? '');
      }
    },
    error: (message: string, error?: unknown) => {
      if (shouldLog('error')) {
        console.error(`[${cfg.prefix}] ${message}`, error ?? '');
      }
    },
  };
}

// ============================================================================
// Secure Memory Cleanup
// ============================================================================

/**
 * Securely zero out a Uint8Array (for secret keys)
 * Uses crypto.getRandomValues for additional security before zeroing
 */
export function secureZero(buffer: Uint8Array): void {
  if (!buffer || buffer.length === 0) return;

  // Overwrite with random data first (defense against memory inspection)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buffer);
  }

  // Then zero out
  buffer.fill(0);
}

/**
 * Securely cleanup an ephemeral keypair
 */
export function secureCleanupKeypair(keypair: { secretKey: Uint8Array }): void {
  if (keypair?.secretKey) {
    secureZero(keypair.secretKey);
  }
}

/**
 * Wrapper that ensures cleanup on completion or error
 */
export async function withSecureCleanup<T>(
  secretKey: Uint8Array,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } finally {
    secureZero(secretKey);
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelayMs?: number;
  /** Jitter factor 0-1 (default: 0.1) */
  jitter?: number;
  /** AbortSignal to cancel retries */
  signal?: AbortSignal;
  /** Custom retry condition */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback on each retry */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Default retry condition - retry on transient network errors
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('502')
    );
  }
  return false;
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    jitter = 0.1,
    signal,
    shouldRetry = isRetryableError,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check for abort
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt or non-retryable errors
      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitterAmount = exponentialDelay * jitter * Math.random();
      const delay = Math.min(exponentialDelay + jitterAmount, maxDelayMs);

      onRetry?.(error, attempt + 1, delay);

      // Wait before retry
      await sleep(delay, signal);
    }
  }

  throw lastError;
}

// ============================================================================
// Abort & Timeout
// ============================================================================

/**
 * Sleep with abort support
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Operation aborted'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new Error('Operation aborted'));
    });
  });
}

/**
 * Create an AbortSignal that times out after specified ms
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Combine multiple AbortSignals into one
 */
export function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal?.aborted) {
      controller.abort();
      break;
    }
    signal?.addEventListener('abort', () => controller.abort());
  }

  return controller.signal;
}

/**
 * Execute with timeout using Promise.race
 * Works with any async function, regardless of whether it respects AbortSignal
 */
export async function withTimeout<T>(
  fn: ((signal: AbortSignal) => Promise<T>) | (() => Promise<T>),
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const combinedSignal = signal ? combineSignals(signal, controller.signal) : controller.signal;

  // Create timeout promise that rejects
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Clean up timeout if signal is already aborted
    if (signal?.aborted) {
      clearTimeout(timeoutId);
      reject(new Error('Operation aborted'));
    }

    // Listen for external abort
    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new Error('Operation aborted'));
    });
  });

  // Race between the function and timeout
  try {
    return await Promise.race([
      fn(combinedSignal),
      timeoutPromise,
    ]);
  } catch (error) {
    // Ensure controller is aborted on any error
    controller.abort();
    throw error;
  }
}

// ============================================================================
// Fee Estimation
// ============================================================================

export interface FeeEstimate {
  /** Base transaction fee in lamports */
  baseFee: number;
  /** Priority fee in lamports (for faster confirmation) */
  priorityFee: number;
  /** Total fee in lamports */
  totalFee: number;
  /** Total fee in SOL */
  totalFeeSol: number;
}

const LAMPORTS_PER_SOL = 1_000_000_000;
const DEFAULT_BASE_FEE = 5000; // 5000 lamports
const DEFAULT_PRIORITY_FEE = 10000; // 10000 lamports for moderate priority

/**
 * Estimate transaction fees dynamically
 */
export async function estimateFees(
  connection: Connection,
  options: {
    priorityLevel?: 'low' | 'medium' | 'high';
    signal?: AbortSignal;
  } = {}
): Promise<FeeEstimate> {
  const { priorityLevel = 'medium' } = options;

  let baseFee = DEFAULT_BASE_FEE;
  let priorityFee = DEFAULT_PRIORITY_FEE;

  try {
    // Get recent prioritization fees
    const recentFees = await connection.getRecentPrioritizationFees();

    if (recentFees.length > 0) {
      // Calculate median priority fee
      const sortedFees = recentFees
        .map(f => f.prioritizationFee)
        .sort((a, b) => a - b);
      const medianFee = sortedFees[Math.floor(sortedFees.length / 2)];

      // Adjust based on priority level
      const multipliers = { low: 0.5, medium: 1.0, high: 2.0 };
      priorityFee = Math.max(
        DEFAULT_PRIORITY_FEE,
        Math.floor(medianFee * multipliers[priorityLevel])
      );
    }
  } catch {
    // Use defaults if fee estimation fails
  }

  const totalFee = baseFee + priorityFee;

  return {
    baseFee,
    priorityFee,
    totalFee,
    totalFeeSol: totalFee / LAMPORTS_PER_SOL,
  };
}

/**
 * Calculate required funding amount including fees
 */
export async function calculateFundingAmount(
  connection: Connection,
  baseAmount: number,
  options: {
    includePrivacyCashFees?: boolean;
    priorityLevel?: 'low' | 'medium' | 'high';
  } = {}
): Promise<{
  baseAmount: number;
  estimatedFees: number;
  totalRequired: number;
}> {
  const { includePrivacyCashFees = true, priorityLevel = 'medium' } = options;

  const feeEstimate = await estimateFees(connection, { priorityLevel });

  // Privacy Cash typically charges ~0.5% + fixed fee
  const privacyCashFee = includePrivacyCashFees
    ? baseAmount * 0.005 + 0.001 // 0.5% + 0.001 SOL
    : 0;

  // Add buffer for multiple transactions (deposit + withdraw)
  const txFees = feeEstimate.totalFeeSol * 3; // 3 transactions worst case

  const estimatedFees = privacyCashFee + txFees;
  const totalRequired = baseAmount + estimatedFees;

  return {
    baseAmount,
    estimatedFees,
    totalRequired,
  };
}

// ============================================================================
// Transaction Confirmation
// ============================================================================

export interface ConfirmationOptions {
  /** Commitment level (default: 'confirmed') */
  commitment?: Commitment;
  /** Timeout in ms (default: 60000) */
  timeoutMs?: number;
  /** Abort signal */
  signal?: AbortSignal;
  /** Poll interval in ms (default: 1000) */
  pollIntervalMs?: number;
}

/**
 * Confirm transaction with proper commitment and timeout
 */
export async function confirmTransaction(
  connection: Connection,
  signature: string,
  options: ConfirmationOptions = {}
): Promise<void> {
  const {
    commitment = 'confirmed',
    timeoutMs = 60000,
    signal,
    pollIntervalMs = 1000,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (signal?.aborted) {
      throw new Error('Transaction confirmation aborted');
    }

    const status = await connection.getSignatureStatus(signature);

    if (status.value?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
    }

    if (status.value?.confirmationStatus) {
      const confirmationLevels: Commitment[] = ['processed', 'confirmed', 'finalized'];
      const targetLevel = confirmationLevels.indexOf(commitment);
      const currentLevel = confirmationLevels.indexOf(status.value.confirmationStatus);

      if (currentLevel >= targetLevel) {
        return; // Transaction confirmed at desired level
      }
    }

    await sleep(pollIntervalMs, signal);
  }

  throw new Error(`Transaction confirmation timed out after ${timeoutMs}ms`);
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Create a resettable singleton factory
 */
export function createResettableSingleton<T>(
  factory: () => T | Promise<T>,
  cleanup?: (instance: T) => void | Promise<void>
) {
  let instance: T | null = null;
  let initPromise: Promise<T> | null = null;

  return {
    async get(): Promise<T> {
      if (instance) return instance;

      if (!initPromise) {
        initPromise = Promise.resolve(factory()).then(inst => {
          instance = inst;
          initPromise = null;
          return inst;
        });
      }

      return initPromise;
    },

    async reset(): Promise<void> {
      if (instance && cleanup) {
        await cleanup(instance);
      }
      instance = null;
      initPromise = null;
    },

    isInitialized(): boolean {
      return instance !== null;
    },
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Solana address format
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  // Base58 characters, 32-44 chars long
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validate amount is positive and reasonable
 */
export function isValidAmount(amount: number, maxAmount = 1_000_000): boolean {
  return (
    typeof amount === 'number' &&
    !isNaN(amount) &&
    amount > 0 &&
    amount <= maxAmount &&
    isFinite(amount)
  );
}

/**
 * Assert condition with custom error
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
