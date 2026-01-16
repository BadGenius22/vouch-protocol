/**
 * Vouch Protocol - Verifier Module
 *
 * Exports all verifier functionality for use in API routes
 */

export * from './types';
export { verifyProof, getCircuitStatus } from './verify';
export { initializeVerifier, getVerifierPublicKey, signAttestation, verifyAttestationSignature } from './sign';
