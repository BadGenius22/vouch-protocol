/**
 * Vouch Protocol - Client-side ZK Proof Generation
 * Proofs are generated entirely in the browser using NoirJS + Barretenberg
 *
 * Security: Private inputs (wallet, secret) never leave the browser.
 * The proof only reveals that the prover meets the threshold, not their identity.
 */

import { blake2s } from 'blakejs';
import type { InputMap } from '@noir-lang/noirc_abi';
import { loadCircuit } from './circuit';
import {
  CIRCUIT_CONSTANTS,
  DevReputationInput,
  WhaleTradingInput,
  ProofResult,
  VouchError,
  VouchErrorCode,
} from './types';

// === Utility Functions ===

/**
 * Convert a byte array to a hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a byte array to a number array (for Noir circuit inputs)
 */
function bytesToNumberArray(bytes: Uint8Array): number[] {
  return Array.from(bytes);
}

/**
 * Convert a Solana wallet address (base58) to a 32-byte array
 * For simplicity, we hash the address to get a consistent 32-byte value
 */
function walletToBytes32(walletPubkey: string): Uint8Array {
  const encoder = new TextEncoder();
  const walletBytes = encoder.encode(walletPubkey);

  // Use blake2s to hash the wallet address to 32 bytes
  // This ensures consistent input size for the circuit
  return blake2s(walletBytes, undefined, 32);
}

/**
 * Compute commitment = blake2s(wallet_pubkey || secret)
 * This must match the circuit's commitment computation
 */
function computeCommitment(walletBytes: Uint8Array, secret: Uint8Array): Uint8Array {
  // Concatenate wallet_pubkey (32 bytes) and secret (32 bytes)
  const preimage = new Uint8Array(64);
  preimage.set(walletBytes, 0);
  preimage.set(secret, 32);

  // Hash to get commitment
  return blake2s(preimage, undefined, 32);
}

/**
 * Compute nullifier = blake2s(wallet_pubkey || domain_separator)
 * Domain separator is padded with zeros to 32 bytes
 */
function computeNullifier(walletBytes: Uint8Array, domainSeparator: string): Uint8Array {
  const encoder = new TextEncoder();
  const domainBytes = encoder.encode(domainSeparator);

  // Create preimage: wallet_pubkey (32 bytes) || domain (up to 32 bytes, rest zeros)
  const preimage = new Uint8Array(64);
  preimage.set(walletBytes, 0);
  preimage.set(domainBytes, 32);
  // Rest is already zeros

  return blake2s(preimage, undefined, 32);
}

/**
 * Validate input data before proof generation
 */
