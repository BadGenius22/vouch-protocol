/**
 * Vouch Protocol - Shared Library
 *
 * Recommended usage:
 * ```typescript
 * import { proveDevReputation, proveWhaleTrading } from '@vouch/web/lib';
 *
 * // Privacy-enhanced proof flow (Privacy Cash baked in)
 * const result = await proveDevReputation(input, { wallet, connection });
 * ```
 */

// === Recommended Entry Points ===
// These functions have Privacy Cash baked in by default
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

// === Privacy SDKs (used internally by prove-flow) ===
export * from './privacy-cash';
export * from './shadowwire';

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
