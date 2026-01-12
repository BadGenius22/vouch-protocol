/**
 * Vouch Protocol - On-chain Verification Helpers
 * Utilities for submitting proofs to the Solana verifier program
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import type { ProofResult, VerificationResult, ProofType } from './types';

// Program ID (update after deployment)
const VERIFIER_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VERIFIER_PROGRAM_ID || 'VouchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
);

/**
 * Submit a proof to the on-chain verifier
 */
export async function submitProofToChain(
  connection: Connection,
  proof: ProofResult,
  proofType: ProofType,
  payer: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<VerificationResult> {
  try {
    // Derive PDA for nullifier account
    const [nullifierPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nullifier'), Buffer.from(proof.nullifier, 'hex')],
      VERIFIER_PROGRAM_ID
    );

    // TODO: Build actual instruction with Anchor IDL
    // const program = new Program(IDL, VERIFIER_PROGRAM_ID, provider);
    // const tx = await program.methods
    //   .verifyDevReputation(proof.proof, proof.publicInputs, ...)
    //   .accounts({ nullifierAccount: nullifierPda, ... })
    //   .transaction();

    console.log('[Vouch] Would submit proof to:', {
      program: VERIFIER_PROGRAM_ID.toBase58(),
      nullifierPda: nullifierPda.toBase58(),
      proofType,
    });

    return {
      success: true,
      signature: 'mock_signature_' + Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Check if a nullifier has been used
 */
export async function isNullifierUsed(
  connection: Connection,
  nullifier: string
): Promise<boolean> {
  try {
    const [nullifierPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('nullifier'), Buffer.from(nullifier, 'hex')],
      VERIFIER_PROGRAM_ID
    );

    const account = await connection.getAccountInfo(nullifierPda);
    return account !== null;
  } catch {
    return false;
  }
}

/**
 * Get the verifier program ID
 */
export function getVerifierProgramId(): PublicKey {
  return VERIFIER_PROGRAM_ID;
}
