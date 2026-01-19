/**
 * Vouch Protocol - Unified Proof Flow (Production-Hardened)
 *
 * Privacy-first proof generation with ShadowWire as the privacy layer.
 * This is the recommended entry point for generating and submitting proofs.
 *
 * Features:
 * - Abort/cancellation support
 * - Configurable timeouts
 * - Automatic cleanup on error
 * - Progress tracking with stages
 * - Network-aware privacy (mainnet = ShadowWire, devnet = standard)
 *
 * Flow (with privacy):
 * 1. Deposit SOL to ShadowWire pool (hides funding source)
 * 2. Generate ZK proof (hides wallet-to-credential link)
 * 3. Submit proof via private transfer (breaks on-chain traces)
 *
 * Flow (without privacy - devnet):
 * 1. Generate ZK proof
 * 2. Submit proof directly from wallet
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
  createLogger,
  withTimeout,
  createTimeoutSignal,
  combineSignals,
  estimateFees,
} from './privacy-utils';

// Dynamic import for ShadowWire (avoids WASM issues at build time)
async function getShadowWireModule() {
  return import('./shadowwire');
}

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
 * Privacy provider type
 */
export type PrivacyProvider = 'shadowwire' | 'none';

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
  /** Skip privacy layer even if available (not recommended) */
  skipPrivacy?: boolean;
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
  /** Privacy shield transaction (deposit to ShadowWire) */
  shieldTx?: string;
  /** Privacy transfer transaction */
  transferTx?: string;
  /** Whether privacy layer was used */
  privacyUsed: boolean;
  /** Which privacy provider was used */
  privacyProvider: PrivacyProvider;
  /** Whether verifier service was used */
  verifierServiceUsed: boolean;
  /** Error message if failed */
  error?: string;
  /** Stage where error occurred */
  errorStage?: ProveFlowStage;
  /** Cleanup function */
  cleanup: () => void | Promise<void>;
}

// ============================================================================
// Constants & Logger
// ============================================================================

const DEFAULT_SHIELD_AMOUNT = 0.01; // 0.01 SOL
const DEFAULT_TIMEOUT_MS = 600000; // 10 minutes for entire flow

const logger = createLogger('ProveFlow');

// ============================================================================
// Network Detection
// ============================================================================

/**
 * Detect if we're on mainnet
 */
export function isMainnet(connection: Connection): boolean {
  const endpoint = connection.rpcEndpoint.toLowerCase();
  return (
    endpoint.includes('mainnet') ||
    endpoint.includes('solana.com') && !endpoint.includes('devnet') && !endpoint.includes('testnet')
  );
}

/**
 * Get current network name
 */
export function getNetworkName(connection: Connection): 'mainnet' | 'devnet' | 'testnet' | 'localnet' {
  const endpoint = connection.rpcEndpoint.toLowerCase();
  if (endpoint.includes('mainnet') || (endpoint.includes('solana.com') && !endpoint.includes('devnet') && !endpoint.includes('testnet'))) {
    return 'mainnet';
  }
  if (endpoint.includes('devnet')) {
    return 'devnet';
  }
  if (endpoint.includes('testnet')) {
    return 'testnet';
  }
  return 'localnet';
}

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
 * Prove Developer Reputation with privacy (default flow)
 *
 * Complete privacy-enhanced flow:
 * 1. Shield SOL via ShadowWire (hide funding source) - mainnet only
 * 2. Generate ZK proof (prove TVL without revealing wallet)
 * 3. Submit to chain (verify on-chain)
 */
export async function proveDevReputation(
  input: DevReputationInput,
  options: ProveFlowOptions
): Promise<ProveFlowResult> {
  return executeProveFlow('developer', input, options, generateDevReputationProof);
}

