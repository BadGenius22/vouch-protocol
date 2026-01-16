/**
 * Vouch Protocol - Attestation Signing (Serverless)
 *
 * Signs verification results using Ed25519 so they can be verified on-chain.
 * The verifier's public key is registered on the Solana program.
 */

import { Keypair } from '@solana/web3.js';
import type { VerificationResult, SignedAttestation } from './types';

// Verifier keypair (initialized once per serverless instance)
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
      // Try JSON array format first (most common)
      const secretKey = new Uint8Array(JSON.parse(privateKeyEnv));
      verifierKeypair = Keypair.fromSecretKey(secretKey);
      console.log(`[Verifier] Loaded keypair: ${verifierKeypair.publicKey.toBase58()}`);
    } catch {
      try {
        // Try base58 format
        const bs58 = require('bs58');
        const secretKey = bs58.decode(privateKeyEnv);
        verifierKeypair = Keypair.fromSecretKey(secretKey);
        console.log(`[Verifier] Loaded keypair (base58): ${verifierKeypair.publicKey.toBase58()}`);
      } catch (error) {
        console.error('[Verifier] Invalid VERIFIER_PRIVATE_KEY format');
        // Fall through to generate new keypair
      }
    }
  }

  if (!verifierKeypair) {
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
  // Format: isValid|proofType|nullifier|commitment|verifiedAt
  const message = createAttestationMessage(result);
  const messageBytes = new TextEncoder().encode(message);

  // Sign with Ed25519 using nacl (bundled with @solana/web3.js)
  const nacl = require('tweetnacl');
  const signature = nacl.sign.detached(messageBytes, verifierKeypair!.secretKey);

  // Create attestation hash (for on-chain storage)
  const crypto = require('crypto');
  const attestationHash = crypto
    .createHash('sha256')
    .update(messageBytes)
    .digest('hex');

  // Encode signature as base58
  const bs58 = require('bs58');

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

  const nacl = require('tweetnacl');
  const bs58 = require('bs58');

  const signature = bs58.decode(attestation.signature);
  const publicKey = bs58.decode(attestation.verifier);

  return nacl.sign.detached.verify(messageBytes, signature, publicKey);
}

/**
 * Create the message string for signing
 */
function createAttestationMessage(result: VerificationResult): string {
  return [
    result.isValid ? '1' : '0',
    result.proofType,
    result.nullifier,
    result.commitment,
    result.verifiedAt.toString(),
  ].join('|');
}
