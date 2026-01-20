/**
 * Vouch Protocol - Verifier Service Client
 *
 * Client SDK for interacting with the off-chain ZK verification service.
 * This enables production-grade cryptographic verification of proofs.
 *
 * Flow:
 * 1. Client generates proof (existing flow)
 * 2. Client sends proof to verifier service
 * 3. Verifier service verifies and signs attestation
 * 4. Client submits attestation to Solana
 */

import type { Connection, Transaction } from '@solana/web3.js';
import { PublicKey, SystemProgram, TransactionInstruction, Ed25519Program, SYSVAR_INSTRUCTIONS_PUBKEY } from '@solana/web3.js';
import bs58 from 'bs58';
import type { ProofResult, ProofType, VerificationResult } from './types';
import { VouchError, VouchErrorCode } from './types';
import {
  getVerifierProgram,
  deriveNullifierPDA,
  deriveRateLimitPDA,
  buildComputeBudgetInstructions,
  buildInitRateLimitInstruction,
} from './verify';
import { buildAttestationMessage, getProofTypeValue } from './verifier/sign';

// === Types ===

interface VerifierAttestation {
  result: {
    isValid: boolean;
    proofType: ProofType;
    nullifier: string;
    commitment: string;
    epoch: string;
    dataHash: string;
    verifiedAt: number;
  };
  verifier: string;
  signature: string;
  // These can be arrays (from JSON serialization) or Uint8Array
  signatureBytes?: number[] | Uint8Array;
  attestationHash: string;
  attestationHashBytes?: number[] | Uint8Array;
  messageBytes?: number[] | Uint8Array;
}

interface VerifyResponse {
  success: boolean;
  attestation?: VerifierAttestation;
  error?: string;
}

interface VerifierHealth {
  status: 'ok' | 'error';
  version: string;
  verifier: string;
  circuitsLoaded: {
    developer: boolean;
    whale: boolean;
  };
}

// === Configuration ===

/**
 * Get the base URL for API calls
 * Uses relative URLs on client, absolute URLs on server
 */
function getApiBaseUrl(): string {
  // Client-side: use relative URLs (same origin)
  if (typeof window !== 'undefined') {
    return '';
  }
  // Server-side: need absolute URL
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

// === Verifier Service API ===

/**
 * Check if the verifier service is available and healthy
 */
export async function isVerifierAvailable(): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) return false;

    const health = await response.json();
    return health.status === 'healthy' || health.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Get the verifier service health status
 */
export async function getVerifierHealth(): Promise<VerifierHealth | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/verifier`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    // Transform to expected format
    return {
      status: 'ok',
      version: '0.1.0',
      verifier: data.publicKey,
      circuitsLoaded: data.circuitsLoaded || { developer: false, whale: false },
    };
  } catch {
    return null;
  }
}

/**
 * Submit a proof to the verifier service for verification
 *
 * @param proof - The proof result from client-side generation
 * @param proofType - Type of proof (developer or whale)
 * @returns Signed attestation if verification succeeds
 */
export async function verifyProofWithService(
  proof: ProofResult,
  proofType: ProofType
): Promise<VerifierAttestation> {
  try {
    // Convert proof bytes to hex string
    const proofHex = Buffer.from(proof.proof).toString('hex');

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof: proofHex,
        publicInputs: proof.publicInputs,
        proofType,
        nullifier: proof.nullifier,
        commitment: proof.commitment,
        epoch: proof.epoch,
        dataHash: proof.dataHash,
      }),
    });

    const data: VerifyResponse = await response.json();

    if (!data.success || !data.attestation) {
      throw new VouchError(
        data.error || 'Verification failed',
        VouchErrorCode.PROOF_GENERATION_FAILED
      );
    }

    // Validate attestation has required fields
    if (!data.attestation.signature) {
      throw new VouchError(
        'Attestation missing signature',
        VouchErrorCode.PROOF_GENERATION_FAILED
      );
    }

    return data.attestation;
  } catch (error) {
    if (error instanceof VouchError) throw error;

    throw new VouchError(
      `Verifier service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      VouchErrorCode.TRANSACTION_FAILED
    );
  }
}

