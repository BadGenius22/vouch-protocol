/**
 * Vouch Protocol - Unified Proof Flow (Production-Hardened)
 *
 * Privacy-first proof generation with Privacy Cash baked in as default.
 * This is the recommended entry point for generating and submitting proofs.
 *
 * Features:
 * - Abort/cancellation support
 * - Configurable timeouts
 * - Automatic cleanup on error
 * - Progress tracking with stages
 *
 * Flow:
 * 1. Shield SOL via Privacy Cash (hides funding source)
 * 2. Generate ZK proof (hides wallet-to-credential link)
 * 3. Submit proof to Solana (verifies on-chain)
 * 4. Withdraw privately to recipient (breaks all on-chain traces)
 */

import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { Connection, Transaction } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

import type {
  DevReputationInput,
  WhaleTradingInput,
  ProofResult,
  VerificationResult,
  ProofType,
} from './types';
import { generateDevReputationProof, generateWhaleTradingProof } from './proof';
import { submitProofToChain } from './verify';
import {
  isVerifierAvailable,
  submitProofWithVerifier,
} from './verifier-client';
import {
  shieldForProof,
  withdrawPrivately,
  isPrivacyCashAvailable,
  cleanupEphemeralKeypair,
  type EphemeralKeypair,
} from './privacy-cash';
import {
  createLogger,
  withTimeout,
  createTimeoutSignal,
  combineSignals,
  estimateFees,
} from './privacy-utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Progress stages for the unified flow
 */
export type ProveFlowStage =
  | 'idle'
  | 'shielding'
  | 'generating-proof'
  | 'submitting'
  | 'withdrawing'
  | 'complete'
  | 'error';

/**
 * Progress callback for tracking flow stages
 */
export interface ProveFlowProgress {
  stage: ProveFlowStage;
  message: string;
  percentage: number;
}

export type ProveFlowProgressCallback = (progress: ProveFlowProgress) => void;

/**
 * Options for the unified proof flow
 */
export interface ProveFlowOptions {
  /** Connected wallet */
  wallet: WalletContextState;
  /** Solana connection */
  connection: Connection;
  /** Recipient address for credential (defaults to wallet) */
  recipient?: string;
  /** Amount of SOL to shield (default: 0.01) */
  shieldAmount?: number;
  /** Skip Privacy Cash even if available (not recommended) */
  skipPrivacyCash?: boolean;
  /** Use verifier service for production-grade verification (recommended) */
  useVerifierService?: boolean;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Timeout for entire flow in ms (default: 600000 = 10 min) */
  timeoutMs?: number;
  /** Progress callback */
  onProgress?: ProveFlowProgressCallback;
}

/**
 * Result of the unified proof flow
 */
export interface ProveFlowResult {
  success: boolean;
  /** ZK proof data */
  proof?: ProofResult;
  /** On-chain verification result */
  verification?: VerificationResult;
  /** Privacy Cash shield transaction */
  shieldTx?: string;
  /** Privacy Cash withdraw transaction */
  withdrawTx?: string;
  /** Whether Privacy Cash was used */
  privacyCashUsed: boolean;
  /** Whether verifier service was used */
  verifierServiceUsed: boolean;
  /** Error message if failed */
  error?: string;
  /** Stage where error occurred */
  errorStage?: ProveFlowStage;
  /** Cleanup function (call to cleanup ephemeral keys) */
  cleanup: () => void;
}

// ============================================================================
// Constants & Logger
// ============================================================================

const DEFAULT_SHIELD_AMOUNT = 0.01; // 0.01 SOL
const DEFAULT_TIMEOUT_MS = 600000; // 10 minutes for entire flow

const logger = createLogger('ProveFlow');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to report progress
 */
function reportProgress(
  callback: ProveFlowProgressCallback | undefined,
  stage: ProveFlowStage,
  message: string,
  percentage: number
): void {
  callback?.({ stage, message, percentage });
  logger.debug(`${stage}: ${message} (${percentage}%)`);
}

/**
 * Check if operation was aborted
 */
function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Operation cancelled');
  }
}

// ============================================================================
// Main Flow Functions
// ============================================================================

/**
 * Prove Developer Reputation with Privacy Cash (default flow)
 *
 * Complete privacy-enhanced flow:
 * 1. Shield SOL (hide funding source)
 * 2. Generate ZK proof (prove TVL without revealing wallet)
 * 3. Submit to chain (verify on-chain)
 * 4. Withdraw privately (break traces)
 */
export async function proveDevReputation(
  input: DevReputationInput,
  options: ProveFlowOptions
): Promise<ProveFlowResult> {
  return executeProveFlow('developer', input, options, generateDevReputationProof);
}

