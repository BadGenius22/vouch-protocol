/**
 * Create a real airdrop campaign on devnet
 *
 * Usage: npx ts-node scripts/create-devnet-campaign.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const VOUCH_PROGRAM_ID = new PublicKey('EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD');
const VOUCH_TOKEN_MINT = new PublicKey('GRL7X2VtBZnKUmrag6zXjFUno8q8HCMssTA3W8oiP8mx');

// Campaign parameters
const CAMPAIGN_NAME = 'Vouch Devnet Airdrop';
const BASE_AMOUNT = 100_000_000_000; // 100 VOUCH tokens (9 decimals)
const DEV_BONUS = 50_000_000_000; // +50 VOUCH for devs
const WHALE_BONUS = 150_000_000_000; // +150 VOUCH for whales
const REGISTRATION_DEADLINE_DAYS = 30;

// Anchor instruction discriminator for create_airdrop_campaign
const CREATE_CAMPAIGN_DISCRIMINATOR = Buffer.from([
  0x89, 0x14, 0x6b, 0xe2, 0x74, 0x22, 0x1b, 0xd7,
]);

async function main() {
  console.log('🚀 Creating Vouch Devnet Campaign...\n');

  // Load wallet
  const keypairPath = path.join(
    process.env.HOME || '~',
    '.config/solana/id.json'
  );
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log(`📍 Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`📍 Program: ${VOUCH_PROGRAM_ID.toBase58()}`);
  console.log(`📍 Token Mint: ${VOUCH_TOKEN_MINT.toBase58()}\n`);

  // Connect to devnet
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL\n`);

  // Generate campaign ID
  const campaignIdInput = `vouch_campaign:${CAMPAIGN_NAME}:${wallet.publicKey.toBase58()}:${Date.now()}`;
  const campaignId = crypto.createHash('sha256').update(campaignIdInput).digest();
  console.log(`🆔 Campaign ID: ${campaignId.toString('hex')}`);

  // Derive campaign PDA
  const [campaignPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop_campaign'), campaignId],
    VOUCH_PROGRAM_ID
  );
  console.log(`📍 Campaign PDA: ${campaignPDA.toBase58()}`);

  // Check if campaign already exists
  const existingAccount = await connection.getAccountInfo(campaignPDA);
  if (existingAccount) {
    console.log('\n⚠️ Campaign already exists at this PDA!');
    console.log('Campaign ID:', campaignId.toString('hex'));
    return;
  }

  // Build instruction data
  const nameBytes = Buffer.from(CAMPAIGN_NAME, 'utf-8');
  const registrationDeadline = Math.floor(Date.now() / 1000) + (REGISTRATION_DEADLINE_DAYS * 24 * 60 * 60);

  const dataSize = 8 + 32 + 4 + nameBytes.length + 32 + 8 + 8 + 8 + 8;
  const data = Buffer.alloc(dataSize);

  let offset = 0;

  // Discriminator
  CREATE_CAMPAIGN_DISCRIMINATOR.copy(data, offset);
  offset += 8;

  // Campaign ID (32 bytes)
  campaignId.copy(data, offset);
  offset += 32;

  // Name (4 bytes length + string)
  data.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(data, offset);
  offset += nameBytes.length;

  // Token mint (32 bytes)
  VOUCH_TOKEN_MINT.toBuffer().copy(data, offset);
  offset += 32;

  // Base amount (8 bytes)
  data.writeBigUInt64LE(BigInt(BASE_AMOUNT), offset);
  offset += 8;

  // Dev bonus (8 bytes)
  data.writeBigUInt64LE(BigInt(DEV_BONUS), offset);
  offset += 8;

  // Whale bonus (8 bytes)
  data.writeBigUInt64LE(BigInt(WHALE_BONUS), offset);
  offset += 8;

  // Registration deadline (8 bytes)
  data.writeBigInt64LE(BigInt(registrationDeadline), offset);

  // Create instruction
  const instruction = {
    keys: [
      { pubkey: campaignPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: VOUCH_PROGRAM_ID,
    data,
  };

  // Create and send transaction
  const transaction = new Transaction().add(instruction);

  console.log('\n📤 Sending transaction...');

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
      commitment: 'confirmed',
    });

    console.log('\n✅ Campaign created successfully!');
    console.log(`📝 Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log(`\n📋 Campaign Details:`);
    console.log(`   Name: ${CAMPAIGN_NAME}`);
    console.log(`   Campaign ID: ${campaignId.toString('hex')}`);
    console.log(`   Campaign PDA: ${campaignPDA.toBase58()}`);
    console.log(`   Token Mint: ${VOUCH_TOKEN_MINT.toBase58()}`);
    console.log(`   Base Amount: ${BASE_AMOUNT / 1e9} VOUCH`);
    console.log(`   Dev Bonus: +${DEV_BONUS / 1e9} VOUCH`);
    console.log(`   Whale Bonus: +${WHALE_BONUS / 1e9} VOUCH`);
    console.log(`   Deadline: ${new Date(registrationDeadline * 1000).toISOString()}`);

    // Save campaign info to file
    const campaignInfo = {
      campaignId: campaignId.toString('hex'),
      campaignPDA: campaignPDA.toBase58(),
      tokenMint: VOUCH_TOKEN_MINT.toBase58(),
      name: CAMPAIGN_NAME,
      baseAmount: BASE_AMOUNT,
      devBonus: DEV_BONUS,
      whaleBonus: WHALE_BONUS,
      registrationDeadline,
      createdAt: Date.now(),
      txSignature: signature,
    };

    const outputPath = path.join(__dirname, 'devnet-campaign.json');
    fs.writeFileSync(outputPath, JSON.stringify(campaignInfo, null, 2));
    console.log(`\n💾 Campaign info saved to: ${outputPath}`);

  } catch (error) {
    console.error('\n❌ Failed to create campaign:', error);
    throw error;
  }
}

main().catch(console.error);
