/**
 * Vouch Protocol - Shared Library
 *
 * Recommended usage:
 * ```typescript
 * import { proveDevReputation, proveWhaleTrading } from '@vouch/web/lib';
 *
 * // Privacy-enhanced proof flow (ShadowWire on mainnet)
 * const result = await proveDevReputation(input, { wallet, connection });
 * ```
 */

// === Recommended Entry Points ===
// These functions have ShadowWire privacy baked in (mainnet only)
export {
  proveDevReputation,
  proveWhaleTrading,
  isEnhancedPrivacyAvailable,
  estimateProveFlowCost,
  createFlowController,
  type ProveFlowOptions,
  type ProveFlowResult,
  type ProveFlowProgress,
  type ProveFlowStage,
  type ProveFlowCostEstimate,
} from './prove-flow';

// === Core Modules ===
export * from './types';
export * from './circuit';
export * from './proof';
export * from './verify';
export { cn } from './utils';

// === Connection Management ===
export * from './connection';

// === Privacy SDK (used internally by prove-flow) ===
export * from './shadowwire';

// === Private Airdrop Registry (Tiered Rewards) ===
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
} from './airdrop-registry';

// === Privacy Utilities (for advanced usage) ===
export {
  createLogger,
  withRetry,
  withTimeout,
  sleep,
  secureZero,
  secureCleanupKeypair,
  isValidSolanaAddress,
  isValidAmount,
  type LogLevel,
  type RetryOptions,
} from './privacy-utils';
