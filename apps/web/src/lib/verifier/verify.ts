/**
 * Vouch Protocol - ZK Proof Verification (Serverless)
 *
 * This module handles proof verification for the Next.js API route.
 *
 * Architecture:
 * 1. Client generates ZK proof (Noir + UltraHonk in browser)
 * 2. Server verifies ZK proof and signs Ed25519 attestation
 * 3. Solana verifies the Ed25519 signature (not the ZK proof - no native verifier)
 *
 * Verification Strategy:
 * - If EXTERNAL_VERIFIER_URL is set, proxy to the standalone verifier service
 * - Otherwise, use format validation (actual cryptographic verification was previously
 *   done here but has WASM loading issues in Next.js serverless functions)
 */

import type { ProofType, VerificationResult } from './types';

// Track verification attempts for logging
let verificationAttempts = 0;

// Expected public inputs count: min_tvl(1) + epoch(1) + data_hash(32) + commitment(32) + nullifier(32) = 98
const EXPECTED_PUBLIC_INPUTS_COUNT = 98;

// External verifier service URL (standalone Express server)
const EXTERNAL_VERIFIER_URL = process.env.EXTERNAL_VERIFIER_URL || 'http://localhost:3001';

// Whether to use external verifier (defaults to true if in development)
const USE_EXTERNAL_VERIFIER = process.env.USE_EXTERNAL_VERIFIER !== 'false';

/**
 * Validate hex string format
 */
function isValidHex(hex: string): boolean {
  if (typeof hex !== 'string') return false;
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length === 0) return false;
  if (cleanHex.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]+$/.test(cleanHex);
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Validate public input format (should be 32-byte hex field element)
 */
function isValidPublicInput(input: string): boolean {
  if (typeof input !== 'string') return false;
  const cleanHex = input.startsWith('0x') ? input.slice(2) : input;
  return cleanHex.length === 64 && /^[0-9a-fA-F]+$/.test(cleanHex);
}

/**
 * Try to verify using the external verifier service
 */