/**
 * Prove Whale Trading with Privacy Cash (default flow)
 *
 * Complete privacy-enhanced flow:
 * 1. Shield SOL (hide funding source)
 * 2. Generate ZK proof (prove trading volume without revealing wallet)
 * 3. Submit to chain (verify on-chain)
 * 4. Withdraw privately (break traces)
 */
export async function proveWhaleTrading(
  input: WhaleTradingInput,
  options: ProveFlowOptions
): Promise<ProveFlowResult> {
  return executeProveFlow('whale', input, options, generateWhaleTradingProof);
}

/**
 * Generic proof flow executor
 */
async function executeProveFlow<T>(
  proofType: ProofType,
  input: T,
  options: ProveFlowOptions,
  generateProof: (input: T) => Promise<ProofResult>
): Promise<ProveFlowResult> {
  const {
    wallet,
    connection,
    recipient,
    shieldAmount = DEFAULT_SHIELD_AMOUNT,
    skipPrivacyCash = false,
    useVerifierService = true,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onProgress,
  } = options;

  // Create combined signal with timeout
  const timeoutSignal = createTimeoutSignal(timeoutMs);
  const combinedSignal = signal ? combineSignals(signal, timeoutSignal) : timeoutSignal;

  let shieldTx: string | undefined;
  let withdrawTx: string | undefined;
  let privacyCashUsed = false;
  let verifierServiceUsed = false;
  let ephemeralKeypair: EphemeralKeypair | undefined;
  let shieldCleanup: (() => void) | undefined;

  // Cleanup function to ensure ephemeral keys are zeroed
  const cleanup = () => {
    if (shieldCleanup) {
      shieldCleanup();
    } else if (ephemeralKeypair && !ephemeralKeypair._used) {
      cleanupEphemeralKeypair(ephemeralKeypair);
    }
  };

  try {
    // Validate wallet
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    checkAborted(combinedSignal);

    const recipientPubkey = recipient ? new PublicKey(recipient) : wallet.publicKey;

    // Step 1: Shield SOL (if Privacy Cash available)
    if (!skipPrivacyCash) {
      checkAborted(combinedSignal);

      const privacyCashAvailable = await isPrivacyCashAvailable();

      if (privacyCashAvailable) {
        reportProgress(onProgress, 'shielding', 'Shielding SOL for privacy...', 10);

        try {
          const shieldResult = await shieldForProof(connection, wallet, shieldAmount, {
            signal: combinedSignal,
            timeoutMs: 180000, // 3 min for shield
          });

          shieldTx = shieldResult.depositTx;
          ephemeralKeypair = shieldResult.ephemeralKeypair;
          shieldCleanup = shieldResult.cleanup;
          privacyCashUsed = true;

          reportProgress(onProgress, 'shielding', 'SOL shielded successfully', 20);
        } catch (shieldError) {
          // Log but continue - Privacy Cash is enhancement, not requirement
          logger.warn('Privacy Cash shield failed, continuing without', {
            error: shieldError instanceof Error ? shieldError.message : String(shieldError),
          });
          reportProgress(onProgress, 'shielding', 'Privacy Cash unavailable, continuing...', 20);
        }
      } else {
        reportProgress(onProgress, 'shielding', 'Privacy Cash not available, skipping...', 20);
      }
    } else {
      reportProgress(onProgress, 'shielding', 'Privacy Cash skipped by request', 20);
    }

    checkAborted(combinedSignal);

    // Step 2: Generate ZK proof
    reportProgress(onProgress, 'generating-proof', 'Generating zero-knowledge proof...', 30);

    const proof = await generateProof(input);

    reportProgress(onProgress, 'generating-proof', 'Proof generated successfully', 50);

    checkAborted(combinedSignal);

    // Step 3: Submit to chain (use verifier service if available and enabled)
    reportProgress(onProgress, 'submitting', 'Submitting proof to Solana...', 60);

    let verification: VerificationResult;

    // Check if verifier service should be used
    const shouldUseVerifier = useVerifierService && (await isVerifierAvailable());

    if (shouldUseVerifier) {
      logger.info('Using verifier service for production verification');
      reportProgress(onProgress, 'submitting', 'Verifying with secure verifier service...', 65);

      verification = await submitProofWithVerifier(
        connection,
        proof,
        proofType,
        wallet.publicKey,
        wallet.signTransaction.bind(wallet) as (tx: Transaction) => Promise<Transaction>,
        recipientPubkey
      );
      verifierServiceUsed = true;
    } else {
      logger.info('Using direct on-chain verification (development mode)');
      verification = await submitProofToChain(
        connection,
        proof,
        proofType,
        wallet.publicKey,
        wallet.signTransaction.bind(wallet) as (tx: Transaction) => Promise<Transaction>,
        recipientPubkey
      );
    }

    if (!verification.success) {
      return {
        success: false,
        proof,
        verification,
        shieldTx,
        privacyCashUsed,
        verifierServiceUsed,
        error: verification.error || 'Verification failed',
        errorStage: 'submitting',
        cleanup,
      };
    }

    reportProgress(onProgress, 'submitting', 'Proof verified on-chain', 80);

    checkAborted(combinedSignal);

    // Step 4: Withdraw privately (if Privacy Cash was used and we have ephemeral keypair)
    if (
      privacyCashUsed &&
      ephemeralKeypair &&
      recipient &&
      recipient !== wallet.publicKey.toBase58()
    ) {
      reportProgress(onProgress, 'withdrawing', 'Withdrawing privately...', 85);

      try {
        const withdrawResult = await withdrawPrivately(ephemeralKeypair, recipient, shieldAmount, {
          signal: combinedSignal,
          timeoutMs: 120000, // 2 min for withdraw
          autoCleanup: true, // Auto cleanup after withdraw
        });
        withdrawTx = withdrawResult.tx;
        ephemeralKeypair = undefined; // Mark as cleaned up
        shieldCleanup = undefined;
        reportProgress(onProgress, 'withdrawing', 'Private withdrawal complete', 95);
      } catch (withdrawError) {
        // Log but don't fail - main proof is already verified
        logger.warn('Private withdrawal failed', {
          error: withdrawError instanceof Error ? withdrawError.message : String(withdrawError),
        });
        reportProgress(onProgress, 'withdrawing', 'Withdrawal skipped (can retry later)', 95);
      }
    }

    // Complete
    reportProgress(onProgress, 'complete', 'Proof flow complete!', 100);

    // Cleanup any remaining ephemeral keys
    cleanup();

    return {
      success: true,
      proof,
      verification,
      shieldTx,
      withdrawTx,
      privacyCashUsed,
      verifierServiceUsed,
      cleanup: () => {}, // Already cleaned up
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAborted = errorMessage === 'Operation cancelled' || errorMessage.includes('timed out');

    logger.error('Proof flow failed', error);
    reportProgress(onProgress, 'error', errorMessage, 0);

    // Always cleanup on error
    cleanup();

    return {
      success: false,
      shieldTx,
      withdrawTx,
      privacyCashUsed,
      verifierServiceUsed,
      error: isAborted ? 'Operation cancelled or timed out' : errorMessage,
      errorStage: 'generating-proof',
      cleanup: () => {}, // Already cleaned up
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if enhanced privacy flow is available
 * Returns true if Privacy Cash SDK is installed and working
 */
export async function isEnhancedPrivacyAvailable(): Promise<boolean> {
  return isPrivacyCashAvailable();
}

/**
 * Check if production verification (verifier service) is available
 * Returns true if the ZK verifier service is running and healthy
 */
export async function isProductionVerificationAvailable(): Promise<boolean> {
  return isVerifierAvailable();
}

/**
 * Estimate costs for the proof flow
 */
export interface ProveFlowCostEstimate {
  /** Base verification cost (SOL) */
  verificationCost: number;
  /** Privacy Cash shield/withdraw cost if used (SOL) */
  privacyCashCost: number;
  /** Network fee estimate (SOL) */
  networkFees: number;
  /** Total estimated cost (SOL) */
  totalCost: number;
  /** Whether Privacy Cash will be used */
  willUsePrivacyCash: boolean;
}

export async function estimateProveFlowCost(
  connection: Connection,
  skipPrivacyCash = false
): Promise<ProveFlowCostEstimate> {
  // Base verification cost (rent + tx fees)
  const verificationCost = 0.003; // ~0.003 SOL for nullifier account + fees

  // Get dynamic network fees
  const feeEstimate = await estimateFees(connection, { priorityLevel: 'medium' });
  const networkFees = feeEstimate.totalFeeSol * 3; // Estimate for 3 transactions

  // Privacy Cash cost (if available)
  let privacyCashCost = 0;
  let willUsePrivacyCash = false;

  if (!skipPrivacyCash) {
    willUsePrivacyCash = await isPrivacyCashAvailable();
    if (willUsePrivacyCash) {
      privacyCashCost = 0.002; // ~0.002 SOL for shield + withdraw fees
    }
  }

  return {
    verificationCost,
    privacyCashCost,
    networkFees,
    totalCost: verificationCost + privacyCashCost + networkFees,
    willUsePrivacyCash,
  };
}

/**
 * Create an AbortController for managing flow cancellation
 */
export function createFlowController(): {
  signal: AbortSignal;
  abort: () => void;
} {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
  };
}
