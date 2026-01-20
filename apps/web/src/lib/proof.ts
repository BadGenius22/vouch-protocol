/**
 * Vouch Protocol - Client-side ZK Proof Generation
 *
 * Security Architecture:
 * - Proofs are generated entirely in the browser using NoirJS + UltraHonk (Barretenberg)
 * - Private inputs (wallet_pubkey, secret) NEVER leave the browser
 * - Only public inputs (threshold, commitment, nullifier) are revealed
 * - The proof cryptographically guarantees the prover meets the threshold
 *   without revealing their identity, exact amounts, or wallet address
 *
 * Nullifier Pattern:
 * - Each wallet can only prove once per proof type (dev/whale)
 * - nullifier = blake2s(wallet_pubkey || domain_separator)
 * - Prevents double-proving and Sybil attacks
 *
 * @see https://noir-lang.org/docs/tutorials/noirjs_app/
 */

import { blake2s } from 'blakejs';
import { PublicKey } from '@solana/web3.js';
import type { InputMap } from '@noir-lang/noirc_abi';
import { loadCircuit } from './circuit';
import {
  CIRCUIT_CONSTANTS,
  SECURITY_CONSTANTS,
  DevReputationInput,
  WhaleTradingInput,
  ProofResult,
  ProofGenerationProgress,
  SerializedProofResult,
  VouchError,
  VouchErrorCode,
} from './types';
import { calculateProofExpiration, validateProofSize, validatePublicInputsSize } from './security';

// === Debug Mode ===
const DEBUG = process.env.NODE_ENV === 'development';

// === Constants ===

/** Maximum safe integer for u64 in circuits (2^64 - 1) */
const MAX_U64 = BigInt('18446744073709551615');

/** Minimum valid Solana address length (base58) */
const MIN_WALLET_LENGTH = 32;

/** Maximum valid Solana address length (base58) */
const MAX_WALLET_LENGTH = 44;

// === Progress Callback Type ===

/**
 * Callback function for proof generation progress updates
 * Used to provide real-time feedback to the UI during proof generation
 */
export type ProofProgressCallback = (progress: ProofGenerationProgress) => void;

// === Utility Functions ===

/**
 * Convert a byte array to a lowercase hex string
 * @param bytes - The byte array to convert
 * @returns Hexadecimal string representation
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a byte array to a number array (for Noir circuit inputs)
 * Noir circuits expect byte arrays as number[] where each element is 0-255
 * @param bytes - The byte array to convert
 * @returns Array of numbers suitable for circuit input
 */
function bytesToNumberArray(bytes: Uint8Array): number[] {
  return Array.from(bytes);
}

/**
 * Convert a Solana wallet address (base58) to raw 32-byte public key
 *
 * CRITICAL: This function returns the RAW 32-byte public key, NOT a hash.
 * The circuit expects the actual public key bytes for commitment/nullifier
 * derivation. Using a hash would break the proof verification.
 *
 * @param walletPubkey - Base58 encoded Solana wallet address
 * @returns Raw 32-byte public key
 * @throws VouchError if wallet address is invalid
 */
