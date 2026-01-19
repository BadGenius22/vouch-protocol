/**
 * Add metadata to VOUCH token using Metaplex Umi
 * Run: npx ts-node scripts/add-token-metadata.ts
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createMetadataAccountV3,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  createSignerFromKeypair,
  signerIdentity,
  publicKey,
} from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_MINT = 'GRL7X2VtBZnKUmrag6zXjFUno8q8HCMssTA3W8oiP8mx';

// Token metadata
const TOKEN_NAME = 'VOUCH';
const TOKEN_SYMBOL = 'VOUCH';
const TOKEN_URI = ''; // Optional: JSON metadata URI for logo

async function main() {
  // Load keypair (mint authority)
  const keypairPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const secretKey = Uint8Array.from(keypairData);

  // Create Umi instance
  const umi = createUmi('https://api.devnet.solana.com')
    .use(mplTokenMetadata());

  // Create signer from keypair
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair(umi, keypair);
  umi.use(signerIdentity(signer));

  console.log('Payer/Mint Authority:', signer.publicKey.toString());
  console.log('Token Mint:', TOKEN_MINT);
  console.log('\nCreating token metadata...');
  console.log('Name:', TOKEN_NAME);
  console.log('Symbol:', TOKEN_SYMBOL);

  try {
    const tx = await createMetadataAccountV3(umi, {
      mint: publicKey(TOKEN_MINT),
      mintAuthority: signer,
      payer: signer,
      updateAuthority: signer.publicKey,
      data: {
        name: TOKEN_NAME,
        symbol: TOKEN_SYMBOL,
        uri: TOKEN_URI,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: true,
      collectionDetails: null,
    }).sendAndConfirm(umi);

    // Convert signature to base58
    const signatureBase58 = base58.deserialize(tx.signature)[0];

    console.log('\nSuccess!');
    console.log('Signature:', signatureBase58);
    console.log('Solscan:', `https://solscan.io/tx/${signatureBase58}?cluster=devnet`);
  } catch (err: any) {
    if (err.message?.includes('already in use') || err.message?.includes('0x0')) {
      console.log('\nMetadata already exists for this token!');
    } else {
      console.error('Error:', err);
      throw err;
    }
  }
}

main().catch(console.error);