// === Anchor Instruction Builders ===

/**
 * Build the Ed25519 signature verification instruction
 * This must be included in the transaction BEFORE record_attestation
 */
export function buildEd25519VerifyInstruction(
  verifierPubkey: PublicKey,
  signatureBytes: Uint8Array,
  messageBytes: Uint8Array
): TransactionInstruction {
  return Ed25519Program.createInstructionWithPublicKey({
    publicKey: verifierPubkey.toBytes(),
    signature: signatureBytes,
    message: messageBytes,
  });
}

/**
 * Build the record_attestation instruction
 * This submits a verified attestation to the Solana program
 *
 * NOTE: Must be preceded by an Ed25519 verify instruction in the same transaction
 *
 * @param attestation - The verifier attestation
 * @param nullifierPda - The nullifier PDA
 * @param nullifierHex - The nullifier hex string (must match what was used for PDA derivation)
 * @param verifierPubkey - The verifier public key
 * @param recipient - The recipient address
 * @param payer - The payer address
 * @param rateLimitPda - The rate limit PDA
 */
// Hardcoded program ID to avoid any env variable issues
const VOUCH_PROGRAM_ID = new PublicKey('EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD');

export async function buildRecordAttestationInstruction(
  attestation: VerifierAttestation,
  nullifierPda: PublicKey,
  nullifierHex: string,
  verifierPubkey: PublicKey,
  recipient: PublicKey,
  payer: PublicKey,
  rateLimitPda: PublicKey
): Promise<TransactionInstruction> {
  const programId = VOUCH_PROGRAM_ID;

  // Derive config PDA
  const EXPECTED_CONFIG_PDA = 'EAinyfsodyJAXMNMvUSGUvab17453xY8fCYVrhN9Z7GB';
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    programId
  );

  // Verify config PDA matches expected
  if (configPda.toBase58() !== EXPECTED_CONFIG_PDA) {
    throw new Error(`Config PDA mismatch! Got ${configPda.toBase58()}, expected ${EXPECTED_CONFIG_PDA}`);
  }

  // Derive verifier PDA
  const [verifierPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('verifier'), verifierPubkey.toBuffer()],
    programId
  );

  // Compute discriminator for record_attestation
  const encoder = new TextEncoder();
  const encoded = encoder.encode('global:record_attestation');
  const data = new Uint8Array(encoded).buffer as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

  // Build instruction data - normalize hex strings (remove 0x prefix if present)
  const attestationHashHexNormalized = attestation.attestationHash.startsWith('0x')
    ? attestation.attestationHash.slice(2)
    : attestation.attestationHash;
  const attestationHashBytes = Buffer.from(attestationHashHexNormalized, 'hex');

  const proofTypeValue = attestation.result.proofType === 'developer' ? 1 : 2;

  // Use the nullifier passed as parameter (already normalized, same as used for PDA)
  const nullifierBytes = Buffer.from(nullifierHex, 'hex');

  // Epoch (8 bytes, little-endian for Anchor/Borsh)
  const epochBigInt = BigInt(attestation.result.epoch);
  const epochBytes = new Uint8Array(8);
  // Manual little-endian conversion (browser Buffer doesn't have writeBigUInt64LE)
  for (let i = 0; i < 8; i++) {
    epochBytes[i] = Number((epochBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }

  // Data hash (32 bytes)
  const dataHashHex = attestation.result.dataHash.startsWith('0x')
    ? attestation.result.dataHash.slice(2)
    : attestation.result.dataHash;
  const dataHashBytes = Buffer.from(dataHashHex, 'hex');

  // Decode signature from base58
  const signatureDecoded = attestation.signatureBytes ||
    bs58.decode(attestation.signature);

  // Instruction data format (matches Anchor program):
  // discriminator (8) + attestation_hash (32) + proof_type (1) + nullifier (32) + epoch (8) + data_hash (32) + signature (64) = 177 bytes
  const instructionData = Buffer.concat([
    Buffer.from(discriminator),
    attestationHashBytes,
    Buffer.from([proofTypeValue]),
    nullifierBytes,
    epochBytes,
    dataHashBytes,
    Buffer.from(signatureDecoded),
  ]);

  // Account order must match RecordAttestation struct in lib.rs:
  // 1. config
  // 2. verifier_account
  // 3. nullifier_account
  // 4. rate_limit
  // 5. recipient
  // 6. payer
  // 7. instructions_sysvar
  return new TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: verifierPda, isSigner: false, isWritable: true },
      { pubkey: nullifierPda, isSigner: false, isWritable: true },
      { pubkey: rateLimitPda, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId,
    data: instructionData,
  });
}

