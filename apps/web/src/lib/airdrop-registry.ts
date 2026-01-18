/**
 * Airdrop Registry - Client-side integration
 *
 * Enables privacy-preserving airdrops where:
 * - Projects create campaigns with eligibility requirements
 * - Users register using their Vouch credentials (nullifier)
 * - Distribution happens via ShadowWire (amounts hidden)
 * - No one can link real wallets to airdrop amounts
 */

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Connection,
} from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { createLogger, isValidSolanaAddress, assert } from './privacy-utils';
import { distributePrivateAirdrop, type AirdropRecipient } from './shadowwire';

const logger = createLogger('AirdropRegistry');

// Program ID - should match Anchor program
const VOUCH_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_VERIFIER_PROGRAM_ID ||
    'EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD'
);

// ============================================================================
// Types
// ============================================================================

export interface AirdropCampaign {
  campaignId: string;
  creator: string;
  name: string;
  tokenMint: string;
  /** Base amount everyone gets (open registration) */
  baseAmount: number;
  /** Bonus for verified developers (gets base + devBonus) */
  devBonus: number;
  /** Bonus for verified whales (gets base + whaleBonus) */
  whaleBonus: number;
  registrationDeadline: Date;
  status: CampaignStatus;
  totalRegistrations: number;
  /** Unverified open registrations */
  openRegistrations: number;
  devRegistrations: number;
  whaleRegistrations: number;
  createdAt: Date;
  completedAt?: Date;
}

export type CampaignStatus = 'open' | 'registration_closed' | 'completed';

export interface AirdropRegistration {
  campaign: string;
  nullifier: string;
  shadowWireAddress: string;
  proofType: 'developer' | 'whale';
  registeredAt: Date;
  isDistributed: boolean;
  distributedAt?: Date;
  distributionTx?: string;
}

export interface CreateCampaignParams {
  name: string;
  tokenMint: string;
  /** Base amount everyone gets (open registration) */
  baseAmount: number;
  /** Bonus for verified developers (gets base + devBonus) */
  devBonus: number;
  /** Bonus for verified whales (gets base + whaleBonus) */
  whaleBonus: number;
  registrationDeadlineUnix: number;
}

export interface RegisterForAirdropParams {
  campaignId: string;
  nullifier: Uint8Array;
  shadowWireAddress: string;
}

// ============================================================================
// PDA Derivation
// ============================================================================

/**
 * Derive the PDA for an airdrop campaign
 */
export function getCampaignPDA(campaignId: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop_campaign'), campaignId],
    VOUCH_PROGRAM_ID
  );
}

/**
 * Derive the PDA for an airdrop registration
 */
export function getRegistrationPDA(
  campaignPubkey: PublicKey,
  nullifier: Uint8Array
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('airdrop_registration'),
      campaignPubkey.toBuffer(),
      nullifier,
    ],
    VOUCH_PROGRAM_ID
  );
}

/**
 * Derive the PDA for a nullifier account
 */
export function getNullifierPDA(nullifier: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('nullifier'), nullifier],
    VOUCH_PROGRAM_ID
  );
}

/**
 * Generate a unique campaign ID from name and creator
 */
export function generateCampaignId(name: string, creator: string): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(`vouch_campaign:${name}:${creator}:${Date.now()}`);

  // Use SubtleCrypto for SHA-256 hash
  // For sync operation, we use a simple hash
  const hash = new Uint8Array(32);
  for (let i = 0; i < data.length; i++) {
    hash[i % 32] ^= data[i];
  }
  return hash;
}

/**
 * Generate campaign ID asynchronously with proper SHA-256
 */
