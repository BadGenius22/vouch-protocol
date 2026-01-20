/**
 * Vouch Protocol - Attestation Signing (Serverless)
 *
 * Signs verification results using Ed25519 so they can be verified on-chain.
 * The verifier's public key is registered on the Solana program.
 *
 * IMPORTANT: Message format must match Anchor program's build_attestation_message_v2
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

// === Constants ===

// Domain separator must match Anchor program (20 bytes)
const DOMAIN_SEPARATOR = 'vouch_attestation_v2';

// Proof type values must match Anchor program's ProofType enum
const PROOF_TYPE_VALUES: Record<string, number> = {
  developer: 1, // ProofType::DeveloperReputation
  whale: 2,     // ProofType::WhaleTrading
};

/**
 * Create a signed attestation from a verification result
 *
 * The attestation includes:
 * - The verification result
 * - Verifier's public key
 * - Ed25519 signature (over binary message matching Anchor format)
 * - Attestation hash for on-chain storage
 * - Message bytes (for Ed25519 instruction)
 */
export function signAttestation(result: VerificationResult): SignedAttestation {
  if (!verifierKeypair) {
    initializeVerifier();
  }

  const bs58 = require('bs58');
  const crypto = require('crypto');
  const nacl = require('tweetnacl');

  // First compute attestation hash from verification metadata
  const metadataForHash = `${result.isValid}|${result.proofType}|${result.verifiedAt}`;
  const attestationHash = crypto
    .createHash('sha256')
    .update(metadataForHash)
    .digest();

  // Build binary message matching Anchor's build_attestation_message_v2
  // Format: domain (20) | proof_type (1) | nullifier (32) | epoch (8) | data_hash (32) | attestation_hash (32) = 125 bytes
  const messageBytes = buildAttestationMessageV2(result, attestationHash);

  // Sign with Ed25519 using nacl
  const signatureBytes = nacl.sign.detached(messageBytes, verifierKeypair!.secretKey);

  return {
    result,
    verifier: verifierKeypair!.publicKey.toBase58(),
    signature: bs58.encode(signatureBytes),
    // Convert Uint8Array to regular array for JSON serialization
    signatureBytes: Array.from(signatureBytes),
    attestationHash: attestationHash.toString('hex'),
    attestationHashBytes: Array.from(attestationHash),
    messageBytes: Array.from(messageBytes),
  };
}

/**
 * Build binary attestation message matching Anchor's build_attestation_message_v2
 *
 * Format (125 bytes total):
 * - Domain separator: "vouch_attestation_v2" (20 bytes)
 * - Proof type: u8 (1 byte)
 * - Nullifier: [u8; 32] (32 bytes)
 * - Epoch: u64 big-endian (8 bytes)
 * - Data hash: [u8; 32] (32 bytes)
 * - Attestation hash: [u8; 32] (32 bytes)
 */
function buildAttestationMessageV2(
  result: VerificationResult,
  attestationHash: Uint8Array
): Uint8Array {
  const message = new Uint8Array(125);

  // Domain separator (20 bytes)
  const domainBytes = new TextEncoder().encode(DOMAIN_SEPARATOR);
  message.set(domainBytes, 0);

  // Proof type (1 byte)
  const proofTypeValue = PROOF_TYPE_VALUES[result.proofType] ?? 0;
  message[20] = proofTypeValue;

  // Nullifier (32 bytes) - convert hex to bytes
  const nullifierBytes = hexToBytes(result.nullifier);
  message.set(nullifierBytes, 21);

  // Epoch (8 bytes, big-endian)
  const epochBigInt = BigInt(result.epoch);
  const epochBytes = bigIntToBytes8BE(epochBigInt);
  message.set(epochBytes, 53);

  // Data hash (32 bytes) - convert hex to bytes
  const dataHashBytes = hexToBytes(result.dataHash);
  message.set(dataHashBytes, 61);

  // Attestation hash (32 bytes)
  message.set(attestationHash, 93);

  return message;
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
 * Convert BigInt to 8 bytes big-endian
 */
function bigIntToBytes8BE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  const mask = BigInt(0xFF);
  bytes[0] = Number((value >> BigInt(56)) & mask);
  bytes[1] = Number((value >> BigInt(48)) & mask);
  bytes[2] = Number((value >> BigInt(40)) & mask);
  bytes[3] = Number((value >> BigInt(32)) & mask);
  bytes[4] = Number((value >> BigInt(24)) & mask);
  bytes[5] = Number((value >> BigInt(16)) & mask);
  bytes[6] = Number((value >> BigInt(8)) & mask);
  bytes[7] = Number(value & mask);
  return bytes;
}

/**
 * Verify an attestation signature (for testing)
 */
export function verifyAttestationSignature(attestation: SignedAttestation): boolean {
  const nacl = require('tweetnacl');
  const bs58 = require('bs58');
  const crypto = require('crypto');

  // Recompute attestation hash
  const metadataForHash = `${attestation.result.isValid}|${attestation.result.proofType}|${attestation.result.verifiedAt}`;
  const attestationHash = crypto
    .createHash('sha256')
    .update(metadataForHash)
    .digest();

  // Rebuild the message
  const messageBytes = buildAttestationMessageV2(attestation.result, attestationHash);

  // Handle both array (from JSON) and Uint8Array formats for signature
  const signature = attestation.signatureBytes
    ? new Uint8Array(attestation.signatureBytes)
    : bs58.decode(attestation.signature);
  const publicKey = bs58.decode(attestation.verifier);

  return nacl.sign.detached.verify(messageBytes, signature, publicKey);
}

/**
 * Get the proof type value from string
 */
export function getProofTypeValue(proofType: string): number {
  return PROOF_TYPE_VALUES[proofType] || 0;
}

/**
 * Build attestation message for client-side reconstruction
 * Exported for use by verifier-client.ts
 */
export function buildAttestationMessage(
  proofTypeValue: number,
  nullifier: Uint8Array,
  attestationHash: Uint8Array,
  epoch?: bigint,
  dataHash?: Uint8Array
): Uint8Array {
  // If epoch and dataHash provided, use v2 format
  if (epoch !== undefined && dataHash !== undefined) {
    const message = new Uint8Array(125);

    // Domain separator (20 bytes)
    const domainBytes = new TextEncoder().encode(DOMAIN_SEPARATOR);
    message.set(domainBytes, 0);

    // Proof type (1 byte)
    message[20] = proofTypeValue;

    // Nullifier (32 bytes)
    message.set(nullifier.slice(0, 32), 21);

    // Epoch (8 bytes, big-endian)
    const epochBytes = bigIntToBytes8BE(epoch);
    message.set(epochBytes, 53);

    // Data hash (32 bytes)
    message.set(dataHash.slice(0, 32), 61);

    // Attestation hash (32 bytes)
    message.set(attestationHash.slice(0, 32), 93);

    return message;
  }

  // Legacy v1 format (82 bytes) - should not be used anymore
  throw new Error('Legacy v1 attestation format is no longer supported. Epoch and dataHash are required.');
}
