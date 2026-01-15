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

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import type { ProofResult, VerificationResult, ProofType } from './types';
import { VouchError, VouchErrorCode } from './types';

// === Debug Mode ===
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(...args: unknown[]): void {
  if (DEBUG) {
    console.log('[Vouch]', ...args);
  }
}

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
const DEFAULT_PROGRAM_ID = 'FGoZca8WMS9EK6TSgDf2cFdGH3uiwH3ThFKfE5KdjGAg';

/** PDA seeds */
const NULLIFIER_SEED = 'nullifier';
const COMMITMENT_SEED = 'commitment';

/** Compute budget settings for ZK proof verification */
const COMPUTE_UNIT_LIMIT = 400_000; // ZK verification is compute-intensive
const COMPUTE_UNIT_PRICE = 1; // microLamports per CU (adjust for priority)

// === Anchor Discriminator Computation ===

/**
 * Compute Anchor instruction discriminator using SHA-256
 * Discriminator = first 8 bytes of sha256("global:<method_name>")
 *
 * This is the standard Anchor discriminator format.
 * Computing dynamically ensures correctness even if method names change.
 */
async function computeDiscriminator(methodName: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(`global:${methodName}`);

  // Create a new ArrayBuffer copy to ensure proper typing for crypto.subtle
  const data = new Uint8Array(encoded).buffer as ArrayBuffer;

  // Use Web Crypto API (available in browsers and Node.js)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer).slice(0, 8);
}

// Cache discriminators to avoid recomputing
const discriminatorCache = new Map<string, Uint8Array>();

async function getDiscriminator(methodName: string): Promise<Uint8Array> {
  const cached = discriminatorCache.get(methodName);
  if (cached) return cached;

  const discriminator = await computeDiscriminator(methodName);
  discriminatorCache.set(methodName, discriminator);
  return discriminator;
}

// === Program ID Management ===

/**
 * Get the verifier program ID from environment or use default
 */
function getVerifierProgramId(): PublicKey {
  const programId = process.env.NEXT_PUBLIC_VERIFIER_PROGRAM_ID || DEFAULT_PROGRAM_ID;
  try {
    return new PublicKey(programId);
  } catch {
    if (DEBUG) console.warn('[Vouch] Invalid program ID, using default');
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
    if (DEBUG) console.error('[Vouch] Error checking nullifier status:', error);
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
    if (DEBUG) console.error('[Vouch] Error checking commitment status:', error);
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

// === Instruction Builders ===

/**
 * Build compute budget instructions for ZK verification
 * These ensure the transaction has enough compute units and sets priority fee
 */
export function buildComputeBudgetInstructions(): TransactionInstruction[] {
  return [
    // Set compute unit limit (ZK verification needs more CUs)
    ComputeBudgetProgram.setComputeUnitLimit({
      units: COMPUTE_UNIT_LIMIT,
    }),
    // Set compute unit price (priority fee in microLamports)
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: COMPUTE_UNIT_PRICE,
    }),
  ];
}

/**
 * Build the init_nullifier instruction
 * Uses dynamically computed Anchor discriminator for correctness
 */
