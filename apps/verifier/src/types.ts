import { z } from 'zod';

/**
 * Proof types supported by the verifier
 */
export type ProofType = 'developer' | 'whale';

/**
 * Request schema for proof verification
 */
export const verifyRequestSchema = z.object({
  proof: z.string().min(1, 'Proof is required'),
  publicInputs: z.array(z.string()).min(1, 'Public inputs are required'),
  proofType: z.enum(['developer', 'whale']),
  nullifier: z.string().length(64, 'Nullifier must be 64 hex characters'),
  commitment: z.string().length(64, 'Commitment must be 64 hex characters'),
});

export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

/**
 * Verification result from Barretenberg
 */
export interface VerificationResult {
  isValid: boolean;
  proofType: ProofType;
  nullifier: string;
  commitment: string;
  verifiedAt: number;
}

/**
 * Signed attestation that can be submitted to Solana
 */
export interface SignedAttestation {
  /** Verification result */
  result: VerificationResult;
  /** Verifier's public key (base58) */
  verifier: string;
  /** Ed25519 signature of the result (base58) */
  signature: string;
  /** Hash of the attestation data for on-chain storage */
  attestationHash: string;
}

/**
 * API response for verification endpoint
 */
export interface VerifyResponse {
  success: boolean;
  attestation?: SignedAttestation;
  error?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  verifier: string;
  circuitsLoaded: {
    developer: boolean;
    whale: boolean;
  };
}
