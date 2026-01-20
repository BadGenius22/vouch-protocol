/**
 * Vouch Protocol SDK
 *
 * Privacy infrastructure for Solana. Verify user credentials without revealing identity.
 *
 * @example
 * ```typescript
 * import { proveDevReputation, proveWhaleTrading } from '@vouch-protocol/sdk';
 *
 * // Prove developer reputation (TVL) anonymously
 * const result = await proveDevReputation(input, { wallet, connection });
 *
 * // Prove whale trading volume anonymously
 * const result = await proveWhaleTrading(input, { wallet, connection });
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// High-Level API (Recommended)
// ============================================================================

/**
 * Prove developer reputation anonymously using zero-knowledge proofs.
 *
 * This is the recommended entry point for verifying developer credentials.
 * It handles the full flow: proof generation, optional privacy shielding,
 * and on-chain verification.
 *
 * @param input - Developer credentials to prove
 * @param input.walletPubkey - Solana wallet address (base58)
 * @param input.programs - Array of deployed programs with TVL data
 * @param input.minTvl - Minimum TVL threshold to prove (in USD)
 * @param options - Configuration options
 * @param options.wallet - Connected wallet from @solana/wallet-adapter-react
 * @param options.connection - Solana RPC connection
 * @param options.onProgress - Optional callback for progress updates
 * @param options.skipPrivacy - Skip ShadowWire privacy layer (default: false)
 * @param options.signal - AbortSignal for cancellation
 * @returns Promise resolving to verification result with proof and transaction signature
 *
 * @example
 * ```typescript
 * import { proveDevReputation } from '@vouch-protocol/sdk';
 *
 * const result = await proveDevReputation({
 *   walletPubkey: wallet.publicKey.toBase58(),
 *   programs: deployedPrograms,
 *   minTvl: 10000,
 * }, {
 *   wallet,
 *   connection,
 *   onProgress: (p) => console.log(`${p.stage}: ${p.percentage}%`),
 * });
 *
 * if (result.success) {
 *   console.log('Verified!', result.verification?.signature);
 * }
 * ```
 *
 * @throws {VouchError} When verification fails with specific error code
 */
export { proveDevReputation } from '@vouch/web/lib';

/**
 * Prove whale trading volume anonymously using zero-knowledge proofs.
 *
 * Verifies that a wallet has traded above a minimum volume threshold
 * without revealing the wallet address or exact trading amounts.
 *
 * @param input - Trading data to prove
 * @param input.walletPubkey - Solana wallet address (base58)
 * @param input.tradingData - Trading history with volumes
 * @param input.minVolume - Minimum trading volume threshold (in USD)
 * @param options - Configuration options (same as proveDevReputation)
 * @returns Promise resolving to verification result
 *
 * @example
 * ```typescript
 * import { proveWhaleTrading } from '@vouch-protocol/sdk';
 *
 * const result = await proveWhaleTrading({
 *   walletPubkey: wallet.publicKey.toBase58(),
 *   tradingData: {
 *     totalVolume: 150000,
 *     tradeCount: 42,
 *     amounts: tradeAmounts,
 *     period: 30,
 *     wallet: walletAddress,
 *   },
 *   minVolume: 100000,
 * }, { wallet, connection });
 * ```
 *
 * @throws {VouchError} When verification fails
 */
export { proveWhaleTrading } from '@vouch/web/lib';

/**
 * Check if enhanced privacy (ShadowWire) is available on current network.
 *
 * @returns Promise<boolean> - true if ShadowWire is available (mainnet only)
 */
export { isEnhancedPrivacyAvailable } from '@vouch/web/lib';

/**
 * Estimate the total cost of a verification flow in SOL.
 *
 * @param connection - Solana RPC connection
 * @param skipPrivacy - Whether to skip ShadowWire costs
 * @returns Cost breakdown including rent, transaction fees, and privacy fees
 */
export { estimateProveFlowCost } from '@vouch/web/lib';

/**
 * Create an AbortController-like object for cancelling verification flows.
 *
 * @returns Controller with signal and abort() method
 */
export { createFlowController } from '@vouch/web/lib';

export {
  type ProveFlowOptions,
  type ProveFlowResult,
  type ProveFlowProgress,
  type ProveFlowStage,
  type ProveFlowCostEstimate,
} from '@vouch/web/lib';

// ============================================================================
// Core Proof Functions
// ============================================================================

/**
 * Generate a developer reputation ZK proof in the browser.
 *
 * This is a lower-level function that only generates the proof without
 * submitting it on-chain. Use `proveDevReputation` for the full flow.
 *
 * The proof runs entirely client-side using WASM - private data never
 * leaves the browser.
 *
 * @param input - Developer credentials
 * @param onProgress - Optional progress callback (proof generation can take 15-30s)
 * @returns ProofResult containing proof bytes, nullifier, and commitment
 *
 * @example
 * ```typescript
 * import { generateDevReputationProof } from '@vouch-protocol/sdk';
 *
 * const proof = await generateDevReputationProof({
 *   walletPubkey,
 *   programs,
 *   minTvl: 10000,
 * }, (progress) => {
 *   console.log(`${progress.percentage}% - ${progress.message}`);
 * });
 * ```
 */
