/**
 * Vouch Protocol - Verifier Setup Script
 *
 * Initializes the Anchor program config and registers the verifier.
 * Run with: pnpm setup:verifier [verifier-pubkey]
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey('AgG8EAwpeWqjoJQBtUY5SHX38gYpsVhcG4x7UuRHwxk7');

// Anchor discriminators (first 8 bytes of SHA256("global:<method_name>"))
const DISCRIMINATORS = {
  initializeConfig: Buffer.from([208, 127, 21, 1, 194, 190, 196, 70]),
  addVerifier: Buffer.from([9, 119, 221, 66, 20, 224, 199, 72]),
};

async function getDiscriminator(methodName: string): Promise<Buffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`global:${methodName}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
}

interface SetupConfig {
  verifierPubkey?: string;
  rpcUrl: string;
}

function getConfig(): SetupConfig {
  const args = process.argv.slice(2);
  const verifierPubkey = args[0];

  // Read Solana config
  const configPath = path.join(
    process.env.HOME || '',
    '.config/solana/cli/config.yml'
  );

  let rpcUrl = 'https://api.devnet.solana.com';

  if (fs.existsSync(configPath)) {
    const config = fs.readFileSync(configPath, 'utf8');
    const match = config.match(/json_rpc_url:\s*(.+)/);
    if (match) {
      rpcUrl = match[1].trim();
    }
  }

  return { verifierPubkey, rpcUrl };
}

function loadWallet(): Keypair {
  const configPath = path.join(
    process.env.HOME || '',
    '.config/solana/cli/config.yml'
  );

  let walletPath = path.join(
    process.env.HOME || '',
    '.config/solana/id.json'
  );

  if (fs.existsSync(configPath)) {
    const config = fs.readFileSync(configPath, 'utf8');
    const match = config.match(/keypair_path:\s*(.+)/);
    if (match) {
      walletPath = match[1].trim();
    }
  }

  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found at ${walletPath}. Run: solana-keygen new`);
  }

  console.log(`Using wallet: ${walletPath}`);
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Vouch Protocol - Verifier Setup');
  console.log('='.repeat(60));

  const config = getConfig();
  console.log(`RPC: ${config.rpcUrl}`);

  const wallet = loadWallet();
  console.log(`Admin wallet: ${wallet.publicKey.toBase58()}`);

  const connection = new Connection(config.rpcUrl, 'confirmed');

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL`);

  if (balance < 0.01 * 1e9) {
    console.log('\n⚠️  Low balance! Airdrop SOL:');
    console.log(`   solana airdrop 2`);
    return;
  }

  // Derive config PDA
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );

  console.log(`\nConfig PDA: ${configPda.toBase58()}`);

  // Check if config exists
  const configAccount = await connection.getAccountInfo(configPda);

  if (!configAccount) {
    console.log('\n📝 Initializing config...');

    const discriminator = await getDiscriminator('initialize_config');

    const initConfigIx = new TransactionInstruction({
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: discriminator,
    });

    try {
      const tx = new Transaction().add(initConfigIx);
      const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
      console.log(`   ✅ Config initialized: ${sig}`);
    } catch (error: any) {
      if (error.message?.includes('already in use')) {
        console.log('   ℹ️  Config already initialized');
      } else {
        console.log(`   ❌ Failed: ${error.message}`);
        return;
      }
    }
  } else {
    console.log('   ℹ️  Config already exists');
  }

  // Register verifier if provided
  if (config.verifierPubkey) {
    const verifierPubkey = new PublicKey(config.verifierPubkey);
    console.log(`\n🔑 Registering verifier: ${verifierPubkey.toBase58()}`);

    const [verifierPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('verifier'), verifierPubkey.toBuffer()],
      PROGRAM_ID
    );

    console.log(`   Verifier PDA: ${verifierPda.toBase58()}`);

    const verifierAccount = await connection.getAccountInfo(verifierPda);

    if (!verifierAccount) {
      const discriminator = await getDiscriminator('add_verifier');

      // Instruction data: discriminator + verifier pubkey
      const data = Buffer.concat([discriminator, verifierPubkey.toBuffer()]);

      const addVerifierIx = new TransactionInstruction({
        keys: [
          { pubkey: configPda, isSigner: false, isWritable: true },
          { pubkey: verifierPda, isSigner: false, isWritable: true },
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      });

      try {
        const tx = new Transaction().add(addVerifierIx);
        const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
        console.log(`   ✅ Verifier registered: ${sig}`);
      } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`);
      }
    } else {
      console.log('   ℹ️  Verifier already registered');
    }
  } else {
    console.log('\n⚠️  No verifier pubkey provided.');
    console.log('   Usage: pnpm setup:verifier <VERIFIER_PUBKEY>');
    console.log('\n   Get verifier pubkey: curl http://localhost:3001/verifier');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Setup complete!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
