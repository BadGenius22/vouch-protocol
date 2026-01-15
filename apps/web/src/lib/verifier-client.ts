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
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import type { ProofResult, ProofType, VerificationResult } from './types';
import { VouchError, VouchErrorCode } from './types';
import {
  getVerifierProgram,
  deriveNullifierPDA,
  buildComputeBudgetInstructions,
} from './verify';

// === Types ===

interface VerifierAttestation {
  result: {
    isValid: boolean;
    proofType: ProofType;
    nullifier: string;
    commitment: string;
    verifiedAt: number;
  };
  verifier: string;
  signature: string;
  attestationHash: string;
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

const VERIFIER_URL = process.env.NEXT_PUBLIC_VERIFIER_URL || 'http://localhost:3001';

// === Verifier Service API ===

/**
 * Check if the verifier service is available and healthy
 */
export async function isVerifierAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${VERIFIER_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) return false;

    const health: VerifierHealth = await response.json();
    return health.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Get the verifier service health status
 */
export async function getVerifierHealth(): Promise<VerifierHealth | null> {
  try {
    const response = await fetch(`${VERIFIER_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) return null;

    return await response.json();
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

    const response = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof: proofHex,
        publicInputs: proof.publicInputs,
        proofType,
        nullifier: proof.nullifier,
        commitment: proof.commitment,
      }),
    });

    const data: VerifyResponse = await response.json();

    if (!data.success || !data.attestation) {
      throw new VouchError(
        data.error || 'Verification failed',
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
 * Build the record_attestation instruction
 * This submits a verified attestation to the Solana program
 */
export async function buildRecordAttestationInstruction(
  attestation: VerifierAttestation,
  nullifierPda: PublicKey,
  verifierPubkey: PublicKey,
  recipient: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const programId = getVerifierProgram();

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

  // Build instruction data
  const attestationHashBytes = Buffer.from(attestation.attestationHash, 'hex');
  const proofTypeValue = attestation.result.proofType === 'developer' ? 1 : 2;
  const nullifierBytes = Buffer.from(attestation.result.nullifier, 'hex');
  const signatureBytes = Buffer.from(attestation.signature, 'base64'); // Base58 decode

  // Actually decode from base58
  const bs58 = await import('bs58');
  const signatureDecoded = bs58.default.decode(attestation.signature);

  const instructionData = Buffer.concat([
    Buffer.from(discriminator),
    attestationHashBytes,
    Buffer.from([proofTypeValue]),
    nullifierBytes,
    signatureDecoded,
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: verifierPda, isSigner: false, isWritable: false },
      { pubkey: nullifierPda, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
    ],
    programId,
    data: instructionData,
  });
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
    console.log('[Vouch] Verifying proof with service...');
    const attestation = await verifyProofWithService(proof, proofType);
    console.log('[Vouch] Proof verified, attestation received');

    // 3. Build transaction
    const { Transaction } = await import('@solana/web3.js');
    const tx = new Transaction();

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer;

    // Add compute budget
    tx.add(...buildComputeBudgetInstructions());

    // Derive PDAs
    const [nullifierPda] = deriveNullifierPDA(proof.nullifier);
    const verifierPubkey = new PublicKey(attestation.verifier);
    const recipientPubkey = recipient || payer;

    // Check if nullifier account exists
    const nullifierAccount = await connection.getAccountInfo(nullifierPda);

    if (!nullifierAccount) {
      // Initialize nullifier account first
      const { buildInitNullifierInstruction } = await import('./verify');
      const nullifierBytes = Buffer.from(proof.nullifier, 'hex');
      const initNullifierIx = await buildInitNullifierInstruction(
        nullifierBytes,
        nullifierPda,
        payer
      );
      tx.add(initNullifierIx);
    }

    // Add record attestation instruction
    const recordAttestationIx = await buildRecordAttestationInstruction(
      attestation,
      nullifierPda,
      verifierPubkey,
      recipientPubkey,
      payer
    );
    tx.add(recordAttestationIx);

    // 4. Sign and send
    console.log('[Vouch] Signing transaction...');
    const signedTx = await signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log('[Vouch] Transaction sent:', signature);

    // 5. Confirm
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('[Vouch] Attestation recorded successfully');

    return {
      success: true,
      signature,
    };
  } catch (error) {
    console.error('[Vouch] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: VouchErrorCode.TRANSACTION_FAILED,
    };
  }
}
