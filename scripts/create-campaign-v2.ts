/**
 * Create a new airdrop campaign with the updated program
 * Run: npx ts-node scripts/create-campaign-v2.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const PROGRAM_ID = new PublicKey('EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD');
const TOKEN_MINT = new PublicKey('GRL7X2VtBZnKUmrag6zXjFUno8q8HCMssTA3W8oiP8mx');

// Campaign parameters
const CAMPAIGN_NAME = 'Vouch Devnet Airdrop V2';
const BASE_AMOUNT = BigInt(100_000_000_000); // 100 VOUCH
const DEV_BONUS = BigInt(50_000_000_000);    // 50 VOUCH
const WHALE_BONUS = BigInt(150_000_000_000); // 150 VOUCH
const REGISTRATION_DEADLINE = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

async function main() {
  // Load keypair
  const keypairPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const creator = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log('Creator wallet:', creator.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Generate new campaign ID (hash of name + timestamp)
  const campaignIdInput = `${CAMPAIGN_NAME}-${Date.now()}`;
  const campaignId = crypto.createHash('sha256').update(campaignIdInput).digest();
  console.log('Campaign ID:', campaignId.toString('hex'));

  // Derive campaign PDA
  const [campaignPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop_campaign'), campaignId],
    PROGRAM_ID
  );
  console.log('Campaign PDA:', campaignPDA.toBase58());

  // Build create_airdrop_campaign instruction
  // Discriminator: [137, 20, 107, 226, 116, 34, 27, 215]
  const discriminator = Buffer.from([137, 20, 107, 226, 116, 34, 27, 215]);

  // Encode arguments
  // campaign_id: [u8; 32]
  const campaignIdBytes = campaignId;

  // name: String (4-byte length + data)
  const nameBytes = Buffer.from(CAMPAIGN_NAME, 'utf-8');
  const nameLen = Buffer.alloc(4);
  nameLen.writeUInt32LE(nameBytes.length);

  // token_mint: Pubkey
  const tokenMintBytes = TOKEN_MINT.toBuffer();

  // base_amount: u64
  const baseAmountBytes = Buffer.alloc(8);
  baseAmountBytes.writeBigUInt64LE(BASE_AMOUNT);

  // dev_bonus: u64
  const devBonusBytes = Buffer.alloc(8);
  devBonusBytes.writeBigUInt64LE(DEV_BONUS);

  // whale_bonus: u64
  const whaleBonusBytes = Buffer.alloc(8);
  whaleBonusBytes.writeBigUInt64LE(WHALE_BONUS);

  // registration_deadline: i64
  const deadlineBytes = Buffer.alloc(8);
  deadlineBytes.writeBigInt64LE(BigInt(REGISTRATION_DEADLINE));

  const data = Buffer.concat([
    discriminator,
    campaignIdBytes,
    nameLen,
    nameBytes,
    tokenMintBytes,
    baseAmountBytes,
    devBonusBytes,
    whaleBonusBytes,
    deadlineBytes,
  ]);

  const createInstruction = {
    programId: PROGRAM_ID,
    keys: [
      { pubkey: campaignPDA, isSigner: false, isWritable: true },
      { pubkey: creator.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  };

  const transaction = new Transaction().add(createInstruction);

  console.log('\nCreating campaign...');

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [creator]);
    console.log('Transaction signature:', signature);
    console.log('Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Output campaign info for updating the frontend
    console.log('\n========================================');
    console.log('NEW CAMPAIGN CREATED!');
    console.log('========================================');
    console.log('Campaign ID (hex):', campaignId.toString('hex'));
    console.log('Campaign PDA:', campaignPDA.toBase58());
    console.log('Token Mint:', TOKEN_MINT.toBase58());
    console.log('Base Amount:', Number(BASE_AMOUNT) / 1e9, 'VOUCH');
    console.log('Dev Bonus:', Number(DEV_BONUS) / 1e9, 'VOUCH');
    console.log('Whale Bonus:', Number(WHALE_BONUS) / 1e9, 'VOUCH');
    console.log('Deadline:', new Date(REGISTRATION_DEADLINE * 1000).toISOString());
    console.log('========================================');
    console.log('\nUpdate CAMPAIGN_INFO in AirdropClaim.tsx with:');
    console.log(`campaignId: '${campaignId.toString('hex')}',`);
  } catch (err) {
    console.error('Error creating campaign:', err);
    throw err;
  }
}

main().catch(console.error);