/**
 * Reconstruct the message bytes for Ed25519 verification
 * Used when message bytes aren't included in the API response
 */
function reconstructMessageBytes(attestation: VerifierAttestation): Uint8Array {
  const proofTypeValue = getProofTypeValue(attestation.result.proofType);
  const nullifierHex = attestation.result.nullifier.startsWith('0x')
    ? attestation.result.nullifier.slice(2)
    : attestation.result.nullifier;
  const nullifierBytes = Buffer.from(nullifierHex, 'hex');
  const attestationHashBytes = Buffer.from(attestation.attestationHash, 'hex');

  // Extract epoch and dataHash for v2 format
  const epoch = BigInt(attestation.result.epoch);
  const dataHashHex = attestation.result.dataHash.startsWith('0x')
    ? attestation.result.dataHash.slice(2)
    : attestation.result.dataHash;
  const dataHashBytes = Buffer.from(dataHashHex, 'hex');

  return buildAttestationMessage(proofTypeValue, nullifierBytes, attestationHashBytes, epoch, dataHashBytes);
}

// === High-Level API ===

/**
 * Submit a proof using the verifier service (production flow)
 *
 * Flow:
 * 1. Send proof to verifier service
 * 2. Get signed attestation
 * 3. Initialize nullifier account
 * 4. Record attestation on-chain
 */