function walletToBytes32(walletPubkey: string): Uint8Array {
  // Validate wallet address format
  if (!walletPubkey || walletPubkey.length < MIN_WALLET_LENGTH || walletPubkey.length > MAX_WALLET_LENGTH) {
    throw new VouchError(
      `Invalid wallet address: must be ${MIN_WALLET_LENGTH}-${MAX_WALLET_LENGTH} characters`,
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Basic base58 character validation (Solana addresses use base58)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(walletPubkey)) {
    throw new VouchError(
      'Invalid wallet address: contains invalid characters',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  try {
    // Decode base58 to raw 32-byte public key using @solana/web3.js
    const pubkey = new PublicKey(walletPubkey);
    return pubkey.toBytes();
  } catch {
    throw new VouchError(
      'Invalid wallet address: failed to decode base58',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }
}

/**
 * Compute commitment = blake2s(wallet_pubkey || secret)
 *
 * The commitment is a binding value that:
 * 1. Links the proof to a specific wallet (via wallet_pubkey)
 * 2. Prevents the wallet from being revealed (via the secret)
 * 3. Can be verified on-chain without revealing the wallet
 *
 * @param walletBytes - 32-byte wallet pubkey hash
 * @param secret - 32-byte random secret
 * @returns 32-byte commitment hash
 */
function computeCommitment(walletBytes: Uint8Array, secret: Uint8Array): Uint8Array {
  if (walletBytes.length !== 32) {
    throw new VouchError('Wallet bytes must be 32 bytes', VouchErrorCode.PROOF_GENERATION_FAILED);
  }
  if (secret.length !== 32) {
    throw new VouchError('Secret must be 32 bytes', VouchErrorCode.PROOF_GENERATION_FAILED);
  }

  // Concatenate wallet_pubkey (32 bytes) and secret (32 bytes)
  const preimage = new Uint8Array(64);
  preimage.set(walletBytes, 0);
  preimage.set(secret, 32);

  // Hash to get commitment
  return blake2s(preimage, undefined, 32);
}

/**
 * Compute nullifier with temporal binding = blake2s(wallet_pubkey || domain_separator || epoch)
 *
 * The nullifier serves as a unique identifier for each wallet per proof type per epoch:
 * - Deterministic: same wallet + same epoch always produces same nullifier
 * - Unlinkable: cannot derive wallet address from nullifier
 * - Domain-separated: different nullifiers for dev vs whale proofs
 * - Time-bound: different nullifiers for different epochs (prevents replay attacks)
 *
 * @param walletBytes - 32-byte wallet pubkey hash
 * @param domainSeparator - Domain separator string (e.g., "vouch_dev" or "vouch_whale")
 * @param epoch - Epoch value for temporal binding (e.g., day number)
 * @returns 32-byte nullifier hash
 */
function computeNullifier(walletBytes: Uint8Array, domainSeparator: string, epoch: bigint): Uint8Array {
  if (walletBytes.length !== 32) {
    throw new VouchError('Wallet bytes must be 32 bytes', VouchErrorCode.PROOF_GENERATION_FAILED);
  }

  const encoder = new TextEncoder();
  const domainBytes = encoder.encode(domainSeparator);

  if (domainBytes.length > 32) {
    throw new VouchError('Domain separator too long', VouchErrorCode.PROOF_GENERATION_FAILED);
  }

  // Create preimage: wallet_pubkey (32 bytes) || domain (up to 32 bytes padded) || epoch (8 bytes)
  // Total: 72 bytes (matches circuit)
  const preimage = new Uint8Array(72);
  preimage.set(walletBytes, 0);
  preimage.set(domainBytes, 32);
  // Domain is zero-padded to 32 bytes (positions 32-63)

  // Append epoch as big-endian bytes at position 64-71
  const epochBytes = bigIntToBytes8(epoch);
  preimage.set(epochBytes, 64);

  return blake2s(preimage, undefined, 32);
}

/**
 * Convert a BigInt to 8 big-endian bytes
 */
function bigIntToBytes8(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  bytes[0] = Number((value >> 56n) & 0xFFn);
  bytes[1] = Number((value >> 48n) & 0xFFn);
  bytes[2] = Number((value >> 40n) & 0xFFn);
  bytes[3] = Number((value >> 32n) & 0xFFn);
  bytes[4] = Number((value >> 24n) & 0xFFn);
  bytes[5] = Number((value >> 16n) & 0xFFn);
  bytes[6] = Number((value >> 8n) & 0xFFn);
  bytes[7] = Number(value & 0xFFn);
  return bytes;
}

/**
 * Compute data hash for TVL amounts (for dev reputation circuit)
 * Hash: blake2s(tvl_amounts as 64 bytes - up to 8 u64 values)
 *
 * @param tvlAmounts - Array of TVL amounts (5 values, padded to 8)
 * @returns 32-byte data hash
 */
function computeTvlDataHash(tvlAmounts: bigint[]): Uint8Array {
  // Pack up to 8 u64 values into 64 bytes (8 * 8 bytes)
  const dataBytes = new Uint8Array(64);

  for (let i = 0; i < Math.min(8, tvlAmounts.length); i++) {
    const bytes = bigIntToBytes8(tvlAmounts[i]);
    dataBytes.set(bytes, i * 8);
  }

  return blake2s(dataBytes, undefined, 32);
}

/**
 * Compute data hash for trade amounts (for whale trading circuit)
 * Hash: blake2s(blake2s(first_10_trades) || blake2s(second_10_trades))
 *
 * This matches the circuit's compute_trade_data_hash function which hashes
 * trades in two rounds to avoid large preimage sizes.
 *
 * @param tradeAmounts - Array of trade amounts (20 values)
 * @returns 32-byte data hash
 */
function computeTradeDataHash(tradeAmounts: bigint[]): Uint8Array {
  // First half: hash first 10 trades (80 bytes)
  const firstHalf = new Uint8Array(80);
  for (let i = 0; i < 10; i++) {
    const amount = i < tradeAmounts.length ? tradeAmounts[i] : 0n;
    const bytes = bigIntToBytes8(amount);
    firstHalf.set(bytes, i * 8);
  }
  const hash1 = blake2s(firstHalf, undefined, 32);

  // Second half: hash second 10 trades (80 bytes)
  const secondHalf = new Uint8Array(80);
  for (let i = 0; i < 10; i++) {
    const idx = 10 + i;
    const amount = idx < tradeAmounts.length ? tradeAmounts[idx] : 0n;
    const bytes = bigIntToBytes8(amount);
    secondHalf.set(bytes, i * 8);
  }
  const hash2 = blake2s(secondHalf, undefined, 32);

  // Combine: blake2s(hash1 || hash2)
  const combined = new Uint8Array(64);
  combined.set(hash1, 0);
  combined.set(hash2, 32);

  return blake2s(combined, undefined, 32);
}

/**
 * Get current epoch as day number since Unix epoch
 * This provides daily granularity for nullifier binding
 *
 * @returns Current day number as bigint
 */
function getCurrentEpoch(): bigint {
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  return BigInt(Math.floor(now / dayInMs));
}

/**
 * Compute the nullifier hash for a wallet address
 *
 * This is used to check if a wallet has already proven for a specific proof type.
 * The nullifier is now time-bound with an epoch parameter.
 *
 * @param walletAddress - Base58 wallet address
 * @param proofType - Type of proof ('developer' or 'whale')
 * @param epoch - Optional epoch value (defaults to current day)
 * @returns Nullifier hash as hex string (64 characters)
 */
export function computeNullifierForWallet(
  walletAddress: string,
  proofType: 'developer' | 'whale',
  epoch?: bigint
): string {
  // Convert wallet address to bytes (use first 32 bytes of base58 decoded)
  const bs58 = require('bs58');
  const walletBytes = new Uint8Array(bs58.decode(walletAddress));

  if (walletBytes.length !== 32) {
    throw new VouchError('Invalid wallet address', VouchErrorCode.PROOF_GENERATION_FAILED);
  }

  // Use appropriate domain separator
  const domainSeparator = proofType === 'developer'
    ? CIRCUIT_CONSTANTS.DOMAIN_SEPARATOR_DEV
    : CIRCUIT_CONSTANTS.DOMAIN_SEPARATOR_WHALE;

  // Use provided epoch or current day
  const effectiveEpoch = epoch ?? getCurrentEpoch();

  const nullifierBytes = computeNullifier(walletBytes, domainSeparator, effectiveEpoch);

  // Convert to hex string
  return Buffer.from(nullifierBytes).toString('hex');
}

/**
 * Sanitize and validate an amount value for circuit input
 *
 * @param amount - The amount to sanitize
 * @param fieldName - Name of the field for error messages
 * @returns Sanitized amount as a string
 * @throws VouchError if amount is invalid
 */
function sanitizeAmount(amount: number, fieldName: string): string {
  // Check for non-numeric or invalid values
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new VouchError(
      `Invalid ${fieldName}: must be a valid number`,
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Check for negative values
  if (amount < 0) {
    throw new VouchError(
      `Invalid ${fieldName}: cannot be negative`,
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Convert to BigInt for u64 overflow check
  const amountBigInt = BigInt(Math.floor(amount));
  if (amountBigInt > MAX_U64) {
    throw new VouchError(
      `Invalid ${fieldName}: exceeds maximum u64 value`,
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Return as string (NoirJS format)
  return amountBigInt.toString();
}

/**
 * Validate developer reputation input data before proof generation
 *
 * @param input - Developer reputation proof input
 * @throws VouchError if validation fails
 */
function validateDevReputationInput(input: DevReputationInput): void {
  // Validate wallet address
  if (!input.walletPubkey || input.walletPubkey.length < MIN_WALLET_LENGTH) {
    throw new VouchError(
      'Invalid wallet public key: address too short',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  if (input.walletPubkey.length > MAX_WALLET_LENGTH) {
    throw new VouchError(
      'Invalid wallet public key: address too long',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Validate programs array
  if (!input.programs || !Array.isArray(input.programs)) {
    throw new VouchError(
      'Programs must be provided as an array',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  if (input.programs.length === 0) {
    throw new VouchError(
      'No programs provided for proof generation',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  if (input.programs.length > CIRCUIT_CONSTANTS.MAX_PROGRAMS) {
    throw new VouchError(
      `Too many programs: maximum is ${CIRCUIT_CONSTANTS.MAX_PROGRAMS}`,
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Validate each program's TVL
  for (let i = 0; i < input.programs.length; i++) {
    const program = input.programs[i];
    if (typeof program.estimatedTVL !== 'number' || program.estimatedTVL < 0) {
      throw new VouchError(
        `Invalid TVL for program ${i + 1}: must be a non-negative number`,
        VouchErrorCode.INSUFFICIENT_DATA
      );
    }
  }

  // Validate threshold
  if (typeof input.minTvl !== 'number' || input.minTvl < 0) {
    throw new VouchError(
      'Invalid minimum TVL threshold: must be a non-negative number',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Calculate total TVL and check threshold
  const totalTvl = input.programs.reduce((sum, p) => sum + p.estimatedTVL, 0);
  if (totalTvl < input.minTvl) {
    throw new VouchError(
      `Insufficient TVL: total ${formatNumber(totalTvl)} is below threshold ${formatNumber(input.minTvl)}`,
      VouchErrorCode.THRESHOLD_NOT_MET
    );
  }
}

/**
 * Validate whale trading input data before proof generation
 *
 * @param input - Whale trading proof input
 * @throws VouchError if validation fails
 */
function validateWhaleTradingInput(input: WhaleTradingInput): void {
  // Validate wallet address
  if (!input.walletPubkey || input.walletPubkey.length < MIN_WALLET_LENGTH) {
    throw new VouchError(
      'Invalid wallet public key: address too short',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  if (input.walletPubkey.length > MAX_WALLET_LENGTH) {
    throw new VouchError(
      'Invalid wallet public key: address too long',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Validate trading data object
  if (!input.tradingData || typeof input.tradingData !== 'object') {
    throw new VouchError(
      'Trading data must be provided',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Validate total volume
  if (typeof input.tradingData.totalVolume !== 'number' || input.tradingData.totalVolume < 0) {
    throw new VouchError(
      'Invalid total volume: must be a non-negative number',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  if (input.tradingData.totalVolume === 0) {
    throw new VouchError(
      'No trading volume recorded',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Validate amounts array if provided
  if (input.tradingData.amounts && Array.isArray(input.tradingData.amounts)) {
    if (input.tradingData.amounts.length > CIRCUIT_CONSTANTS.MAX_TRADES) {
      throw new VouchError(
        `Too many trades: maximum is ${CIRCUIT_CONSTANTS.MAX_TRADES}`,
        VouchErrorCode.INSUFFICIENT_DATA
      );
    }

    for (let i = 0; i < input.tradingData.amounts.length; i++) {
      if (typeof input.tradingData.amounts[i] !== 'number' || input.tradingData.amounts[i] < 0) {
        throw new VouchError(
          `Invalid amount for trade ${i + 1}: must be a non-negative number`,
          VouchErrorCode.INSUFFICIENT_DATA
        );
      }
    }
  }

  // Validate threshold
  if (typeof input.minVolume !== 'number' || input.minVolume < 0) {
    throw new VouchError(
      'Invalid minimum volume threshold: must be a non-negative number',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  // Check threshold
  if (input.tradingData.totalVolume < input.minVolume) {
    throw new VouchError(
      `Insufficient volume: total ${formatNumber(input.tradingData.totalVolume)} is below threshold ${formatNumber(input.minVolume)}`,
      VouchErrorCode.THRESHOLD_NOT_MET
    );
  }
}

/**
 * Format a number for display (with commas)
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Debug logger - only logs in development mode
 */
function debugLog(...args: unknown[]): void {
  if (DEBUG) {
    console.log('[Vouch]', ...args);
  }
}

/**
 * Create a progress update helper function
 *
 * @param onProgress - Optional callback for progress updates
 * @returns A function to update progress
 */
function createProgressUpdater(onProgress?: ProofProgressCallback) {
  return (
    status: ProofGenerationProgress['status'],
    progress: number,
    message: string,
    error?: string
  ) => {
    if (onProgress) {
      onProgress({ status, progress, message, error });
    }
    debugLog(message);
  };
}

// === Proof Generation Functions ===

/**
 * Generate a developer reputation proof
 *
 * Proves: "I control a wallet that deployed programs with >= minTvl TVL"
 * Without revealing: which wallet, which programs, or exact TVL amounts
 *
 * Security guarantees:
 * - Private inputs (wallet, secret, program details) never leave the browser
 * - The nullifier prevents the same wallet from proving twice
 * - The commitment binds the wallet to the proof without revealing it
 *
 * @param input - Developer reputation proof input
 * @param onProgress - Optional callback for progress updates
 * @returns Proof result with proof bytes, public inputs, nullifier, and commitment
 * @throws VouchError if proof generation fails
 *
 * @example
 * ```typescript
 * const result = await generateDevReputationProof(
 *   { walletPubkey: '...', programs: [...], minTvl: 100000 },
 *   (progress) => console.log(progress.message)
 * );
 * ```
 */
export async function generateDevReputationProof(
  input: DevReputationInput,
  onProgress?: ProofProgressCallback
): Promise<ProofResult> {
  const updateProgress = createProgressUpdater(onProgress);

  try {
    // Step 1: Validate input
    updateProgress('preparing', 5, 'Validating input data...');
    validateDevReputationInput(input);

    const totalTvl = input.programs.reduce((s, p) => s + p.estimatedTVL, 0);
    debugLog('Generating dev reputation proof:', {
      wallet: input.walletPubkey.slice(0, 8) + '...',
      programs: input.programs.length,
      totalTvl: formatNumber(totalTvl),
      minTvl: formatNumber(input.minTvl),
    });

    // Step 2: Load circuit
    updateProgress('loading', 15, 'Loading circuit and WASM backend...');
    const { noir, backend } = await loadCircuit('dev_reputation');

    // Step 3: Prepare cryptographic inputs
    updateProgress('preparing', 30, 'Preparing cryptographic inputs...');

    // Generate cryptographically secure random secret for commitment
    const secret = crypto.getRandomValues(new Uint8Array(32));

    // Convert wallet to 32-byte representation
    const walletBytes = walletToBytes32(input.walletPubkey);

    // Get current epoch (day number) for temporal binding
    const epoch = getCurrentEpoch();

    // Compute commitment (not time-bound - links wallet to proof)
    const commitment = computeCommitment(walletBytes, secret);

    // Compute nullifier with epoch (time-bound - prevents replay attacks)
    const nullifier = computeNullifier(walletBytes, CIRCUIT_CONSTANTS.DOMAIN_SEPARATOR_DEV, epoch);

    // Prepare TVL amounts with validation (pad to MAX_PROGRAMS)
    const tvlAmounts: string[] = new Array(CIRCUIT_CONSTANTS.MAX_PROGRAMS).fill('0');
    const tvlAmountsBigInt: bigint[] = new Array(CIRCUIT_CONSTANTS.MAX_PROGRAMS).fill(0n);
    const programCount = Math.min(input.programs.length, CIRCUIT_CONSTANTS.MAX_PROGRAMS);
    for (let i = 0; i < programCount; i++) {
      tvlAmounts[i] = sanitizeAmount(input.programs[i].estimatedTVL, `program ${i + 1} TVL`);
      tvlAmountsBigInt[i] = BigInt(Math.floor(input.programs[i].estimatedTVL));
    }

    // Compute data hash for private data integrity verification
    const dataHash = computeTvlDataHash(tvlAmountsBigInt);

    // Prepare circuit inputs (using InputMap format for NoirJS)
    const circuitInputs: InputMap = {
      wallet_pubkey: bytesToNumberArray(walletBytes),
      secret: bytesToNumberArray(secret),
      program_count: programCount.toString(),
      tvl_amounts: tvlAmounts,
      min_tvl: sanitizeAmount(input.minTvl, 'minimum TVL'),
      epoch: epoch.toString(),
      data_hash: bytesToNumberArray(dataHash),
      commitment: bytesToNumberArray(commitment),
      nullifier: bytesToNumberArray(nullifier),
    };

    // Step 4: Execute circuit to generate witness
    updateProgress('generating', 50, 'Executing circuit to generate witness...');
    debugLog('Executing circuit with inputs...');
    debugLog('Circuit inputs:', {
      wallet_pubkey_len: (circuitInputs.wallet_pubkey as number[]).length,
      secret_len: (circuitInputs.secret as number[]).length,
      program_count: circuitInputs.program_count,
      tvl_amounts_len: (circuitInputs.tvl_amounts as string[]).length,
      min_tvl: circuitInputs.min_tvl,
      commitment_len: (circuitInputs.commitment as number[]).length,
      nullifier_len: (circuitInputs.nullifier as number[]).length,
    });
    let witness;
    try {
      const result = await noir.execute(circuitInputs);
      witness = result.witness;
      debugLog('Circuit execution complete, witness generated');
    } catch (executeError) {
      console.error('[Vouch] Circuit execution failed:', executeError);
      if (executeError instanceof Error) {
        console.error('[Vouch] Error name:', executeError.name);
        console.error('[Vouch] Error message:', executeError.message);
        console.error('[Vouch] Error stack:', executeError.stack);
      }
      throw new VouchError(
        `Circuit execution failed: ${executeError instanceof Error ? executeError.message : 'Unknown error'}`,
        VouchErrorCode.PROOF_GENERATION_FAILED,
        executeError
      );
    }

    // Step 5: Generate proof from witness
    updateProgress('generating', 70, 'Generating ZK proof (this may take a moment)...');
    debugLog('Starting backend.generateProof - this triggers CRS download...');
    let proofData;
    try {
      proofData = await backend.generateProof(witness);
      debugLog('Proof generation completed successfully');
    } catch (proofError) {
      // Log detailed error info for debugging
      console.error('[Vouch] Backend proof generation failed:', proofError);
      if (proofError instanceof Error) {
        console.error('[Vouch] Error name:', proofError.name);
        console.error('[Vouch] Error message:', proofError.message);
        console.error('[Vouch] Error stack:', proofError.stack);
      }
      throw proofError;
    }

    // Step 6: Validate proof size
    validateProofSize(proofData.proof);
    validatePublicInputsSize(proofData.publicInputs);

    // Step 7: Calculate TTL
    const { generatedAt, expiresAt } = calculateProofExpiration(
      SECURITY_CONSTANTS.DEFAULT_PROOF_TTL_MS
    );

    // Step 8: Complete
    updateProgress('complete', 100, 'Proof generated successfully');

    return {
      proof: proofData.proof,
      publicInputs: proofData.publicInputs,
      nullifier: bytesToHex(nullifier),
      commitment: bytesToHex(commitment),
      generatedAt,
      expiresAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof VouchError) {
      updateProgress('error', 0, 'Proof generation failed', errorMessage);
      throw error;
    }

    if (DEBUG) console.error('[Vouch] Proof generation error:', error);
    updateProgress('error', 0, 'Proof generation failed', errorMessage);

    throw new VouchError(
      `Failed to generate proof: ${errorMessage}`,
      VouchErrorCode.PROOF_GENERATION_FAILED,
      error
    );
  }
}

/**
 * Generate a whale trading proof
 *
 * Proves: "I control a wallet that traded >= minVolume in the period"
 * Without revealing: which wallet, which trades, or exact volume
 *
 * Security guarantees:
 * - Private inputs (wallet, secret, trade details) never leave the browser
 * - The nullifier prevents the same wallet from proving twice
 * - The commitment binds the wallet to the proof without revealing it
 *
 * @param input - Whale trading proof input
 * @param onProgress - Optional callback for progress updates
 * @returns Proof result with proof bytes, public inputs, nullifier, and commitment
 * @throws VouchError if proof generation fails
 *
 * @example
 * ```typescript
 * const result = await generateWhaleTradingProof(
 *   { walletPubkey: '...', tradingData: {...}, minVolume: 50000 },
 *   (progress) => setProgress(progress)
 * );
 * ```
 */
export async function generateWhaleTradingProof(
  input: WhaleTradingInput,
  onProgress?: ProofProgressCallback
): Promise<ProofResult> {
  const updateProgress = createProgressUpdater(onProgress);

  try {
    // Step 1: Validate input
    updateProgress('preparing', 5, 'Validating input data...');
    validateWhaleTradingInput(input);

    debugLog('Generating whale trading proof:', {
      wallet: input.walletPubkey.slice(0, 8) + '...',
      volume: formatNumber(input.tradingData.totalVolume),
      trades: input.tradingData.tradeCount,
      minVolume: formatNumber(input.minVolume),
    });

    // Step 2: Load circuit
    updateProgress('loading', 15, 'Loading circuit and WASM backend...');
    const { noir, backend } = await loadCircuit('whale_trading');

    // Step 3: Prepare cryptographic inputs
    updateProgress('preparing', 30, 'Preparing cryptographic inputs...');

    // Generate cryptographically secure random secret for commitment
    const secret = crypto.getRandomValues(new Uint8Array(32));

    // Convert wallet to 32-byte representation
    const walletBytes = walletToBytes32(input.walletPubkey);

    // Get current epoch (day number) for temporal binding
    const epoch = getCurrentEpoch();

    // Compute commitment (not time-bound - links wallet to proof)
    const commitment = computeCommitment(walletBytes, secret);

    // Compute nullifier with epoch (time-bound - prevents replay attacks)
    const nullifier = computeNullifier(walletBytes, CIRCUIT_CONSTANTS.DOMAIN_SEPARATOR_WHALE, epoch);

    // Prepare trade amounts with validation (pad to MAX_TRADES)
    const tradeAmounts: string[] = new Array(CIRCUIT_CONSTANTS.MAX_TRADES).fill('0');
    const tradeAmountsBigInt: bigint[] = new Array(CIRCUIT_CONSTANTS.MAX_TRADES).fill(0n);
    const amounts = input.tradingData.amounts || [];

    // Bound the amounts array to MAX_TRADES
    const boundedAmountsCount = Math.min(amounts.length, CIRCUIT_CONSTANTS.MAX_TRADES);
    // Trade count must be at least 1, at most MAX_TRADES
    const tradeCount = Math.max(1, boundedAmountsCount || 1);

    if (boundedAmountsCount > 0) {
      // Use individual amounts (bounded to MAX_TRADES)
      for (let i = 0; i < boundedAmountsCount; i++) {
        tradeAmounts[i] = sanitizeAmount(amounts[i], `trade ${i + 1} amount`);
        tradeAmountsBigInt[i] = BigInt(Math.floor(amounts[i]));
      }
    } else if (input.tradingData.totalVolume > 0) {
      // If no individual amounts provided, put total volume in first slot
      // This is valid as long as total >= threshold
      tradeAmounts[0] = sanitizeAmount(input.tradingData.totalVolume, 'total volume');
      tradeAmountsBigInt[0] = BigInt(Math.floor(input.tradingData.totalVolume));
    }

    // Compute data hash for private data integrity verification
    const dataHash = computeTradeDataHash(tradeAmountsBigInt);

    // Prepare circuit inputs
    const circuitInputs: InputMap = {
      wallet_pubkey: bytesToNumberArray(walletBytes),
      secret: bytesToNumberArray(secret),
      trade_count: tradeCount.toString(),
      trade_amounts: tradeAmounts,
      min_volume: sanitizeAmount(input.minVolume, 'minimum volume'),
      epoch: epoch.toString(),
      data_hash: bytesToNumberArray(dataHash),
      commitment: bytesToNumberArray(commitment),
      nullifier: bytesToNumberArray(nullifier),
    };

    // Step 4: Execute circuit to generate witness
    updateProgress('generating', 50, 'Executing circuit to generate witness...');
    debugLog('Whale circuit inputs:', {
      wallet_pubkey_len: (circuitInputs.wallet_pubkey as number[]).length,
      secret_len: (circuitInputs.secret as number[]).length,
      trade_count: circuitInputs.trade_count,
      trade_amounts_len: (circuitInputs.trade_amounts as string[]).length,
      min_volume: circuitInputs.min_volume,
      commitment_len: (circuitInputs.commitment as number[]).length,
      nullifier_len: (circuitInputs.nullifier as number[]).length,
    });
    let witness;
    try {
      const result = await noir.execute(circuitInputs);
      witness = result.witness;
      debugLog('Whale circuit execution complete, witness generated');
    } catch (executeError) {
      console.error('[Vouch] Whale circuit execution failed:', executeError);
      if (executeError instanceof Error) {
        console.error('[Vouch] Error name:', executeError.name);
        console.error('[Vouch] Error message:', executeError.message);
        console.error('[Vouch] Error stack:', executeError.stack);
      }
      throw new VouchError(
        `Circuit execution failed: ${executeError instanceof Error ? executeError.message : 'Unknown error'}`,
        VouchErrorCode.PROOF_GENERATION_FAILED,
        executeError
      );
    }

    // Step 5: Generate proof from witness
    updateProgress('generating', 70, 'Generating ZK proof (this may take a moment)...');
    debugLog('Starting whale backend.generateProof...');
    let proofData;
    try {
      proofData = await backend.generateProof(witness);
      debugLog('Whale proof generation completed successfully');
    } catch (proofError) {
      console.error('[Vouch] Whale backend proof generation failed:', proofError);
      if (proofError instanceof Error) {
        console.error('[Vouch] Error name:', proofError.name);
        console.error('[Vouch] Error message:', proofError.message);
        console.error('[Vouch] Error stack:', proofError.stack);
      }
      throw proofError;
    }

    // Step 6: Validate proof size
    validateProofSize(proofData.proof);
    validatePublicInputsSize(proofData.publicInputs);

    // Step 7: Calculate TTL
    const { generatedAt, expiresAt } = calculateProofExpiration(
      SECURITY_CONSTANTS.DEFAULT_PROOF_TTL_MS
    );

    // Step 8: Complete
    updateProgress('complete', 100, 'Proof generated successfully');

    return {
      proof: proofData.proof,
      publicInputs: proofData.publicInputs,
      nullifier: bytesToHex(nullifier),
      commitment: bytesToHex(commitment),
      generatedAt,
      expiresAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof VouchError) {
      updateProgress('error', 0, 'Proof generation failed', errorMessage);
      throw error;
    }

    if (DEBUG) console.error('[Vouch] Whale proof generation error:', error);
    updateProgress('error', 0, 'Proof generation failed', errorMessage);

    throw new VouchError(
      `Failed to generate proof: ${errorMessage}`,
      VouchErrorCode.PROOF_GENERATION_FAILED,
      error
    );
  }
}

/**
 * Verify a proof locally (for testing and development)
 *
 * Note: In production, verification should happen on-chain to prevent
 * client-side manipulation. This function is useful for:
 * - Testing proof generation
 * - Development debugging
 * - Pre-validation before on-chain submission
 *
 * @param circuitType - Type of circuit used to generate the proof
 * @param proof - The proof bytes
 * @param publicInputs - The public inputs used in the proof
 * @returns True if the proof is valid, false otherwise
 */
export async function verifyProofLocally(
  circuitType: 'dev_reputation' | 'whale_trading',
  proof: Uint8Array,
  publicInputs: string[]
): Promise<boolean> {
  try {
    debugLog(`Verifying ${circuitType} proof locally...`);
    const { backend } = await loadCircuit(circuitType);
    const isValid = await backend.verifyProof({ proof, publicInputs });
    debugLog(`Local verification result: ${isValid ? 'VALID' : 'INVALID'}`);
    return isValid;
  } catch (error) {
    if (DEBUG) console.error('[Vouch] Local verification failed:', error);
    return false;
  }
}

/**
 * Verify a proof result (convenience wrapper)
 *
 * @param proofResult - The proof result from generateDevReputationProof or generateWhaleTradingProof
 * @param circuitType - Type of circuit used
 * @returns True if the proof is valid
 */
export async function verifyProofResult(
  proofResult: ProofResult,
  circuitType: 'dev_reputation' | 'whale_trading'
): Promise<boolean> {
  return verifyProofLocally(circuitType, proofResult.proof, proofResult.publicInputs);
}

/**
 * Get the proof size in bytes (useful for transaction size estimation)
 *
 * @param proof - The proof bytes
 * @returns Size of the proof in bytes
 */
export function getProofSize(proof: Uint8Array): number {
  return proof.length;
}

/**
 * Serialize a proof result for storage or transmission
 *
 * @param proofResult - The proof result to serialize
 * @returns JSON-serializable object
 */
export function serializeProofResult(proofResult: ProofResult): SerializedProofResult {
  return {
    proof: bytesToHex(proofResult.proof),
    publicInputs: proofResult.publicInputs,
    nullifier: proofResult.nullifier,
    commitment: proofResult.commitment,
    generatedAt: proofResult.generatedAt,
    expiresAt: proofResult.expiresAt,
  };
}

/**
 * Deserialize a proof result from storage
 *
 * @param serialized - The serialized proof result
 * @returns ProofResult object
 * @throws VouchError if serialized data is invalid
 */
export function deserializeProofResult(serialized: SerializedProofResult): ProofResult {
  // Validate input
  if (!serialized || typeof serialized.proof !== 'string') {
    throw new VouchError(
      'Invalid serialized proof: missing or invalid proof field',
      VouchErrorCode.PROOF_GENERATION_FAILED
    );
  }

  // Validate hex string format
  if (!/^[0-9a-fA-F]*$/.test(serialized.proof)) {
    throw new VouchError(
      'Invalid serialized proof: proof must be a valid hex string',
      VouchErrorCode.PROOF_GENERATION_FAILED
    );
  }

  // Validate TTL fields
  if (typeof serialized.generatedAt !== 'number' || typeof serialized.expiresAt !== 'number') {
    throw new VouchError(
      'Invalid serialized proof: missing TTL fields',
      VouchErrorCode.INVALID_PROOF_FORMAT
    );
  }

  // Convert hex string back to Uint8Array
  const hexPairs = serialized.proof.match(/.{1,2}/g);
  const proofBytes = new Uint8Array(
    hexPairs?.map((byte) => parseInt(byte, 16)) || []
  );

  return {
    proof: proofBytes,
    publicInputs: serialized.publicInputs || [],
    nullifier: serialized.nullifier || '',
    commitment: serialized.commitment || '',
    generatedAt: serialized.generatedAt,
    expiresAt: serialized.expiresAt,
  };
}
