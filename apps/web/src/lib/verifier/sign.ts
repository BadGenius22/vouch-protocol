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
 * Domain separator for attestation messages
 * Must match the on-chain constant in lib.rs
 */
const ATTESTATION_DOMAIN = 'vouch_attestation';

/**
 * Proof type values (must match on-chain ProofType enum)
 */
const PROOF_TYPE_VALUES: Record<string, number> = {
  developer: 1,
  whale: 2,
};

/**
 * Create a signed attestation from a verification result
 *
 * The attestation includes:
 * - The verification result
 * - Verifier's public key
 * - Ed25519 signature (raw bytes as Uint8Array)
 * - Attestation hash
 * - Message bytes (for Ed25519 instruction)
 */
export function signAttestation(result: VerificationResult): SignedAttestation {
  if (!verifierKeypair) {
    initializeVerifier();
  }

  const bs58 = require('bs58');
  const crypto = require('crypto');
  const nacl = require('tweetnacl');

  // Get proof type value
  const proofTypeValue = PROOF_TYPE_VALUES[result.proofType] || 0;

  // Decode nullifier from hex to bytes
  const nullifierHex = result.nullifier.startsWith('0x')
    ? result.nullifier.slice(2)
    : result.nullifier;
  const nullifierBytes = Buffer.from(nullifierHex, 'hex');

  // Create attestation hash from the original result data
  // This is used for on-chain storage and reference
  const originalMessage = [
    result.isValid ? '1' : '0',
    result.proofType,
    result.nullifier,
    result.commitment,
    result.verifiedAt.toString(),
  ].join('|');
  const attestationHash = crypto
    .createHash('sha256')
    .update(originalMessage)
    .digest();

  // Build the binary message for signing
  // Format: "vouch_attestation" (17 bytes) | proof_type (1 byte) | nullifier (32 bytes) | attestation_hash (32 bytes)
  // Total: 82 bytes
  const messageBytes = buildAttestationMessage(
    proofTypeValue,
    nullifierBytes,
    attestationHash
  );

  // Sign with Ed25519 using nacl
  const signatureBytes = nacl.sign.detached(messageBytes, verifierKeypair!.secretKey);

  return {
    result,
    verifier: verifierKeypair!.publicKey.toBase58(),
    signature: bs58.encode(signatureBytes),
    signatureBytes: signatureBytes,
    attestationHash: attestationHash.toString('hex'),
    attestationHashBytes: attestationHash,
    messageBytes: messageBytes,
  };
}

/**
 * Build the attestation message in binary format
 * Must match the on-chain build_attestation_message function
 *
 * Format: "vouch_attestation" (17 bytes) | proof_type (1 byte) | nullifier (32 bytes) | attestation_hash (32 bytes)
 */
export function buildAttestationMessage(
  proofTypeValue: number,
  nullifier: Uint8Array,
  attestationHash: Uint8Array
): Uint8Array {
  const message = new Uint8Array(82);

  // Domain separator: "vouch_attestation" (17 bytes)
  const domain = new TextEncoder().encode(ATTESTATION_DOMAIN);
  message.set(domain, 0);

  // Proof type (1 byte)
  message[17] = proofTypeValue;

  // Nullifier (32 bytes)
  message.set(nullifier.slice(0, 32), 18);

  // Attestation hash (32 bytes)
  message.set(attestationHash.slice(0, 32), 50);

  return message;
}

/**
 * Verify an attestation signature (for testing)
 */
export function verifyAttestationSignature(attestation: SignedAttestation): boolean {
  const nacl = require('tweetnacl');
  const bs58 = require('bs58');

  // Use the stored messageBytes if available, otherwise rebuild
  let messageBytes: Uint8Array;
  if (attestation.messageBytes) {
    messageBytes = attestation.messageBytes;
  } else {
    // Rebuild message from result
    const proofTypeValue = PROOF_TYPE_VALUES[attestation.result.proofType] || 0;
    const nullifierHex = attestation.result.nullifier.startsWith('0x')
      ? attestation.result.nullifier.slice(2)
      : attestation.result.nullifier;
    const nullifierBytes = Buffer.from(nullifierHex, 'hex');
    const attestationHashBytes = attestation.attestationHashBytes ||
      Buffer.from(attestation.attestationHash, 'hex');

    messageBytes = buildAttestationMessage(
      proofTypeValue,
      nullifierBytes,
      attestationHashBytes
    );
  }

  const signature = attestation.signatureBytes || bs58.decode(attestation.signature);
  const publicKey = bs58.decode(attestation.verifier);

  return nacl.sign.detached.verify(messageBytes, signature, publicKey);
}

/**
 * Get the proof type value from string
 */
export function getProofTypeValue(proofType: string): number {
  return PROOF_TYPE_VALUES[proofType] || 0;
}
