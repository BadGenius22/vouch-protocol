/**
 * Fund the airdrop campaign vault with VOUCH tokens
 * Run: npx ts-node scripts/fund-campaign.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD');
const TOKEN_MINT = new PublicKey('GRL7X2VtBZnKUmrag6zXjFUno8q8HCMssTA3W8oiP8mx');
const CAMPAIGN_ID = Buffer.from('db4811899b3214b0e3191ca1500c2e8be0c487cfa477eab1b5020c655cebeb6b', 'hex');

// Fund amount: 1000 VOUCH tokens = 1000 * 1e9 (9 decimals)
const FUND_AMOUNT = BigInt(1000 * 1e9);

async function main() {
  // Load keypair from default location
  const keypairPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const creator = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log('Creator wallet:', creator.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Derive PDAs
  const [campaignPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop_campaign'), CAMPAIGN_ID],
    PROGRAM_ID
  );
  console.log('Campaign PDA:', campaignPDA.toBase58());

  // Get campaign vault ATA
  const campaignVault = await getAssociatedTokenAddress(
    TOKEN_MINT,
    campaignPDA,
    true // allowOwnerOffCurve for PDA
  );
  console.log('Campaign Vault:', campaignVault.toBase58());

  // Get creator's token account
  const creatorTokenAccount = await getAssociatedTokenAddress(
    TOKEN_MINT,
    creator.publicKey
  );
  console.log('Creator Token Account:', creatorTokenAccount.toBase58());

  // Check creator's token balance
  const balance = await connection.getTokenAccountBalance(creatorTokenAccount);
  console.log('Creator token balance:', balance.value.uiAmount, 'VOUCH');

  // Build fund_airdrop_campaign instruction
  // Discriminator: [204, 227, 11, 42, 142, 44, 121, 87]
  const discriminator = Buffer.from([204, 227, 11, 42, 142, 44, 121, 87]);

  // Amount as 8-byte little-endian
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(FUND_AMOUNT);

  const data = Buffer.concat([discriminator, amountBuffer]);

  const fundInstruction = {
    programId: PROGRAM_ID,
    keys: [
      { pubkey: campaignPDA, isSigner: false, isWritable: true },
      { pubkey: campaignVault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_MINT, isSigner: false, isWritable: false },
      { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: creator.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  };

  const transaction = new Transaction().add(fundInstruction);

  console.log('\nFunding campaign with', Number(FUND_AMOUNT) / 1e9, 'VOUCH tokens...');

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [creator]);
    console.log('Transaction signature:', signature);
    console.log('Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Check new vault balance
    try {
      const vaultBalance = await connection.getTokenAccountBalance(campaignVault);
      console.log('\nCampaign vault balance:', vaultBalance.value.uiAmount, 'VOUCH');
    } catch {
      console.log('Vault not found (might need a moment to confirm)');
    }
  } catch (err) {
    console.error('Error funding campaign:', err);
    throw err;
  }
}

main().catch(console.error);
