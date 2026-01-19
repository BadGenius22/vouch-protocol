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

export {
  // Main entry points - privacy-enhanced proof generation
  proveDevReputation,
  proveWhaleTrading,

  // Flow utilities
  isEnhancedPrivacyAvailable,
  estimateProveFlowCost,
  createFlowController,

  // Types
  type ProveFlowOptions,
  type ProveFlowResult,
  type ProveFlowProgress,
  type ProveFlowStage,
  type ProveFlowCostEstimate,
} from '@vouch/web/lib';

// ============================================================================
// Core Proof Functions
// ============================================================================

export {
  // Proof generation (runs in browser)
  generateDevReputationProof,
  generateWhaleTradingProof,

  // Local verification (for testing)
  verifyProofLocally,

  // Proof utilities
  serializeProofResult,
  deserializeProofResult,
  getProofSize,
} from '@vouch/web/lib';

// ============================================================================
// On-Chain Verification
// ============================================================================

export {
  // Submit proof to Solana
  submitProofToChain,

  // Check nullifier status (prevent double-use)
  isNullifierUsed,
  isCommitmentRegistered,

  // Pre-verification checks
  preVerificationChecks,
  type PreVerificationResult,

  // PDA derivation
  deriveNullifierPDA,
  deriveCommitmentPDA,

  // Program info
  getVerifierProgram,
  isProgramDeployed,

  // Cost estimation
  estimateVerificationCost,
} from '@vouch/web/lib';

// ============================================================================
// Types & Constants
// ============================================================================

export {
  // Input types
  type DevReputationInput,
  type WhaleTradingInput,
  type ProgramData,
  type TradeData,
  type TradingVolumeData,

  // Result types
  type ProofResult,
  type ProofGenerationProgress,
  type VerificationResult,
  type SerializedProofResult,

  // Enums
  type ProofType,
  type CircuitType,

  // Error handling
  VouchError,
  VouchErrorCode,
  isVouchError,
  isProofResult,

  // Constants
  CIRCUIT_CONSTANTS,
  SECURITY_CONSTANTS,
} from '@vouch/web/lib';

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