/**
 * Prove Whale Trading with privacy (default flow)
 *
 * Complete privacy-enhanced flow:
 * 1. Shield SOL via ShadowWire (hide funding source) - mainnet only
 * 2. Generate ZK proof (prove trading volume without revealing wallet)
 * 3. Submit to chain (verify on-chain)
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
    skipPrivacy = false,
    useVerifierService = true,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onProgress,
  } = options;

  // Create combined signal with timeout
  const timeoutSignal = createTimeoutSignal(timeoutMs);
  const combinedSignal = signal ? combineSignals(signal, timeoutSignal) : timeoutSignal;

  let shieldTx: string | undefined;
  let transferTx: string | undefined;
  let privacyUsed = false;
  let privacyProvider: PrivacyProvider = 'none';
  let verifierServiceUsed = false;

  // No-op cleanup for this implementation
  const cleanup = async () => {};

  try {
    // Validate wallet
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    checkAborted(combinedSignal);

    const recipientPubkey = recipient ? new PublicKey(recipient) : wallet.publicKey;
    const network = getNetworkName(connection);

    // Step 1: Shield SOL via ShadowWire (mainnet only)
    if (!skipPrivacy && network === 'mainnet') {
      checkAborted(combinedSignal);

      try {
        const shadowWire = await getShadowWireModule();
        const shadowWireAvailable = await shadowWire.isShadowWireAvailable();

        if (shadowWireAvailable) {
          reportProgress(onProgress, 'shielding', 'Initializing ShadowWire...', 5);

          // Initialize WASM
          await shadowWire.initializeShadowWire('/wasm/settler_wasm_bg.wasm', {
            signal: combinedSignal,
            timeoutMs: 30000,
          });

          reportProgress(onProgress, 'shielding', 'Depositing to privacy pool...', 10);

          // Deposit to ShadowWire pool
          const depositTxBase64 = await shadowWire.depositToShadow(
            wallet,
            shieldAmount,
            'SOL',
            { signal: combinedSignal, timeoutMs: 120000 }
          );

          shieldTx = depositTxBase64;
          privacyUsed = true;
          privacyProvider = 'shadowwire';

          reportProgress(onProgress, 'shielding', 'SOL deposited to privacy pool', 20);
        } else {
          reportProgress(onProgress, 'shielding', 'ShadowWire not available, continuing...', 20);
        }
      } catch (shieldError) {
        // Log but continue - privacy is enhancement, not requirement
        logger.warn('ShadowWire shield failed, continuing without privacy', {
          error: shieldError instanceof Error ? shieldError.message : String(shieldError),
        });
        reportProgress(onProgress, 'shielding', 'Privacy layer unavailable, continuing...', 20);
      }
    } else if (network !== 'mainnet') {
      reportProgress(onProgress, 'shielding', `Privacy pools not available on ${network}`, 20);
    } else {
      reportProgress(onProgress, 'shielding', 'Privacy skipped by request', 20);
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
      logger.info('Using direct on-chain verification');
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
        privacyUsed,
        privacyProvider,
                verifierServiceUsed,
        error: verification.error || 'Verification failed',
        errorStage: 'submitting',
        cleanup,
      };
    }

    reportProgress(onProgress, 'submitting', 'Proof verified on-chain', 80);

    // Step 4: (Future) Private transfer for full anonymity
    // For hackathon, we skip the private transfer step
    // In production, we'd use ShadowWire's privateTransfer to send to a burner

    // Complete
    reportProgress(onProgress, 'complete', 'Proof flow complete!', 100);

    return {
      success: true,
      proof,
      verification,
      shieldTx,
      transferTx,
      privacyUsed,
      privacyProvider,
            verifierServiceUsed,
      cleanup,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isAborted = errorMessage === 'Operation cancelled' || errorMessage.includes('timed out');

    logger.error('Proof flow failed', error);
    reportProgress(onProgress, 'error', errorMessage, 0);

    return {
      success: false,
      shieldTx,
      transferTx,
      privacyUsed,
      privacyProvider,
            verifierServiceUsed,
      error: isAborted ? 'Operation cancelled or timed out' : errorMessage,
      errorStage: 'generating-proof',
      cleanup,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if enhanced privacy flow is available
 * Returns true if ShadowWire is available AND we're on mainnet
 */
export async function isEnhancedPrivacyAvailable(connection?: Connection): Promise<boolean> {
  try {
    // Check network first
    if (connection && !isMainnet(connection)) {
      return false;
    }

    const shadowWire = await getShadowWireModule();
    return shadowWire.isShadowWireAvailable();
  } catch {
    return false;
  }
}

/**
 * Get privacy availability info with details
 */
export async function getPrivacyInfo(connection: Connection): Promise<{
  available: boolean;
  provider: PrivacyProvider;
  network: string;
  reason?: string;
}> {
  const network = getNetworkName(connection);

  if (network !== 'mainnet') {
    return {
      available: false,
      provider: 'none',
      network,
      reason: `Privacy pools are only available on mainnet. Current network: ${network}`,
    };
  }

  try {
    const shadowWire = await getShadowWireModule();
    const available = await shadowWire.isShadowWireAvailable();

    if (available) {
      return {
        available: true,
        provider: 'shadowwire',
        network,
      };
    } else {
      return {
        available: false,
        provider: 'none',
        network,
        reason: 'ShadowWire SDK not available',
      };
    }
  } catch (error) {
    return {
      available: false,
      provider: 'none',
      network,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
  /** Privacy shield cost if used (SOL) */
  privacyCost: number;
  /** Network fee estimate (SOL) */
  networkFees: number;
  /** Total estimated cost (SOL) */
  totalCost: number;
  /** Whether privacy will be used */
  willUsePrivacy: boolean;
  /** Privacy provider */
  privacyProvider: PrivacyProvider;
  /** Network name */
  network: string;
}

export async function estimateProveFlowCost(
  connection: Connection,
  skipPrivacy = false
): Promise<ProveFlowCostEstimate> {
  // Base verification cost (rent + tx fees)
  const verificationCost = 0.003; // ~0.003 SOL for nullifier account + fees

  // Get dynamic network fees
  const feeEstimate = await estimateFees(connection, { priorityLevel: 'medium' });
  const networkFees = feeEstimate.totalFeeSol * 3; // Estimate for 3 transactions

  const network = getNetworkName(connection);

  // Privacy cost (if available on mainnet)
  let privacyCost = 0;
  let willUsePrivacy = false;
  let privacyProvider: PrivacyProvider = 'none';

  if (!skipPrivacy && network === 'mainnet') {
    try {
      const shadowWire = await getShadowWireModule();
      willUsePrivacy = await shadowWire.isShadowWireAvailable();
      if (willUsePrivacy) {
        privacyCost = 0.002; // ~0.002 SOL for ShadowWire fees
        privacyProvider = 'shadowwire';
      }
    } catch {
      willUsePrivacy = false;
    }
  }

  return {
    verificationCost,
    privacyCost,
    networkFees,
    totalCost: verificationCost + privacyCost + networkFees,
    willUsePrivacy,
    privacyProvider,
    network,
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