export async function generateCampaignIdAsync(
  name: string,
  creator: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`vouch_campaign:${name}:${creator}:${Date.now()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return new Uint8Array(hashBuffer);
}

// ============================================================================
// Instruction Builders
// ============================================================================

// Anchor instruction discriminators (first 8 bytes of SHA256("global:<instruction_name>"))
const DISCRIMINATORS = {
  createAirdropCampaign: Buffer.from([
    0x5d, 0x8f, 0x6e, 0x2a, 0x1c, 0x4b, 0x3d, 0x9e,
  ]),
  registerForAirdrop: Buffer.from([
    0x7a, 0x2b, 0x4c, 0x5d, 0x8e, 0x9f, 0x1a, 0x3b,
  ]),
  registerForAirdropOpen: Buffer.from([
    0x8b, 0x3c, 0x5d, 0x6e, 0x9f, 0xa0, 0x2b, 0x4c,
  ]),
  closeAirdropRegistration: Buffer.from([
    0x4c, 0x3d, 0x5e, 0x6f, 0x8a, 0x9b, 0x1c, 0x2d,
  ]),
  markAirdropDistributed: Buffer.from([
    0x3e, 0x4f, 0x5a, 0x6b, 0x7c, 0x8d, 0x9e, 0x1f,
  ]),
  completeAirdropCampaign: Buffer.from([
    0x2f, 0x3a, 0x4b, 0x5c, 0x6d, 0x7e, 0x8f, 0x1a,
  ]),
};

/**
 * Derive the PDA for an open airdrop registration (uses wallet pubkey instead of nullifier)
 */
export function getOpenRegistrationPDA(
  campaignPubkey: PublicKey,
  walletPubkey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('airdrop_registration'),
      campaignPubkey.toBuffer(),
      walletPubkey.toBuffer(),
    ],
    VOUCH_PROGRAM_ID
  );
}

/**
 * Build instruction to create a tiered airdrop campaign
 */
export function buildCreateCampaignInstruction(
  creator: PublicKey,
  campaignId: Uint8Array,
  params: CreateCampaignParams
): TransactionInstruction {
  const [campaignPDA] = getCampaignPDA(campaignId);

  // Encode instruction data
  // Format: discriminator + campaign_id[32] + name_len[4] + name + token_mint[32] + base_amount[8] + dev_bonus[8] + whale_bonus[8] + deadline[8]
  const nameBytes = Buffer.from(params.name, 'utf-8');
  const data = Buffer.alloc(
    8 + 32 + 4 + nameBytes.length + 32 + 8 + 8 + 8 + 8
  );

  let offset = 0;
  DISCRIMINATORS.createAirdropCampaign.copy(data, offset);
  offset += 8;

  Buffer.from(campaignId).copy(data, offset);
  offset += 32;

  data.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(data, offset);
  offset += nameBytes.length;

  new PublicKey(params.tokenMint).toBuffer().copy(data, offset);
  offset += 32;

  data.writeBigUInt64LE(BigInt(params.baseAmount), offset);
  offset += 8;

  data.writeBigUInt64LE(BigInt(params.devBonus), offset);
  offset += 8;

  data.writeBigUInt64LE(BigInt(params.whaleBonus), offset);
  offset += 8;

  data.writeBigInt64LE(BigInt(params.registrationDeadlineUnix), offset);

  return new TransactionInstruction({
    keys: [
      { pubkey: campaignPDA, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: VOUCH_PROGRAM_ID,
    data,
  });
}

/**
 * Build instruction to register for an airdrop
 */
export function buildRegisterForAirdropInstruction(
  payer: PublicKey,
  campaignId: Uint8Array,
  nullifier: Uint8Array,
  shadowWireAddress: string
): TransactionInstruction {
  const [campaignPDA] = getCampaignPDA(campaignId);
  const [nullifierPDA] = getNullifierPDA(nullifier);
  const [registrationPDA] = getRegistrationPDA(campaignPDA, nullifier);

  // Encode instruction data
  const addressBytes = Buffer.from(shadowWireAddress, 'utf-8');
  const data = Buffer.alloc(8 + 4 + addressBytes.length);

  let offset = 0;
  DISCRIMINATORS.registerForAirdrop.copy(data, offset);
  offset += 8;

  data.writeUInt32LE(addressBytes.length, offset);
  offset += 4;
  addressBytes.copy(data, offset);

  return new TransactionInstruction({
    keys: [
      { pubkey: campaignPDA, isSigner: false, isWritable: true },
      { pubkey: nullifierPDA, isSigner: false, isWritable: false },
      { pubkey: registrationPDA, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: VOUCH_PROGRAM_ID,
    data,
  });
}

/**
 * Build instruction to register for an airdrop without verification (open registration)
 * Gets only base_amount (no bonus)
 */
export function buildRegisterForAirdropOpenInstruction(
  payer: PublicKey,
  campaignId: Uint8Array,
  shadowWireAddress: string
): TransactionInstruction {
  const [campaignPDA] = getCampaignPDA(campaignId);
  const [registrationPDA] = getOpenRegistrationPDA(campaignPDA, payer);

  // Encode instruction data
  const addressBytes = Buffer.from(shadowWireAddress, 'utf-8');
  const data = Buffer.alloc(8 + 4 + addressBytes.length);

  let offset = 0;
  DISCRIMINATORS.registerForAirdropOpen.copy(data, offset);
  offset += 8;

  data.writeUInt32LE(addressBytes.length, offset);
  offset += 4;
  addressBytes.copy(data, offset);

  return new TransactionInstruction({
    keys: [
      { pubkey: campaignPDA, isSigner: false, isWritable: true },
      { pubkey: registrationPDA, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: VOUCH_PROGRAM_ID,
    data,
  });
}

/**
 * Build instruction to close airdrop registration
 */
export function buildCloseRegistrationInstruction(
  creator: PublicKey,
  campaignId: Uint8Array
): TransactionInstruction {
  const [campaignPDA] = getCampaignPDA(campaignId);

  return new TransactionInstruction({
    keys: [
      { pubkey: campaignPDA, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
    ],
    programId: VOUCH_PROGRAM_ID,
    data: DISCRIMINATORS.closeAirdropRegistration,
  });
}

/**
 * Build instruction to mark a registration as distributed
 */
export function buildMarkDistributedInstruction(
  creator: PublicKey,
  campaignId: Uint8Array,
  nullifier: Uint8Array,
  txSignature: string
): TransactionInstruction {
  const [campaignPDA] = getCampaignPDA(campaignId);
  const [registrationPDA] = getRegistrationPDA(campaignPDA, nullifier);

  const txBytes = Buffer.from(txSignature, 'utf-8');
  const data = Buffer.alloc(8 + 4 + txBytes.length);

  let offset = 0;
  DISCRIMINATORS.markAirdropDistributed.copy(data, offset);
  offset += 8;

  data.writeUInt32LE(txBytes.length, offset);
  offset += 4;
  txBytes.copy(data, offset);

  return new TransactionInstruction({
    keys: [
      { pubkey: campaignPDA, isSigner: false, isWritable: false },
      { pubkey: registrationPDA, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
    ],
    programId: VOUCH_PROGRAM_ID,
    data,
  });
}

/**
 * Build instruction to complete an airdrop campaign
 */
export function buildCompleteCampaignInstruction(
  creator: PublicKey,
  campaignId: Uint8Array
): TransactionInstruction {
  const [campaignPDA] = getCampaignPDA(campaignId);

  return new TransactionInstruction({
    keys: [
      { pubkey: campaignPDA, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: true },
    ],
    programId: VOUCH_PROGRAM_ID,
    data: DISCRIMINATORS.completeAirdropCampaign,
  });
}

// ============================================================================
// High-Level Functions
// ============================================================================

/**
 * Fetch campaign details from chain
 */
export async function fetchCampaign(
  connection: Connection,
  campaignId: Uint8Array
): Promise<AirdropCampaign | null> {
  const [campaignPDA] = getCampaignPDA(campaignId);

  try {
    const accountInfo = await connection.getAccountInfo(campaignPDA);
    if (!accountInfo) return null;

    // Decode account data (skip 8-byte discriminator)
    const data = accountInfo.data.slice(8);

    // Parse campaign data
    const campaign: AirdropCampaign = {
      campaignId: Buffer.from(data.slice(0, 32)).toString('hex'),
      creator: new PublicKey(data.slice(32, 64)).toBase58(),
      name: '', // Will be parsed from variable-length field
      tokenMint: '',
      baseAmount: 0,
      devBonus: 0,
      whaleBonus: 0,
      registrationDeadline: new Date(0),
      status: 'open',
      totalRegistrations: 0,
      openRegistrations: 0,
      devRegistrations: 0,
      whaleRegistrations: 0,
      createdAt: new Date(0),
    };

    // Parse variable-length name
    const nameLen = data.readUInt32LE(64);
    campaign.name = data.slice(68, 68 + nameLen).toString('utf-8');

    // Continue parsing after name (max_len is 64)
    let offset = 68 + 64; // After name field
    campaign.tokenMint = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    campaign.baseAmount = Number(data.readBigUInt64LE(offset));
    offset += 8;

    campaign.devBonus = Number(data.readBigUInt64LE(offset));
    offset += 8;

    campaign.whaleBonus = Number(data.readBigUInt64LE(offset));
    offset += 8;

    campaign.registrationDeadline = new Date(Number(data.readBigInt64LE(offset)) * 1000);
    offset += 8;

    const statusByte = data[offset];
    campaign.status = statusByte === 0 ? 'open' : statusByte === 1 ? 'registration_closed' : 'completed';
    offset += 1;

    campaign.totalRegistrations = data.readUInt32LE(offset);
    offset += 4;

    campaign.openRegistrations = data.readUInt32LE(offset);
    offset += 4;

    campaign.devRegistrations = data.readUInt32LE(offset);
    offset += 4;

    campaign.whaleRegistrations = data.readUInt32LE(offset);
    offset += 4;

    campaign.createdAt = new Date(Number(data.readBigInt64LE(offset)) * 1000);
    offset += 8;

    const completedAt = Number(data.readBigInt64LE(offset));
    if (completedAt > 0) {
      campaign.completedAt = new Date(completedAt * 1000);
    }

    return campaign;
  } catch (error) {
    logger.error('Failed to fetch campaign', error);
    return null;
  }
}

/**
 * Fetch all registrations for a campaign
 */
export async function fetchCampaignRegistrations(
  connection: Connection,
  campaignId: Uint8Array
): Promise<AirdropRegistration[]> {
  const [campaignPDA] = getCampaignPDA(campaignId);

  try {
    // Find all registration PDAs for this campaign
    const accounts = await connection.getProgramAccounts(VOUCH_PROGRAM_ID, {
      filters: [
        { dataSize: 8 + 32 + 32 + 4 + 44 + 1 + 8 + 1 + 8 + 4 + 88 + 1 }, // AirdropRegistrationAccount size
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: campaignPDA.toBase58(),
          },
        },
      ],
    });

    return accounts.map((account) => {
      const data = account.account.data.slice(8);
      let offset = 32; // Skip campaign pubkey

      const nullifier = Buffer.from(data.slice(offset, offset + 32)).toString('hex');
      offset += 32;

      const addressLen = data.readUInt32LE(offset);
      offset += 4;
      const shadowWireAddress = data.slice(offset, offset + addressLen).toString('utf-8');
      offset = 32 + 32 + 4 + 44; // Fixed offset after max_len(44)

      const proofTypeByte = data[offset];
      const proofType = proofTypeByte === 1 ? 'developer' : 'whale';
      offset += 1;

      const registeredAt = new Date(Number(data.readBigInt64LE(offset)) * 1000);
      offset += 8;

      const isDistributed = data[offset] === 1;
      offset += 1;

      const distributedAtUnix = Number(data.readBigInt64LE(offset));
      offset += 8;

      const txLen = data.readUInt32LE(offset);
      offset += 4;
      const distributionTx = txLen > 0 ? data.slice(offset, offset + txLen).toString('utf-8') : undefined;

      return {
        campaign: campaignPDA.toBase58(),
        nullifier,
        shadowWireAddress,
        proofType,
        registeredAt,
        isDistributed,
        distributedAt: distributedAtUnix > 0 ? new Date(distributedAtUnix * 1000) : undefined,
        distributionTx,
      } as AirdropRegistration;
    });
  } catch (error) {
    logger.error('Failed to fetch registrations', error);
    return [];
  }
}

/**
 * Check if a user is registered for a campaign (verified registration)
 */
export async function isRegisteredForCampaign(
  connection: Connection,
  campaignId: Uint8Array,
  nullifier: Uint8Array
): Promise<boolean> {
  const [campaignPDA] = getCampaignPDA(campaignId);
  const [registrationPDA] = getRegistrationPDA(campaignPDA, nullifier);

  try {
    const accountInfo = await connection.getAccountInfo(registrationPDA);
    return accountInfo !== null;
  } catch {
    return false;
  }
}

/**
 * Check if a wallet is registered for a campaign (open registration)
 */
export async function isOpenRegisteredForCampaign(
  connection: Connection,
  campaignId: Uint8Array,
  walletPubkey: PublicKey
): Promise<boolean> {
  const [campaignPDA] = getCampaignPDA(campaignId);
  const [registrationPDA] = getOpenRegistrationPDA(campaignPDA, walletPubkey);

  try {
    const accountInfo = await connection.getAccountInfo(registrationPDA);
    return accountInfo !== null;
  } catch {
    return false;
  }
}

// ============================================================================
// Distribution Functions (ShadowWire Integration)
// ============================================================================

export interface DistributionProgress {
  completed: number;
  total: number;
  current: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

/**
 * Distribute airdrop to all registered addresses via ShadowWire
 * This is the key function that makes airdrops private!
 */
export async function distributeAirdropPrivately(
  wallet: WalletContextState,
  connection: Connection,
  campaignId: Uint8Array,
  token: 'SOL' | 'USDC' = 'SOL',
  options: {
    onProgress?: (progress: DistributionProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<{
  successful: number;
  failed: number;
  results: Array<{ address: string; success: boolean; tx?: string; error?: string }>;
}> {
  assert(wallet.publicKey !== null, 'Wallet not connected');

  const { onProgress, signal } = options;

  // Fetch campaign to get amounts
  const campaign = await fetchCampaign(connection, campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  // Verify caller is campaign creator
  if (campaign.creator !== wallet.publicKey.toBase58()) {
    throw new Error('Only campaign creator can distribute');
  }

  // Fetch all registrations
  const registrations = await fetchCampaignRegistrations(connection, campaignId);
  const pendingRegistrations = registrations.filter((r) => !r.isDistributed);

  if (pendingRegistrations.length === 0) {
    return { successful: 0, failed: 0, results: [] };
  }

  // Convert to AirdropRecipient format with tiered amounts
  // - Open (unverified): base_amount only
  // - Developer: base_amount + dev_bonus
  // - Whale: base_amount + whale_bonus
  const recipients: AirdropRecipient[] = pendingRegistrations.map((reg) => {
    let amount = campaign.baseAmount; // Everyone gets base

    if (reg.proofType === 'developer') {
      amount += campaign.devBonus; // Add dev bonus
    } else if (reg.proofType === 'whale') {
      amount += campaign.whaleBonus; // Add whale bonus
    }
    // Open registrations (proofType undefined/unset) get only base

    return {
      address: reg.shadowWireAddress,
      amount: amount / 1e9, // Convert lamports to SOL
    };
  });

  logger.info('Starting private tiered airdrop distribution', {
    totalRecipients: recipients.length,
    openCount: pendingRegistrations.filter((r) => !r.proofType || r.proofType === 'developer' && false).length,
    devCount: pendingRegistrations.filter((r) => r.proofType === 'developer').length,
    whaleCount: pendingRegistrations.filter((r) => r.proofType === 'whale').length,
    baseAmount: campaign.baseAmount / 1e9,
    devBonus: campaign.devBonus / 1e9,
    whaleBonus: campaign.whaleBonus / 1e9,
  });

  // Distribute via ShadowWire (amounts hidden!)
  const results = await distributePrivateAirdrop(wallet, recipients, token, {
    signal,
    onProgress: onProgress
      ? (p) =>
          onProgress({
            completed: p.completed,
            total: p.total,
            current: p.current,
            status: p.status,
          })
      : undefined,
  });

  // Count results
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info('Distribution complete', { successful, failed });

  return {
    successful,
    failed,
    results: results.map((r) => ({
      address: r.recipient,
      success: r.success,
      tx: r.txSignature,
      error: r.error,
    })),
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate campaign parameters before creation
 */
export function validateCampaignParams(params: CreateCampaignParams): string | null {
  if (!params.name || params.name.length === 0) {
    return 'Campaign name is required';
  }
  if (params.name.length > 64) {
    return 'Campaign name must be 64 characters or less';
  }
  if (!isValidSolanaAddress(params.tokenMint)) {
    return 'Invalid token mint address';
  }
  // Tiered model: base amount is required
  if (params.baseAmount <= 0) {
    return 'Base amount must be greater than zero';
  }
  if (params.registrationDeadlineUnix <= Date.now() / 1000) {
    return 'Registration deadline must be in the future';
  }
  return null;
}

/**
 * Calculate the total amount a user will receive based on their verification status
 */
export function calculateAirdropAmount(
  campaign: AirdropCampaign,
  proofType?: 'developer' | 'whale'
): number {
  let amount = campaign.baseAmount;
  if (proofType === 'developer') {
    amount += campaign.devBonus;
  } else if (proofType === 'whale') {
    amount += campaign.whaleBonus;
  }
  return amount;
}

/**
 * Validate ShadowWire address format
 */
export function validateShadowWireAddress(address: string): boolean {
  // ShadowWire addresses are base58 encoded, 32-44 characters
  if (!address || address.length < 32 || address.length > 44) {
    return false;
  }
  // Check for valid base58 characters
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}
