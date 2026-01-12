/**
 * Vouch Protocol - Shared Types
 */

// === Helius Data Types ===

export interface ProgramData {
  address: string;
  deployedAt: string;
  deployer: string;
  estimatedTVL: number;
}

export interface TradingVolumeData {
  totalVolume: number;
  tradeCount: number;
  amounts: number[];
  period: number;
  wallet: string;
}

// === Proof Types ===

export interface DevReputationInput {
  walletPubkey: string;
  programs: ProgramData[];
  minTvl: number;
}

export interface WhaleTradingInput {
  walletPubkey: string;
  tradingData: TradingVolumeData;
  minVolume: number;
}

export interface ProofResult {
  proof: Uint8Array;
  publicInputs: string[];
  nullifier: string;
  commitment: string;
}

// === Verification Types ===

export interface VerificationResult {
  success: boolean;
  signature?: string;
  error?: string;
}

// === Circuit Constants ===

export const CIRCUIT_CONSTANTS = {
  MAX_PROGRAMS: 5,
  MAX_TRADES: 20,
  DOMAIN_SEPARATOR_DEV: 'vouch_dev',
  DOMAIN_SEPARATOR_WHALE: 'vouch_whale',
} as const;

// === Proof Types Enum ===

export type ProofType = 'developer' | 'whale';
