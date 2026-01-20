import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction, Transaction } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD");
const DEFAULT_MAX_EPOCH_AGE = BigInt(7); // 7 days

async function main() {
  // Set up provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("Admin wallet:", provider.wallet.publicKey.toBase58());

  // Derive config PDA
  const [configPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  console.log("Config PDA:", configPda.toBase58());

  // Check config account size before migration
  const configAccountInfo = await provider.connection.getAccountInfo(configPda);
  if (!configAccountInfo) {
    console.error("Config account not found!");
    process.exit(1);
  }
  console.log("Config account size before migration:", configAccountInfo.data.length, "bytes");

  // Load IDL from local file
  const idlPath = path.join(__dirname, "../target/idl/vouch_verifier.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  // Get the migrate_config discriminator from IDL
  // Discriminator is first 8 bytes of sha256("global:migrate_config")
  const discriminator = Buffer.from([216, 245, 224, 138, 79, 49, 171, 106]); // Pre-computed

  // Actually, let's compute it properly
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256").update("global:migrate_config").digest();
  const computedDiscriminator = hash.slice(0, 8);
  console.log("Discriminator:", Buffer.from(computedDiscriminator).toString("hex"));

  // Build instruction data: discriminator (8 bytes) + max_epoch_age (8 bytes, u64 little-endian)
  const maxEpochAgeBytes = Buffer.alloc(8);
  maxEpochAgeBytes.writeBigUInt64LE(DEFAULT_MAX_EPOCH_AGE);

  const instructionData = Buffer.concat([computedDiscriminator, maxEpochAgeBytes]);

  console.log("\nCalling migrate_config with max_epoch_age =", DEFAULT_MAX_EPOCH_AGE.toString());

  // Build the instruction
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  try {
    const tx = new Transaction().add(ix);
    const signature = await provider.sendAndConfirm(tx);

    console.log("Migration successful!");
    console.log("Transaction signature:", signature);

    // Verify the migration
    const configAccountInfoAfter = await provider.connection.getAccountInfo(configPda);
    if (configAccountInfoAfter) {
      console.log("Config account size after migration:", configAccountInfoAfter.data.length, "bytes");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
