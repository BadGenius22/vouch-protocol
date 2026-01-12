/**
 * Vouch Protocol - On-chain Verification Helpers
 *
 * This module provides utilities for submitting ZK proofs to the Solana verifier program.
 * It handles:
 * - PDA derivation for nullifier and commitment accounts
 * - Transaction building for proof verification
 * - Nullifier status checking to prevent double-proving
 *
 * Security considerations:
 * - Proofs should be submitted from a burner wallet for privacy
 * - Nullifiers are checked on-chain to prevent replay attacks
 * - All verification happens on-chain, not client-side
 *
 * @see programs/vouch-verifier/src/lib.rs for the on-chain verifier
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import type { ProofResult, VerificationResult, ProofType } from './types';
import { VouchError, VouchErrorCode } from './types';

// === Validation Helpers ===

/** Regex for valid hex strings (64 chars = 32 bytes) */
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;

/**
 * Validate a hex string is exactly 64 characters (32 bytes)
 */
function isValidHex64(hex: string): boolean {
  return typeof hex === 'string' && HEX_64_REGEX.test(hex);
}

// === Constants ===

/** Default verifier program ID (update after deployment) */
const DEFAULT_PROGRAM_ID = 'VouchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

/** PDA seeds */
const NULLIFIER_SEED = 'nullifier';
const COMMITMENT_SEED = 'commitment';

// === Program ID Management ===

/**
 * Get the verifier program ID from environment or use default
 */
function getVerifierProgramId(): PublicKey {
  const programId = process.env.NEXT_PUBLIC_VERIFIER_PROGRAM_ID || DEFAULT_PROGRAM_ID;
  try {
    return new PublicKey(programId);
  } catch {
    console.warn('[Vouch] Invalid program ID, using default');
    return new PublicKey(DEFAULT_PROGRAM_ID);
  }
}

/** Cached program ID */
let VERIFIER_PROGRAM_ID: PublicKey | null = null;

/**
 * Get the verifier program ID (cached)
 */
export function getVerifierProgram(): PublicKey {
  if (!VERIFIER_PROGRAM_ID) {
    VERIFIER_PROGRAM_ID = getVerifierProgramId();
  }
  return VERIFIER_PROGRAM_ID;
}

// === PDA Derivation ===

/**
 * Derive the PDA for a nullifier account
 *
 * The nullifier PDA is used to track which wallets have already proven.
 * Once a proof is verified, the nullifier account is created, preventing
 * the same wallet from proving again for the same proof type.
 *
 * @param nullifier - The nullifier hash (64-char hex string)
 * @returns [PDA address, bump seed]
 * @throws VouchError if nullifier format is invalid
 */