export { generateDevReputationProof } from '@vouch/web/lib';

/**
 * Generate a whale trading ZK proof in the browser.
 *
 * @param input - Trading data to prove
 * @param onProgress - Optional progress callback
 * @returns ProofResult containing proof bytes, nullifier, and commitment
 */
export { generateWhaleTradingProof } from '@vouch/web/lib';

/**
 * Verify a proof locally without submitting on-chain. Useful for testing.
 *
 * @param proof - The proof result to verify
 * @param circuitType - 'dev_reputation' or 'whale_trading'
 * @returns Promise<boolean> - true if proof is valid
 */
export { verifyProofLocally } from '@vouch/web/lib';

/** Serialize a ProofResult for storage or transmission */
export { serializeProofResult } from '@vouch/web/lib';

/** Deserialize a previously serialized ProofResult */
export { deserializeProofResult } from '@vouch/web/lib';

/** Get the size of a proof in bytes */
export { getProofSize } from '@vouch/web/lib';

// ============================================================================
// On-Chain Verification
// ============================================================================

/**
 * Submit a ZK proof to Solana for on-chain verification.
 *
 * This function creates and submits a transaction to the Vouch verifier program.
 * The proof is verified on-chain and the nullifier is marked as used.
 *
 * @param connection - Solana RPC connection
 * @param proof - The ProofResult from generateDevReputationProof or generateWhaleTradingProof
 * @param proofType - 'developer' or 'whale'
 * @param payer - Public key that pays for the transaction
 * @param signTransaction - Function to sign the transaction
 * @param recipient - Optional recipient public key (for airdrops)
 * @returns VerificationResult with transaction signature
 *
 * @example
 * ```typescript
 * import { submitProofToChain } from '@vouch-protocol/sdk';
 *
 * const result = await submitProofToChain(
 *   connection,
 *   proof,
 *   'developer',
 *   wallet.publicKey,
 *   wallet.signTransaction
 * );
 *
 * console.log('TX:', result.signature);
 * ```
 */
export { submitProofToChain } from '@vouch/web/lib';

/**
 * Check if a nullifier has already been used on-chain.
 *
 * Nullifiers prevent double-proving - each wallet can only verify once per proof type.
 * Call this before starting proof generation to provide better UX.
 *
 * @param connection - Solana RPC connection
 * @param nullifier - Hex-encoded nullifier string
 * @returns Promise<boolean> - true if nullifier is already used
 *
 * @example
 * ```typescript
 * const used = await isNullifierUsed(connection, proof.nullifier);
 * if (used) {
 *   console.log('Already verified!');
 * }
 * ```
 */
export { isNullifierUsed } from '@vouch/web/lib';

/**
 * Check if a commitment is registered on-chain.
 *
 * @param connection - Solana RPC connection
 * @param commitment - Hex-encoded commitment string
 * @returns Promise<boolean>
 */
export { isCommitmentRegistered } from '@vouch/web/lib';

/**
 * Run pre-verification checks before starting proof generation.
 *
 * Checks: wallet balance, nullifier status, program deployment.
 */
export { preVerificationChecks } from '@vouch/web/lib';
export { type PreVerificationResult } from '@vouch/web/lib';

/** Derive the PDA address for a nullifier account */
export { deriveNullifierPDA } from '@vouch/web/lib';

/** Derive the PDA address for a commitment account */
export { deriveCommitmentPDA } from '@vouch/web/lib';

/** Get the Anchor program instance for the verifier */
export { getVerifierProgram } from '@vouch/web/lib';

/** Check if the verifier program is deployed on the current network */
export { isProgramDeployed } from '@vouch/web/lib';

/** Estimate the cost of verification in lamports */
export { estimateVerificationCost } from '@vouch/web/lib';

// ============================================================================
// Types & Constants
// ============================================================================

// Input types
/** Input for developer reputation proof */
export { type DevReputationInput } from '@vouch/web/lib';
/** Input for whale trading proof */
export { type WhaleTradingInput } from '@vouch/web/lib';
/** Data about a deployed Solana program */
export { type ProgramData } from '@vouch/web/lib';
/** Data about a single trade */
export { type TradeData } from '@vouch/web/lib';
/** Aggregated trading volume data */
export { type TradingVolumeData } from '@vouch/web/lib';

// Result types
/** Result from proof generation containing proof bytes and nullifier */
export { type ProofResult } from '@vouch/web/lib';
/** Progress update during proof generation */
export { type ProofGenerationProgress } from '@vouch/web/lib';
/** Result from on-chain verification */
export { type VerificationResult } from '@vouch/web/lib';
/** JSON-serializable proof result for storage */
export { type SerializedProofResult } from '@vouch/web/lib';