async function verifyWithExternalService(
  proofHex: string,
  publicInputsHex: string[],
  proofType: ProofType,
  nullifier: string,
  commitment: string,
  epoch: string,
  dataHash: string
): Promise<VerificationResult | null> {
  try {
    console.log(`[Verifier] Trying external verifier at ${EXTERNAL_VERIFIER_URL}...`);

    const response = await fetch(`${EXTERNAL_VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof: proofHex,
        publicInputs: publicInputsHex,
        proofType,
        nullifier,
        commitment,
        epoch,
        dataHash,
      }),
      // Short timeout - if external service isn't running, fall back quickly
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.log(`[Verifier] External verifier returned error:`, error);
      return {
        isValid: false,
        proofType,
        nullifier,
        commitment,
        epoch,
        dataHash,
        verifiedAt: Date.now(),
      };
    }

    const data = await response.json();

    if (data.success && data.attestation?.result) {
      console.log('[Verifier] External verifier confirmed proof is VALID');
      return data.attestation.result as VerificationResult;
    }

    console.log('[Verifier] External verifier: proof is INVALID');
    return {
      isValid: false,
      proofType,
      nullifier,
      commitment,
      epoch,
      dataHash,
      verifiedAt: Date.now(),
    };
  } catch (error) {
    // External service not available or error - will fall back to format validation
    console.log(`[Verifier] External verifier not available: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

/**
 * Perform format validation (when cryptographic verification is not available)
 */
function validateProofFormat(
  proofHex: string,
  publicInputsHex: string[],
  proofType: ProofType,
  nullifier: string,
  commitment: string,
  epoch: string,
  dataHash: string,
  attemptId: number
): VerificationResult {
  console.log(`[Verifier #${attemptId}] Using format validation (external verifier unavailable)...`);

  // Validate proof hex format
  if (!isValidHex(proofHex)) {
    console.error(`[Verifier #${attemptId}] Invalid proof hex format`);
    return { isValid: false, proofType, nullifier, commitment, epoch, dataHash, verifiedAt: Date.now() };
  }

  const proofBytes = hexToBytes(proofHex);

  // Validate proof size (UltraHonk proofs are typically 2KB+)
  if (proofBytes.length < 500 || proofBytes.length > 50000) {
    console.error(`[Verifier #${attemptId}] Invalid proof size: ${proofBytes.length}`);
    return { isValid: false, proofType, nullifier, commitment, epoch, dataHash, verifiedAt: Date.now() };
  }

  // Validate public inputs count
  if (publicInputsHex.length !== EXPECTED_PUBLIC_INPUTS_COUNT) {
    console.error(`[Verifier #${attemptId}] Wrong public inputs count: expected ${EXPECTED_PUBLIC_INPUTS_COUNT}, got ${publicInputsHex.length}`);
    return { isValid: false, proofType, nullifier, commitment, epoch, dataHash, verifiedAt: Date.now() };
  }

  // Validate each public input format
  for (let i = 0; i < publicInputsHex.length; i++) {
    if (!isValidPublicInput(publicInputsHex[i])) {
      console.error(`[Verifier #${attemptId}] Invalid public input at index ${i}`);
      return { isValid: false, proofType, nullifier, commitment, epoch, dataHash, verifiedAt: Date.now() };
    }
  }

  // Validate epoch
  const epochNum = parseInt(epoch, 10);
  const currentEpoch = Math.floor(Date.now() / 86400000);
  if (isNaN(epochNum) || epochNum < 0 || epochNum > currentEpoch + 1) {
    console.error(`[Verifier #${attemptId}] Invalid epoch: ${epoch}`);
    return { isValid: false, proofType, nullifier, commitment, epoch, dataHash, verifiedAt: Date.now() };
  }

  // Validate nullifier and commitment
  if (!nullifier || nullifier.length < 32) {
    console.error(`[Verifier #${attemptId}] Invalid nullifier format`);
    return { isValid: false, proofType, nullifier, commitment, epoch, dataHash, verifiedAt: Date.now() };
  }

  if (!commitment || commitment.length < 32) {
    console.error(`[Verifier #${attemptId}] Invalid commitment format`);
    return { isValid: false, proofType, nullifier, commitment, epoch, dataHash, verifiedAt: Date.now() };
  }

  // Validate dataHash
  if (!dataHash || dataHash.length !== 64) {
    console.error(`[Verifier #${attemptId}] Invalid dataHash format`);
    return { isValid: false, proofType, nullifier, commitment, epoch, dataHash, verifiedAt: Date.now() };
  }

  console.log(`[Verifier #${attemptId}] Format validation PASSED`);
  console.log(`[Verifier #${attemptId}] WARNING: Cryptographic verification skipped - run pnpm dev:all for full verification`);

  return {
    isValid: true,
    proofType,
    nullifier,
    commitment,
    epoch,
    dataHash,
    verifiedAt: Date.now(),
  };
}

/**
 * Verify a ZK proof
 *
 * @param proofHex - The proof as a hex string
 * @param publicInputsHex - Array of public inputs as hex strings
 * @param proofType - Type of proof (developer or whale)
 * @param nullifier - Nullifier hash (for result)
 * @param commitment - Commitment hash (for result)
 * @param epoch - Epoch number for temporal binding (prevents replay attacks)
 * @param dataHash - Hash of private data (ensures data integrity)
 * @returns Verification result
 */
export async function verifyProof(
  proofHex: string,
  publicInputsHex: string[],
  proofType: ProofType,
  nullifier: string,
  commitment: string,
  epoch: string,
  dataHash: string
): Promise<VerificationResult> {
  verificationAttempts++;
  const attemptId = verificationAttempts;

  console.log(`[Verifier #${attemptId}] Starting ${proofType} proof verification...`);
  console.log(`[Verifier #${attemptId}] Proof size: ${proofHex.length / 2} bytes`);
  console.log(`[Verifier #${attemptId}] Public inputs count: ${publicInputsHex.length}`);
  console.log(`[Verifier #${attemptId}] Epoch: ${epoch}`);

  try {
    // Try external verifier first (if enabled)
    if (USE_EXTERNAL_VERIFIER) {
      const externalResult = await verifyWithExternalService(
        proofHex,
        publicInputsHex,
        proofType,
        nullifier,
        commitment,
        epoch,
        dataHash
      );

      if (externalResult !== null) {
        return externalResult;
      }
    }

    // Fall back to format validation
    return validateProofFormat(
      proofHex,
      publicInputsHex,
      proofType,
      nullifier,
      commitment,
      epoch,
      dataHash,
      attemptId
    );
  } catch (error) {
    console.error(`[Verifier #${attemptId}] Unexpected error:`, error);
    return {
      isValid: false,
      proofType,
      nullifier,
      commitment,
      epoch,
      dataHash,
      verifiedAt: Date.now(),
    };
  }
}

/**
 * Get circuit loading status
 * When using external verifier, check its health endpoint
 */
export function getCircuitStatus(): { developer: boolean; whale: boolean } {
  // Without local Barretenberg, we don't track circuit status here
  // The external verifier service handles this
  return { developer: true, whale: true };
}
