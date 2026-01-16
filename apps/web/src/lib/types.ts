/**
 * Vouch Protocol - Shared Types
 * All TypeScript type definitions for the protocol
 */

// === Circuit Constants ===
// These must match the values in the Noir circuits

export const CIRCUIT_CONSTANTS = {
  /** Maximum number of programs for dev reputation proof */
  MAX_PROGRAMS: 5,
  /** Maximum number of trades for whale trading proof */
  MAX_TRADES: 20,
  /** Domain separator for developer proof nullifier derivation */
  DOMAIN_SEPARATOR_DEV: 'vouch_dev',
  /** Domain separator for whale proof nullifier derivation */
  DOMAIN_SEPARATOR_WHALE: 'vouch_whale',
  /** Hash function used in circuits (blake2s produces 32-byte output) */
  HASH_OUTPUT_SIZE: 32,
  /** Wallet pubkey size in bytes */
  WALLET_PUBKEY_SIZE: 32,
  /** Secret size in bytes */
  SECRET_SIZE: 32,
} as const;

// === Security Constants ===

export const SECURITY_CONSTANTS = {
  /** Default proof TTL in milliseconds (5 minutes) */
  DEFAULT_PROOF_TTL_MS: 5 * 60 * 1000,
  /** Maximum proof TTL in milliseconds (30 minutes) */
  MAX_PROOF_TTL_MS: 30 * 60 * 1000,
  /** Minimum proof TTL in milliseconds (1 minute) */
  MIN_PROOF_TTL_MS: 60 * 1000,
  /** Maximum proof size in bytes */
  MAX_PROOF_SIZE_BYTES: 4096,
  /** Maximum public inputs size in bytes */
  MAX_PUBLIC_INPUTS_SIZE_BYTES: 1024,
} as const;

// === Proof Types ===

export type ProofType = 'developer' | 'whale';
export type CircuitType = 'dev_reputation' | 'whale_trading';

// === Helius Data Types ===

export interface ProgramData {
  /** Program address (base58 encoded) */
  address: string;
  /** Optional program name */
  name?: string;
  /** ISO timestamp of deployment */
  deployedAt: string;
  /** Deployer wallet address */
  deployer: string;
  /** Estimated TVL in USD */
  estimatedTVL: number;
}

export interface TradeData {
  /** Transaction signature */
  signature: string;
  /** Trade amount in USD */
  amount: number;
  /** Unix timestamp */
  timestamp: number;
  /** Trade type */
  type: 'buy' | 'sell' | 'swap';
}

export interface TradingVolumeData {
  /** Total trading volume in USD */
  totalVolume: number;
  /** Number of trades */
  tradeCount: number;
  /** Individual trade amounts (for circuit input) */
  amounts: number[];
  /** Period in days */
  period: number;
  /** Wallet address */
  wallet: string;
  /** Optional individual trades for UI display */
  trades?: TradeData[];
}

// === Proof Input Types ===

export interface DevReputationInput {
  /** Wallet public key (base58 encoded Solana address) */
  walletPubkey: string;
  /** List of deployed programs with TVL data */
  programs: ProgramData[];
  /** Minimum TVL threshold to prove */
  minTvl: number;
}

export interface WhaleTradingInput {
  /** Wallet public key (base58 encoded Solana address) */
  walletPubkey: string;
  /** Trading volume data */
  tradingData: TradingVolumeData;
  /** Minimum volume threshold to prove */
  minVolume: number;
}

// === Proof Result Types ===

export interface ProofResult {
  /** The ZK proof bytes */
  proof: Uint8Array;
  /** Public inputs to the circuit */
  publicInputs: string[];
  /** Nullifier hash (hex encoded) - prevents double-proving */
  nullifier: string;
  /** Commitment hash (hex encoded) - links wallet to proof */
  commitment: string;
  /** Timestamp when proof was generated (Unix ms) */
  generatedAt: number;
  /** Timestamp when proof expires (Unix ms) */
  expiresAt: number;
}

export interface ProofGenerationProgress {
  /** Current status */
  status: 'idle' | 'loading' | 'preparing' | 'generating' | 'complete' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step description */
  message: string;
  /** Error message if status is 'error' */
  error?: string;
}

// === Verification Types ===

export interface VerificationResult {
  /** Whether verification succeeded */
  success: boolean;
  /** Transaction signature if successful */
  signature?: string;
  /** Error message if failed */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: VouchErrorCode;
}

// === Serialization Types ===

/** Serialized proof result for storage/transmission (JSON-safe) */
export interface SerializedProofResult {
  /** Proof bytes as hex string */
  proof: string;
  /** Public inputs array */
  publicInputs: string[];
  /** Nullifier hash (hex encoded) */
  nullifier: string;
  /** Commitment hash (hex encoded) */
  commitment: string;
  /** Timestamp when proof was generated (Unix ms) */
  generatedAt: number;
  /** Timestamp when proof expires (Unix ms) */
  expiresAt: number;
}

// === Circuit Types (matching NoirJS InputMap format) ===
// Note: NoirJS accepts all numeric values as strings

export interface DevReputationCircuitInputs {
  wallet_pubkey: number[];
  secret: number[];
  program_count: string;
  tvl_amounts: string[];
  min_tvl: string;
  commitment: number[];
  nullifier: number[];
}

export interface WhaleTradingCircuitInputs {
  wallet_pubkey: number[];
  secret: number[];
  trade_count: string;
  trade_amounts: string[];
  min_volume: string;
  commitment: number[];
  nullifier: number[];
}

// === Error Types ===

export enum VouchErrorCode {
  // Wallet errors
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  WALLET_REJECTED = 'WALLET_REJECTED',

  // Proof errors
  PROOF_GENERATION_FAILED = 'PROOF_GENERATION_FAILED',
  CIRCUIT_LOAD_FAILED = 'CIRCUIT_LOAD_FAILED',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  THRESHOLD_NOT_MET = 'THRESHOLD_NOT_MET',

  // Security errors
  PROOF_EXPIRED = 'PROOF_EXPIRED',
  PROOF_TOO_LARGE = 'PROOF_TOO_LARGE',
  INVALID_PROOF_FORMAT = 'INVALID_PROOF_FORMAT',
  RATE_LIMITED = 'RATE_LIMITED',

  // Transaction errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NULLIFIER_ALREADY_USED = 'NULLIFIER_ALREADY_USED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  PROTOCOL_PAUSED = 'PROTOCOL_PAUSED',

  // API errors
  HELIUS_API_ERROR = 'HELIUS_API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Unknown
  UNKNOWN = 'UNKNOWN',
}

export class VouchError extends Error {
  constructor(
    message: string,
    public code: VouchErrorCode,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'VouchError';
  }
}

// === Utility Types ===

export type HexString = string;
export type Base58String = string;

// === Type Guards ===

export function isProofResult(obj: unknown): obj is ProofResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'proof' in obj &&
    'publicInputs' in obj &&
    'nullifier' in obj &&
    'commitment' in obj
  );
}

export function isVouchError(error: unknown): error is VouchError {
  return error instanceof VouchError;
}
