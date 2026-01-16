/**
 * Vouch Protocol - Security Utilities
 * Input validation, proof TTL, and security helpers
 */

import {
  SECURITY_CONSTANTS,
  VouchError,
  VouchErrorCode,
  type ProofResult,
  type SerializedProofResult,
} from './types';

// === Proof TTL Validation ===

/**
 * Check if a proof has expired
 */
export function isProofExpired(proof: ProofResult | SerializedProofResult): boolean {
  return Date.now() > proof.expiresAt;
}

/**
 * Get remaining time until proof expires (in ms)
 * Returns 0 if already expired
 */
export function getProofTimeRemaining(proof: ProofResult | SerializedProofResult): number {
  const remaining = proof.expiresAt - Date.now();
  return Math.max(0, remaining);
}

/**
 * Validate proof has not expired
 * Throws VouchError if expired
 */
export function validateProofNotExpired(proof: ProofResult | SerializedProofResult): void {
  if (isProofExpired(proof)) {
    throw new VouchError(
      `Proof expired ${Math.round((Date.now() - proof.expiresAt) / 1000)} seconds ago. Please generate a new proof.`,
      VouchErrorCode.PROOF_EXPIRED
    );
  }
}

/**
 * Calculate expiration timestamp for a new proof
 * @param ttlMs - Time to live in milliseconds (default: 5 minutes)
 */
export function calculateProofExpiration(
  ttlMs: number = SECURITY_CONSTANTS.DEFAULT_PROOF_TTL_MS
): { generatedAt: number; expiresAt: number } {
  // Clamp TTL to valid range
  const clampedTtl = Math.min(
    Math.max(ttlMs, SECURITY_CONSTANTS.MIN_PROOF_TTL_MS),
    SECURITY_CONSTANTS.MAX_PROOF_TTL_MS
  );

  const generatedAt = Date.now();
  const expiresAt = generatedAt + clampedTtl;

  return { generatedAt, expiresAt };
}

// === Input Validation ===

/**
 * Validate proof size is within limits
 */
export function validateProofSize(proofBytes: Uint8Array): void {
  if (proofBytes.length > SECURITY_CONSTANTS.MAX_PROOF_SIZE_BYTES) {
    throw new VouchError(
      `Proof size ${proofBytes.length} bytes exceeds maximum ${SECURITY_CONSTANTS.MAX_PROOF_SIZE_BYTES} bytes`,
      VouchErrorCode.PROOF_TOO_LARGE
    );
  }
}

/**
 * Validate public inputs size is within limits
 */
export function validatePublicInputsSize(publicInputs: string[]): void {
  const totalSize = publicInputs.reduce((acc, input) => acc + input.length, 0);
  if (totalSize > SECURITY_CONSTANTS.MAX_PUBLIC_INPUTS_SIZE_BYTES) {
    throw new VouchError(
      `Public inputs size ${totalSize} bytes exceeds maximum ${SECURITY_CONSTANTS.MAX_PUBLIC_INPUTS_SIZE_BYTES} bytes`,
      VouchErrorCode.PROOF_TOO_LARGE
    );
  }
}

/**
 * Validate hex string format
 */
export function isValidHexString(value: string): boolean {
  if (typeof value !== 'string') return false;
  // Allow 0x prefix
  const hex = value.startsWith('0x') ? value.slice(2) : value;
  return /^[a-fA-F0-9]*$/.test(hex) && hex.length % 2 === 0;
}

/**
 * Validate base58 string format (Solana addresses)
 */
export function isValidBase58String(value: string): boolean {
  if (typeof value !== 'string') return false;
  // Base58 alphabet (no 0, O, I, l)
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}

/**
 * Sanitize string input (remove potential XSS vectors)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;');
}

// === Proof Validation ===

/**
 * Comprehensive proof validation
 * Validates size, TTL, and format
 */
export function validateProof(proof: ProofResult): void {
  // Validate proof size
  validateProofSize(proof.proof);

  // Validate public inputs size
  validatePublicInputsSize(proof.publicInputs);

  // Validate TTL
  validateProofNotExpired(proof);

  // Validate nullifier format
  if (!isValidHexString(proof.nullifier)) {
    throw new VouchError(
      'Invalid nullifier format',
      VouchErrorCode.INVALID_PROOF_FORMAT
    );
  }

  // Validate commitment format
  if (!isValidHexString(proof.commitment)) {
    throw new VouchError(
      'Invalid commitment format',
      VouchErrorCode.INVALID_PROOF_FORMAT
    );
  }
}

/**
 * Validate serialized proof before deserialization
 */
export function validateSerializedProof(proof: SerializedProofResult): void {
  // Validate proof hex format
  if (!isValidHexString(proof.proof)) {
    throw new VouchError(
      'Invalid proof hex format',
      VouchErrorCode.INVALID_PROOF_FORMAT
    );
  }

  // Validate proof size (hex string is 2x byte size)
  const proofByteSize = proof.proof.length / 2;
  if (proofByteSize > SECURITY_CONSTANTS.MAX_PROOF_SIZE_BYTES) {
    throw new VouchError(
      `Proof size ${proofByteSize} bytes exceeds maximum`,
      VouchErrorCode.PROOF_TOO_LARGE
    );
  }

  // Validate public inputs
  validatePublicInputsSize(proof.publicInputs);

  // Validate TTL
  validateProofNotExpired(proof);

  // Validate nullifier format
  if (!isValidHexString(proof.nullifier)) {
    throw new VouchError(
      'Invalid nullifier format',
      VouchErrorCode.INVALID_PROOF_FORMAT
    );
  }

  // Validate commitment format
  if (!isValidHexString(proof.commitment)) {
    throw new VouchError(
      'Invalid commitment format',
      VouchErrorCode.INVALID_PROOF_FORMAT
    );
  }
}

// === Wallet Address Validation ===

/**
 * Validate Solana wallet address
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!isValidBase58String(address)) return false;
  // Solana addresses are 32-44 characters in base58
  return address.length >= 32 && address.length <= 44;
}

/**
 * Validate Solana wallet address and throw if invalid
 */
export function validateSolanaAddress(address: string): void {
  if (!isValidSolanaAddress(address)) {
    throw new VouchError(
      'Invalid Solana wallet address',
      VouchErrorCode.INVALID_PROOF_FORMAT
    );
  }
}

// === Rate Limit Helpers ===

/**
 * Format rate limit remaining time for display
 */
export function formatRateLimitTime(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