export async function buildInitNullifierInstruction(
  nullifierBytes: Uint8Array,
  nullifierPda: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const programId = getVerifierProgram();

  // Compute Anchor discriminator: sha256("global:init_nullifier")[0..8]
  const discriminator = await getDiscriminator('init_nullifier');

  // Instruction data: discriminator + nullifier (32 bytes)
  const data = Buffer.concat([Buffer.from(discriminator), Buffer.from(nullifierBytes)]);

  return new TransactionInstruction({
    keys: [
      { pubkey: nullifierPda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });
}

/**
 * Build the verify_dev_reputation instruction
 * Uses dynamically computed Anchor discriminator for correctness
 */
export async function buildVerifyDevReputationInstruction(
  proof: Uint8Array,
  publicInputs: Uint8Array,
  minTvl: bigint,
  nullifierPda: PublicKey,
  recipient: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const programId = getVerifierProgram();

  // Compute Anchor discriminator: sha256("global:verify_dev_reputation")[0..8]
  const discriminator = await getDiscriminator('verify_dev_reputation');

  // Build instruction data
  // Format: discriminator + proof_len (4 bytes) + proof + public_inputs_len (4 bytes) + public_inputs + min_tvl (8 bytes)
  const proofLen = Buffer.alloc(4);
  proofLen.writeUInt32LE(proof.length, 0);

  const publicInputsLen = Buffer.alloc(4);
  publicInputsLen.writeUInt32LE(publicInputs.length, 0);

  const minTvlBuf = Buffer.alloc(8);
  minTvlBuf.writeBigUInt64LE(minTvl, 0);

  const data = Buffer.concat([
    Buffer.from(discriminator),
    proofLen,
    Buffer.from(proof),
    publicInputsLen,
    Buffer.from(publicInputs),
    minTvlBuf,
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: nullifierPda, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
    ],
    programId,
    data,
  });
}

/**
 * Build the verify_whale_trading instruction
 * Uses dynamically computed Anchor discriminator for correctness
 */
export async function buildVerifyWhaleTradingInstruction(
  proof: Uint8Array,
  publicInputs: Uint8Array,
  minVolume: bigint,
  nullifierPda: PublicKey,
  recipient: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction> {
  const programId = getVerifierProgram();

  // Compute Anchor discriminator: sha256("global:verify_whale_trading")[0..8]
  const discriminator = await getDiscriminator('verify_whale_trading');

  // Build instruction data (same format as dev reputation)
  const proofLen = Buffer.alloc(4);
  proofLen.writeUInt32LE(proof.length, 0);

  const publicInputsLen = Buffer.alloc(4);
  publicInputsLen.writeUInt32LE(publicInputs.length, 0);

  const minVolumeBuf = Buffer.alloc(8);
  minVolumeBuf.writeBigUInt64LE(minVolume, 0);

  const data = Buffer.concat([
    Buffer.from(discriminator),
    proofLen,
    Buffer.from(proof),
    publicInputsLen,
    Buffer.from(publicInputs),
    minVolumeBuf,
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: nullifierPda, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
    ],
    programId,
    data,
  });
}

// === Proof Submission ===

/** Minimum threshold values */
export const MIN_TVL_THRESHOLD = 10000; // $10,000 USD
export const MIN_VOLUME_THRESHOLD = 50000; // $50,000 USD

/**
 * Submit a proof to the on-chain verifier
 *
 * The verification flow is:
 * 1. Initialize nullifier account
 * 2. Submit proof for verification
 * 3. On-chain program validates and marks nullifier as used
 *
 * @param connection - Solana connection
 * @param proof - The proof result to submit
 * @param proofType - Type of proof (developer or whale)
 * @param payer - The wallet paying for the transaction
 * @param signTransaction - Function to sign the transaction
 * @param recipient - Optional recipient for credential (defaults to payer)
 * @returns Verification result
 */
export async function submitProofToChain(
  connection: Connection,
  proof: ProofResult,
  proofType: ProofType,
  payer: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  recipient?: PublicKey
): Promise<VerificationResult> {
  try {
    debugLog('Starting proof submission...');

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
    const nullifierBytes = Buffer.from(proof.nullifier, 'hex');
    const [nullifierPda] = deriveNullifierPDA(proof.nullifier);

    debugLog('PDAs derived:', {
      program: getVerifierProgram().toBase58(),
      nullifierPda: nullifierPda.toBase58(),
      proofType,
    });

    // Build transaction with both instructions
    const tx = new Transaction();

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer;

    // Add compute budget instructions first (ZK verification is compute-intensive)
    tx.add(...buildComputeBudgetInstructions());

    // Add init_nullifier instruction
    const initNullifierIx = await buildInitNullifierInstruction(
      nullifierBytes,
      nullifierPda,
      payer
    );
    tx.add(initNullifierIx);

    // Add verification instruction based on proof type
    const proofBytes = proof.proof;
    const publicInputsBytes = Buffer.from(
      proof.publicInputs.map(pi => Buffer.from(pi, 'hex')).reduce(
        (acc, buf) => Buffer.concat([acc, buf]),
        Buffer.alloc(0)
      )
    );
    const recipientPubkey = recipient || payer;

    if (proofType === 'developer') {
      const verifyIx = await buildVerifyDevReputationInstruction(
        proofBytes,
        publicInputsBytes,
        BigInt(MIN_TVL_THRESHOLD),
        nullifierPda,
        recipientPubkey,
        payer
      );
      tx.add(verifyIx);
    } else {
      const verifyIx = await buildVerifyWhaleTradingInstruction(
        proofBytes,
        publicInputsBytes,
        BigInt(MIN_VOLUME_THRESHOLD),
        nullifierPda,
        recipientPubkey,
        payer
      );
      tx.add(verifyIx);
    }

    debugLog('Transaction built, requesting signature...');

    // Sign and send transaction
    const signedTx = await signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    debugLog('Transaction sent:', signature);

    // Confirm transaction
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    debugLog('Proof submission completed successfully');

    return {
      success: true,
      signature,
    };
  } catch (error) {
    if (DEBUG) console.error('[Vouch] Proof submission failed:', error);

    // Parse Anchor errors
    const errorMessage = error instanceof Error ? error.message : 'Verification failed';
    let errorCode = VouchErrorCode.TRANSACTION_FAILED;

    if (errorMessage.includes('NullifierAlreadyUsed')) {
      errorCode = VouchErrorCode.NULLIFIER_ALREADY_USED;
    } else if (errorMessage.includes('InvalidProof')) {
      errorCode = VouchErrorCode.PROOF_GENERATION_FAILED;
    }

    return {
      success: false,
      error: errorMessage,
      errorCode,
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
  // Base transaction fee (2 signatures: init + verify)
  const baseFee = 10000; // 0.00001 SOL

  // Rent for nullifier account
  // Account size: 8 (discriminator) + 32 (nullifier) + 1 (is_used) + 8 (used_at) + 1 (proof_type) + 1 (bump)
  const nullifierAccountSize = 8 + 32 + 1 + 8 + 1 + 1;
  const nullifierRent = await connection.getMinimumBalanceForRentExemption(nullifierAccountSize);

  // Total estimated cost
  return baseFee + nullifierRent;
}

/**
 * Check if the program is deployed on the network
 */
export async function isProgramDeployed(connection: Connection): Promise<boolean> {
  try {
    const programId = getVerifierProgram();
    const accountInfo = await connection.getAccountInfo(programId);
    return accountInfo !== null && accountInfo.executable;
  } catch {
    return false;
  }
}