export function deriveNullifierPDA(nullifier: string): [PublicKey, number] {
  if (!isValidHex64(nullifier)) {
    throw new VouchError(
      'Invalid nullifier format: must be 64 hex characters',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  const programId = getVerifierProgram();
  const nullifierBytes = Buffer.from(nullifier, 'hex');

  return PublicKey.findProgramAddressSync(
    [Buffer.from(NULLIFIER_SEED), nullifierBytes],
    programId
  );
}

/**
 * Derive the PDA for a commitment account
 *
 * The commitment PDA can be used to store additional data about a proof,
 * such as the verification timestamp or credential metadata.
 *
 * @param commitment - The commitment hash (64-char hex string)
 * @returns [PDA address, bump seed]
 * @throws VouchError if commitment format is invalid
 */
export function deriveCommitmentPDA(commitment: string): [PublicKey, number] {
  if (!isValidHex64(commitment)) {
    throw new VouchError(
      'Invalid commitment format: must be 64 hex characters',
      VouchErrorCode.INSUFFICIENT_DATA
    );
  }

  const programId = getVerifierProgram();
  const commitmentBytes = Buffer.from(commitment, 'hex');

  return PublicKey.findProgramAddressSync(
    [Buffer.from(COMMITMENT_SEED), commitmentBytes],
    programId
  );
}

// === Nullifier Status ===

/**
 * Check if a nullifier has already been used
 *
 * This is used to:
 * 1. Prevent users from submitting duplicate proofs
 * 2. Show status in the UI before transaction submission
 * 3. Verify that a proof type hasn't been claimed yet
 *
 * @param connection - Solana connection
 * @param nullifier - The nullifier hash (64-char hex string)
 * @returns True if the nullifier has been used, false otherwise
 * @throws VouchError if nullifier format is invalid
 */
export async function isNullifierUsed(
  connection: Connection,
  nullifier: string
): Promise<boolean> {
  try {
    // deriveNullifierPDA validates the format
    const [nullifierPda] = deriveNullifierPDA(nullifier);
    const account = await connection.getAccountInfo(nullifierPda);

    // If account exists, nullifier has been used
    return account !== null;
  } catch (error) {
    if (error instanceof VouchError) {
      throw error;
    }
    console.error('[Vouch] Error checking nullifier status:', error);
    return false;
  }
}

/**
 * Check if a commitment has been registered
 *
 * @param connection - Solana connection
 * @param commitment - The commitment hash (64-char hex string)
 * @returns True if the commitment exists, false otherwise
 * @throws VouchError if commitment format is invalid
 */
export async function isCommitmentRegistered(
  connection: Connection,
  commitment: string
): Promise<boolean> {
  try {
    // deriveCommitmentPDA validates the format
    const [commitmentPda] = deriveCommitmentPDA(commitment);
    const account = await connection.getAccountInfo(commitmentPda);
    return account !== null;
  } catch (error) {
    if (error instanceof VouchError) {
      throw error;
    }
    console.error('[Vouch] Error checking commitment status:', error);
    return false;
  }
}

// === Pre-verification Checks ===

/** Pre-verification check result */
export interface PreVerificationResult {
  canSubmit: boolean;
  nullifierUsed: boolean;
  payerBalance: number;
  estimatedFee: number;
  error?: string;
}

/**
 * Perform pre-verification checks before submitting a proof
 *
 * Checks:
 * 1. Nullifier hasn't been used (prevents double-proving)
 * 2. Payer has sufficient balance for transaction fees
 * 3. Connection is healthy
 *
 * @param connection - Solana connection
 * @param proof - The proof result to verify
 * @param payer - The wallet that will pay for the transaction
 * @returns Object with check results
 */
export async function preVerificationChecks(
  connection: Connection,
  proof: ProofResult,
  payer: PublicKey
): Promise<PreVerificationResult> {
  try {
    // Calculate estimated fee first (uses connection)
    const estimatedFee = await estimateVerificationCost(connection);

    // Check nullifier status
    const nullifierUsed = await isNullifierUsed(connection, proof.nullifier);

    if (nullifierUsed) {
      return {
        canSubmit: false,
        nullifierUsed: true,
        payerBalance: 0,
        estimatedFee,
        error: 'This wallet has already proven for this proof type',
      };
    }

    // Check payer balance
    const payerBalance = await connection.getBalance(payer);

    if (payerBalance < estimatedFee) {
      return {
        canSubmit: false,
        nullifierUsed: false,
        payerBalance,
        estimatedFee,
        error: `Insufficient balance: need ${estimatedFee} lamports, have ${payerBalance}`,
      };
    }

    return {
      canSubmit: true,
      nullifierUsed: false,
      payerBalance,
      estimatedFee,
    };
  } catch (error) {
    return {
      canSubmit: false,
      nullifierUsed: false,
      payerBalance: 0,
      estimatedFee: 0,
      error: error instanceof Error ? error.message : 'Pre-verification check failed',
    };
  }
}

// === Proof Submission ===

/**
 * Submit a proof to the on-chain verifier
 *
 * Note: This is a placeholder implementation. The actual implementation
 * requires the Anchor IDL to be generated and integrated.
 *
 * The verification flow is:
 * 1. Initialize nullifier account (if not exists)
 * 2. Submit proof for verification
 * 3. On-chain program verifies the proof
 * 4. If valid, nullifier is marked as used
 * 5. Optionally mint credential NFT
 *
 * @param connection - Solana connection
 * @param proof - The proof result to submit
 * @param proofType - Type of proof (developer or whale)
 * @param payer - The wallet paying for the transaction
 * @param signTransaction - Function to sign the transaction
 * @returns Verification result
 */
export async function submitProofToChain(
  connection: Connection,
  proof: ProofResult,
  proofType: ProofType,
  payer: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<VerificationResult> {
  try {
    console.log('[Vouch] Starting proof submission...');

    // Perform pre-verification checks
    const checks = await preVerificationChecks(connection, proof, payer);
    if (!checks.canSubmit) {
      return {
        success: false,
        error: checks.error || 'Pre-verification checks failed',
        errorCode: checks.nullifierUsed
          ? VouchErrorCode.NULLIFIER_ALREADY_USED
          : VouchErrorCode.INSUFFICIENT_FUNDS,
      };
    }

    // Derive PDAs
    const [nullifierPda] = deriveNullifierPDA(proof.nullifier);
    const [commitmentPda] = deriveCommitmentPDA(proof.commitment);

    console.log('[Vouch] PDAs derived:', {
      program: getVerifierProgram().toBase58(),
      nullifierPda: nullifierPda.toBase58(),
      commitmentPda: commitmentPda.toBase58(),
      proofType,
    });

    // TODO: Build actual instruction with Anchor IDL
    // const program = new Program(IDL, getVerifierProgram(), provider);
    //
    // Step 1: Initialize nullifier account
    // const initNullifierIx = await program.methods
    //   .initNullifier(Buffer.from(proof.nullifier, 'hex'))
    //   .accounts({
    //     nullifierAccount: nullifierPda,
    //     payer,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .instruction();
    //
    // Step 2: Verify proof
    // const verifyIx = await program.methods
    //   .verifyDevReputation(
    //     Array.from(proof.proof),
    //     proof.publicInputs.map(pi => Array.from(Buffer.from(pi, 'hex'))),
    //     new BN(minTvl)
    //   )
    //   .accounts({
    //     nullifierAccount: nullifierPda,
    //     commitmentAccount: commitmentPda,
    //     payer,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .instruction();
    //
    // const tx = new Transaction().add(initNullifierIx).add(verifyIx);
    // const signedTx = await signTransaction(tx);
    // const signature = await connection.sendRawTransaction(signedTx.serialize());
    // await connection.confirmTransaction(signature);

    // Placeholder response for development
    console.log('[Vouch] Proof submission completed (mock)');

    return {
      success: true,
      signature: 'mock_signature_' + Date.now().toString(36),
    };
  } catch (error) {
    console.error('[Vouch] Proof submission failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
      errorCode: VouchErrorCode.TRANSACTION_FAILED,
    };
  }
}

// === Utility Exports ===

/**
 * Get all PDAs for a proof (useful for debugging)
 */
export function getProofPDAs(proof: ProofResult): {
  nullifierPda: PublicKey;
  nullifierBump: number;
  commitmentPda: PublicKey;
  commitmentBump: number;
} {
  const [nullifierPda, nullifierBump] = deriveNullifierPDA(proof.nullifier);
  const [commitmentPda, commitmentBump] = deriveCommitmentPDA(proof.commitment);

  return {
    nullifierPda,
    nullifierBump,
    commitmentPda,
    commitmentBump,
  };
}

/**
 * Estimate the transaction cost for proof verification
 *
 * @param connection - Solana connection
 * @returns Estimated cost in lamports
 */
export async function estimateVerificationCost(connection: Connection): Promise<number> {
  // Base transaction fee
  const baseFee = 5000; // 0.000005 SOL

  // Rent for nullifier account (estimated)
  // Account size: 8 (discriminator) + 32 (nullifier) + 8 (verified_at) + 1 (is_used)
  const nullifierAccountSize = 8 + 32 + 8 + 1;
  const nullifierRent = await connection.getMinimumBalanceForRentExemption(nullifierAccountSize);

  // Total estimated cost
  return baseFee + nullifierRent;
}
