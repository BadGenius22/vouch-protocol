/**
 * Vouch Protocol - Attestation Signing
 *
 * Signs verification results using Ed25519 so they can be verified on-chain.
 * The verifier's public key is registered on the Solana program.
 */

import { Keypair } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import * as crypto from 'crypto';
import type { VerificationResult, SignedAttestation } from './types.js';

// === Verifier Keypair ===

let verifierKeypair: Keypair | null = null;

/**
 * Initialize the verifier keypair from environment or generate a new one
 *
 * For production, set VERIFIER_PRIVATE_KEY in environment
 * The corresponding public key must be registered in the Anchor program
 */
export function initializeVerifier(): Keypair {
  if (verifierKeypair) {
    return verifierKeypair;
  }

  const privateKeyEnv = process.env.VERIFIER_PRIVATE_KEY;

  if (privateKeyEnv) {
    try {
      // Try base58 format first
      const secretKey = bs58.decode(privateKeyEnv);
      verifierKeypair = Keypair.fromSecretKey(secretKey);
      console.log(`[Verifier] Loaded keypair from environment: ${verifierKeypair.publicKey.toBase58()}`);
    } catch {
      try {
        // Try JSON array format
        const secretKey = new Uint8Array(JSON.parse(privateKeyEnv));
        verifierKeypair = Keypair.fromSecretKey(secretKey);
        console.log(`[Verifier] Loaded keypair from environment (JSON): ${verifierKeypair.publicKey.toBase58()}`);
      } catch (error) {
        console.error('[Verifier] Invalid VERIFIER_PRIVATE_KEY format');
        throw error;
      }
    }
  } else {
    // Generate a new keypair for development
    verifierKeypair = Keypair.generate();
    console.log(`[Verifier] Generated new keypair: ${verifierKeypair.publicKey.toBase58()}`);
    console.log(`[Verifier] WARNING: Using ephemeral keypair. Set VERIFIER_PRIVATE_KEY for production.`);
  }

  return verifierKeypair;
}

/**
 * Get the verifier's public key
 */
export function getVerifierPublicKey(): string {
  if (!verifierKeypair) {
    initializeVerifier();
  }
  return verifierKeypair!.publicKey.toBase58();
}

// === Attestation Signing ===

/**
 * Create a signed attestation from a verification result
 *
 * The attestation includes:
 * - The verification result
 * - Verifier's public key
 * - Ed25519 signature
 * - Hash for on-chain storage
 */
export function signAttestation(result: VerificationResult): SignedAttestation {
  if (!verifierKeypair) {
    initializeVerifier();
  }

  // Create message to sign
  // Format: isValid|proofType|nullifier|commitment|epoch|dataHash|verifiedAt
  const message = createAttestationMessage(result);
  const messageBytes = new TextEncoder().encode(message);

  // Sign with Ed25519
  const signature = nacl.sign.detached(messageBytes, verifierKeypair!.secretKey);

  // Create attestation hash (for on-chain storage)
  const attestationHash = crypto
    .createHash('sha256')
    .update(messageBytes)
    .digest('hex');

  return {
    result,
    verifier: verifierKeypair!.publicKey.toBase58(),
    signature: bs58.encode(signature),
    attestationHash,
  };
}

/**
 * Verify an attestation signature (for testing)
 */
export function verifyAttestationSignature(attestation: SignedAttestation): boolean {
  const message = createAttestationMessage(attestation.result);
  const messageBytes = new TextEncoder().encode(message);

  const signature = bs58.decode(attestation.signature);
  const publicKey = bs58.decode(attestation.verifier);

  return nacl.sign.detached.verify(messageBytes, signature, publicKey);
}

/**
 * Create the message string for signing
 * Format: isValid|proofType|nullifier|commitment|epoch|dataHash|verifiedAt
 */
function createAttestationMessage(result: VerificationResult): string {
  return [
    result.isValid ? '1' : '0',
    result.proofType,
    result.nullifier,
    result.commitment,
    result.epoch,
    result.dataHash,
    result.verifiedAt.toString(),
  ].join('|');
}

/**
 * Export the verifier keypair (for registration in Anchor program)
 * Only use in development/setup
 */
export function exportVerifierKeypair(): {
  publicKey: string;
  secretKey: string;
} {
  if (!verifierKeypair) {
    initializeVerifier();
  }

  return {
    publicKey: verifierKeypair!.publicKey.toBase58(),
    secretKey: bs58.encode(verifierKeypair!.secretKey),
  };
}