function validateDevReputationInput(input: DevReputationInput): void {
  if (!input.walletPubkey || input.walletPubkey.length < 32) {
    throw new VouchError(
      'Invalid wallet public key',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  if (!input.programs || input.programs.length === 0) {
    throw new VouchError(
      'No programs provided for proof generation',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  const totalTvl = input.programs.reduce((sum, p) => sum + p.estimatedTVL, 0);
  if (totalTvl < input.minTvl) {
    throw new VouchError(
      `Total TVL (${totalTvl}) is below minimum threshold (${input.minTvl})`,
      VouchErrorCode.THRESHOLD_NOT_MET
    );
  }
}

function validateWhaleTradingInput(input: WhaleTradingInput): void {
  if (!input.walletPubkey || input.walletPubkey.length < 32) {
    throw new VouchError(
      'Invalid wallet public key',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  if (!input.tradingData || input.tradingData.totalVolume === 0) {
    throw new VouchError(
      'No trading data provided for proof generation',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  if (input.tradingData.totalVolume < input.minVolume) {
    throw new VouchError(
      `Trading volume (${input.tradingData.totalVolume}) is below minimum threshold (${input.minVolume})`,
      VouchErrorCode.THRESHOLD_NOT_MET
    );
  }
}

// === Proof Generation Functions ===

/**
 * Generate a developer reputation proof
 * Proves: "I control a wallet that deployed programs with >= minTvl TVL"
 *
 * @param input - Developer reputation proof input
 * @returns Proof result with proof bytes, public inputs, nullifier, and commitment
 */
export async function generateDevReputationProof(
  input: DevReputationInput
): Promise<ProofResult> {
  // Validate input
  validateDevReputationInput(input);

  console.log('[Vouch] Generating dev reputation proof:', {
    wallet: input.walletPubkey.slice(0, 8) + '...',
    programs: input.programs.length,
    totalTvl: input.programs.reduce((s, p) => s + p.estimatedTVL, 0),
    minTvl: input.minTvl,
  });

  try {
    // Load circuit and backend
    const { noir, backend } = await loadCircuit('dev_reputation');

    // Generate random secret for commitment
    const secret = crypto.getRandomValues(new Uint8Array(32));

    // Convert wallet to 32-byte representation
    const walletBytes = walletToBytes32(input.walletPubkey);

    // Compute commitment and nullifier
    const commitment = computeCommitment(walletBytes, secret);
    const nullifier = computeNullifier(walletBytes, CIRCUIT_CONSTANTS.DOMAIN_SEPARATOR_DEV);

    // Prepare TVL amounts (pad to MAX_PROGRAMS)
    const tvlAmounts: string[] = new Array(CIRCUIT_CONSTANTS.MAX_PROGRAMS).fill('0');
    for (let i = 0; i < Math.min(input.programs.length, CIRCUIT_CONSTANTS.MAX_PROGRAMS); i++) {
      tvlAmounts[i] = input.programs[i].estimatedTVL.toString();
    }

    // Prepare circuit inputs (using InputMap format for NoirJS)
    const circuitInputs: InputMap = {
      wallet_pubkey: bytesToNumberArray(walletBytes),
      secret: bytesToNumberArray(secret),
      program_count: Math.min(input.programs.length, CIRCUIT_CONSTANTS.MAX_PROGRAMS).toString(),
      tvl_amounts: tvlAmounts,
      min_tvl: input.minTvl.toString(),
      commitment: bytesToNumberArray(commitment),
      nullifier: bytesToNumberArray(nullifier),
    };

    console.log('[Vouch] Executing circuit to generate witness...');

    // Execute circuit to get witness
    const { witness } = await noir.execute(circuitInputs);

    console.log('[Vouch] Generating proof from witness...');

    // Generate proof from witness
    const proofData = await backend.generateProof(witness);

    console.log('[Vouch] Dev reputation proof generated successfully');

    return {
      proof: proofData.proof,
      publicInputs: proofData.publicInputs,
      nullifier: bytesToHex(nullifier),
      commitment: bytesToHex(commitment),
    };
  } catch (error) {
    if (error instanceof VouchError) {
      throw error;
    }

    console.error('[Vouch] Proof generation error:', error);

    throw new VouchError(
      `Failed to generate proof: ${error instanceof Error ? error.message : 'Unknown error'}`,
      VouchErrorCode.PROOF_GENERATION_FAILED,
      error
    );
  }
}

/**
 * Generate a whale trading proof
 * Proves: "I control a wallet that traded >= minVolume in the period"
 *
 * @param input - Whale trading proof input
 * @returns Proof result with proof bytes, public inputs, nullifier, and commitment
 */
export async function generateWhaleTradingProof(
  input: WhaleTradingInput
): Promise<ProofResult> {
  // Validate input
  validateWhaleTradingInput(input);

  console.log('[Vouch] Generating whale trading proof:', {
    wallet: input.walletPubkey.slice(0, 8) + '...',
    volume: input.tradingData.totalVolume,
    trades: input.tradingData.tradeCount,
    minVolume: input.minVolume,
  });

  try {
    // Load circuit and backend
    const { noir, backend } = await loadCircuit('whale_trading');

    // Generate random secret for commitment
    const secret = crypto.getRandomValues(new Uint8Array(32));

    // Convert wallet to 32-byte representation
    const walletBytes = walletToBytes32(input.walletPubkey);

    // Compute commitment and nullifier
    const commitment = computeCommitment(walletBytes, secret);
    const nullifier = computeNullifier(walletBytes, CIRCUIT_CONSTANTS.DOMAIN_SEPARATOR_WHALE);

    // Prepare trade amounts (pad to MAX_TRADES)
    const tradeAmounts: string[] = new Array(CIRCUIT_CONSTANTS.MAX_TRADES).fill('0');
    const amounts = input.tradingData.amounts || [];
    for (let i = 0; i < Math.min(amounts.length, CIRCUIT_CONSTANTS.MAX_TRADES); i++) {
      tradeAmounts[i] = amounts[i].toString();
    }

    // If no individual amounts provided, distribute total volume
    if (amounts.length === 0 && input.tradingData.totalVolume > 0) {
      // Put all volume in first slot
      tradeAmounts[0] = input.tradingData.totalVolume.toString();
    }

    // Prepare circuit inputs
    const circuitInputs: InputMap = {
      wallet_pubkey: bytesToNumberArray(walletBytes),
      secret: bytesToNumberArray(secret),
      trade_count: Math.max(1, Math.min(input.tradingData.tradeCount || 1, CIRCUIT_CONSTANTS.MAX_TRADES)).toString(),
      trade_amounts: tradeAmounts,
      min_volume: input.minVolume.toString(),
      commitment: bytesToNumberArray(commitment),
      nullifier: bytesToNumberArray(nullifier),
    };

    console.log('[Vouch] Executing circuit to generate witness...');

    // Execute circuit to get witness
    const { witness } = await noir.execute(circuitInputs);

    console.log('[Vouch] Generating proof from witness...');

    // Generate proof from witness
    const proofData = await backend.generateProof(witness);

    console.log('[Vouch] Whale trading proof generated successfully');

    return {
      proof: proofData.proof,
      publicInputs: proofData.publicInputs,
      nullifier: bytesToHex(nullifier),
      commitment: bytesToHex(commitment),
    };
  } catch (error) {
    if (error instanceof VouchError) {
      throw error;
    }

    console.error('[Vouch] Proof generation error:', error);

    throw new VouchError(
      `Failed to generate proof: ${error instanceof Error ? error.message : 'Unknown error'}`,
      VouchErrorCode.PROOF_GENERATION_FAILED,
      error
    );
  }
}

/**
 * Verify a proof locally (for testing)
 * In production, verification happens on-chain
 */
export async function verifyProofLocally(
  circuitType: 'dev_reputation' | 'whale_trading',
  proof: Uint8Array,
  publicInputs: string[]
): Promise<boolean> {
  try {
    const { backend } = await loadCircuit(circuitType);
    return await backend.verifyProof({ proof, publicInputs });
  } catch (error) {
    console.error('[Vouch] Local verification failed:', error);
    return false;
  }
}