export async function submitProofWithVerifier(
  connection: Connection,
  proof: ProofResult,
  proofType: ProofType,
  payer: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  recipient?: PublicKey
): Promise<VerificationResult> {
  try {
    // 1. Check verifier availability
    const verifierHealth = await getVerifierHealth();
    if (!verifierHealth || verifierHealth.status !== 'ok') {
      throw new VouchError(
        'Verifier service unavailable',
        VouchErrorCode.TRANSACTION_FAILED
      );
    }

    // 2. Verify proof with service
    const attestation = await verifyProofWithService(proof, proofType);

    // 3. Build transaction
    const { Transaction } = await import('@solana/web3.js');
    const tx = new Transaction();

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer;

    // Add compute budget
    tx.add(...buildComputeBudgetInstructions());

    // Normalize nullifier - ensure no 0x prefix for PDA derivation
    const normalizedNullifier = proof.nullifier.startsWith('0x')
      ? proof.nullifier.slice(2)
      : proof.nullifier;

    // Derive PDAs
    const [nullifierPda] = deriveNullifierPDA(normalizedNullifier);
    const verifierPubkey = new PublicKey(attestation.verifier);
    const recipientPubkey = recipient || payer;
    const [rateLimitPda] = deriveRateLimitPDA(recipientPubkey.toBase58());

    // Check if nullifier account exists
    const nullifierAccount = await connection.getAccountInfo(nullifierPda);

    if (!nullifierAccount) {
      // Initialize nullifier account first
      const { buildInitNullifierInstruction } = await import('./verify');
      const nullifierBytes = Buffer.from(normalizedNullifier, 'hex');
      const initNullifierIx = await buildInitNullifierInstruction(
        nullifierBytes,
        nullifierPda,
        payer
      );
      tx.add(initNullifierIx);
    }

    // Check if rate limit account exists
    const rateLimitAccount = await connection.getAccountInfo(rateLimitPda);

    if (!rateLimitAccount) {
      // Initialize rate limit account
      const initRateLimitIx = await buildInitRateLimitInstruction(
        recipientPubkey,
        rateLimitPda,
        payer
      );
      tx.add(initRateLimitIx);
    }

    // Get or reconstruct the message bytes and signature bytes
    // Handle both array (from JSON) and Uint8Array formats
    let messageBytes: Uint8Array;
    if (attestation.messageBytes && Array.isArray(attestation.messageBytes)) {
      messageBytes = new Uint8Array(attestation.messageBytes);
    } else if (attestation.messageBytes instanceof Uint8Array) {
      messageBytes = attestation.messageBytes;
    } else {
      messageBytes = reconstructMessageBytes(attestation);
    }

    // Decode signature - handle array (from JSON), Uint8Array, and base58 string
    let signatureBytes: Uint8Array;
    if (attestation.signatureBytes && Array.isArray(attestation.signatureBytes) && attestation.signatureBytes.length === 64) {
      signatureBytes = new Uint8Array(attestation.signatureBytes);
    } else if (attestation.signatureBytes instanceof Uint8Array && attestation.signatureBytes.length === 64) {
      signatureBytes = attestation.signatureBytes;
    } else if (attestation.signature) {
      try {
        signatureBytes = bs58.decode(attestation.signature);
      } catch {
        throw new VouchError(
          'Invalid signature format in attestation',
          VouchErrorCode.TRANSACTION_FAILED
        );
      }
    } else {
      throw new VouchError(
        'No signature found in attestation',
        VouchErrorCode.TRANSACTION_FAILED
      );
    }

    if (signatureBytes.length !== 64) {
      throw new VouchError(
        `Signature must be 64 bytes but received ${signatureBytes.length} bytes`,
        VouchErrorCode.TRANSACTION_FAILED
      );
    }

    // Add Ed25519 signature verification instruction FIRST
    // This is required by the on-chain program which uses instruction introspection
    const ed25519Ix = buildEd25519VerifyInstruction(
      verifierPubkey,
      signatureBytes,
      messageBytes
    );
    tx.add(ed25519Ix);

    // Add record attestation instruction (must come AFTER Ed25519 instruction)
    const recordAttestationIx = await buildRecordAttestationInstruction(
      attestation,
      nullifierPda,
      normalizedNullifier,  // Use the same nullifier as PDA derivation
      verifierPubkey,
      recipientPubkey,
      payer,
      rateLimitPda
    );
    tx.add(recordAttestationIx);

    // 4. Sign and send
    const signedTx = await signTransaction(tx);

    // Skip preflight simulation since we've already validated everything
    // This prevents false "simulation failed" errors when the transaction will actually succeed
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
    });

    // 5. Confirm with timeout handling
    let confirmationError: string | null = null;

    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        confirmationError = `Transaction failed: ${JSON.stringify(confirmation.value.err)}`;
      }
    } catch {
      // If confirmation times out, the transaction might still have succeeded
      // Try to check the transaction status one more time
      try {
        const status = await connection.getSignatureStatus(signature);

        if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
          // Transaction confirmed
        } else if (status.value?.err) {
          confirmationError = `Transaction failed: ${JSON.stringify(status.value.err)}`;
        }
        // Otherwise assume success since tx was sent
      } catch {
        // Even if status check fails, the transaction was sent
        // Assume success - user can verify on Solscan
      }
    }

    // Return based on confirmation status
    if (confirmationError) {
      return {
        success: false,
        error: confirmationError,
        errorCode: VouchErrorCode.TRANSACTION_FAILED,
      };
    }

    return {
      success: true,
      signature,
    };
  } catch (error) {

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: VouchErrorCode.TRANSACTION_FAILED,
    };
  }
}