// Enums
/** Proof type identifier: 'developer' | 'whale' */
export { type ProofType } from '@vouch/web/lib';
/** Circuit identifier: 'dev_reputation' | 'whale_trading' */
export { type CircuitType } from '@vouch/web/lib';

/**
 * Custom error class for Vouch Protocol errors.
 *
 * All SDK errors are wrapped in VouchError with a specific error code.
 * Use `instanceof VouchError` or `isVouchError()` to check.
 *
 * @example
 * ```typescript
 * import { VouchError, VouchErrorCode } from '@vouch-protocol/sdk';
 *
 * try {
 *   await proveDevReputation(input, options);
 * } catch (error) {
 *   if (error instanceof VouchError) {
 *     if (error.code === VouchErrorCode.THRESHOLD_NOT_MET) {
 *       console.log('TVL too low');
 *     }
 *   }
 * }
 * ```
 */
export { VouchError } from '@vouch/web/lib';

/**
 * Error codes for VouchError.
 *
 * - WALLET_NOT_CONNECTED: Wallet not connected
 * - WALLET_REJECTED: User rejected transaction
 * - PROOF_GENERATION_FAILED: ZK proof generation failed
 * - VERIFICATION_FAILED: On-chain verification failed
 * - CIRCUIT_LOAD_FAILED: Failed to load circuit WASM
 * - THRESHOLD_NOT_MET: TVL/volume below threshold
 * - NULLIFIER_ALREADY_USED: Already verified (double-spend attempt)
 * - INSUFFICIENT_FUNDS: Not enough SOL for fees
 * - NETWORK_ERROR: RPC connection error
 * - TRANSACTION_FAILED: Transaction failed to confirm
 */
export { VouchErrorCode } from '@vouch/web/lib';

/**
 * Type guard to check if an error is a VouchError.
 *
 * @param error - Any error value
 * @returns true if error is VouchError
 */
export { isVouchError } from '@vouch/web/lib';

/** Type guard to check if a value is a valid ProofResult */
export { isProofResult } from '@vouch/web/lib';

/** Constants related to circuit constraints and limits */
export { CIRCUIT_CONSTANTS } from '@vouch/web/lib';

/** Security-related constants (proof expiry, etc.) */
export { SECURITY_CONSTANTS } from '@vouch/web/lib';

// ============================================================================
// Circuit Management
// ============================================================================

export {
  // Circuit loading (for advanced usage)
  loadCircuit,
  preloadCircuits,
  clearCircuitCache,
  isCircuitCached,
} from '@vouch/web/lib';

// ============================================================================
// Private Airdrop Registry
// ============================================================================

export {
  // Types
  type AirdropCampaign,
  type CampaignStatus,
  type AirdropRegistration,
  type CreateCampaignParams,
  type RegisterForAirdropParams,
  type DistributionProgress,

  // PDA Derivation
  getCampaignPDA,
  getRegistrationPDA,
  getOpenRegistrationPDA,
  getNullifierPDA,
  generateCampaignId,
  generateCampaignIdAsync,

  // Instruction Builders
  buildCreateCampaignInstruction,
  buildRegisterForAirdropInstruction,
  buildRegisterForAirdropOpenInstruction,
  buildCloseRegistrationInstruction,
  buildMarkDistributedInstruction,
  buildCompleteCampaignInstruction,

  // High-Level Functions
  fetchCampaign,
  fetchCampaignRegistrations,
  isRegisteredForCampaign,
  isOpenRegisteredForCampaign,
  distributeAirdropPrivately,

  // Validation & Helpers
  validateCampaignParams,
  validateShadowWireAddress,
  calculateAirdropAmount,
} from '@vouch/web/lib';

// ============================================================================
// Privacy Utilities (Advanced)
// ============================================================================

export {
  // Logging
  createLogger,
  type LogLevel,

  // Retry utilities
  withRetry,
  withTimeout,
  sleep,
  type RetryOptions,

  // Secure cleanup
  secureZero,
  secureCleanupKeypair,

  // Validation
  isValidSolanaAddress,
  isValidAmount,
} from '@vouch/web/lib';

// ============================================================================
// ShadowWire Integration (Mainnet Privacy)
// ============================================================================

export {
  // Availability check
  isShadowWireAvailable,
  initializeShadowWire,

  // Privacy operations
  depositToShadow,
  withdrawFromShadow,
  privateTransfer,
  getShadowBalance,

  // Token utilities
  SUPPORTED_TOKENS,
  isSupportedToken,
  toSmallestUnit,
  fromSmallestUnit,
  type SupportedToken,
} from '@vouch/web/lib';

// ============================================================================
// Connection Management
// ============================================================================

export {
  createConnection,
  createHealthyConnection,
  createConnectionPool,
  getCurrentNetwork,
  getExplorerUrl,
  getSolscanUrl,
  checkRPCHealth,
  type NetworkType,
  type RPCHealthStatus,
} from '@vouch/web/lib';
