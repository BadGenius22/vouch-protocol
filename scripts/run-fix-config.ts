import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction, Transaction } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD");

async function main() {
  // Set up provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log("Admin wallet:", provider.wallet.publicKey.toBase58());

  // Derive config PDA
  const [configPda, expectedBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  console.log("Config PDA:", configPda.toBase58());
  console.log("Expected bump:", expectedBump);

  // Check current config state
  const configAccountInfo = await provider.connection.getAccountInfo(configPda);
  if (!configAccountInfo) {
    console.error("Config account not found!");
    process.exit(1);
  }

  console.log("Config account size:", configAccountInfo.data.length, "bytes");

  const data = configAccountInfo.data;
  console.log("\n=== Before Fix ===");
  console.log("Value at offset 97 (old bump position):", data[97]);
  console.log("Value at offset 105 (new bump position):", data[105]);

  // Compute discriminator for fix_config_layout
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256").update("global:fix_config_layout").digest();
  const discriminator = hash.slice(0, 8);
  console.log("\nDiscriminator:", Buffer.from(discriminator).toString("hex"));

  // Build the instruction (no additional data needed, just discriminator)
  const ix = new TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });

  console.log("\nCalling fix_config_layout...");

  try {
    const tx = new Transaction().add(ix);
    const signature = await provider.sendAndConfirm(tx);

    console.log("\n✓ Fix successful!");
    console.log("Transaction signature:", signature);

    // Verify the fix
    const configAccountInfoAfter = await provider.connection.getAccountInfo(configPda);
    if (configAccountInfoAfter) {
      const dataAfter = configAccountInfoAfter.data;
      console.log("\n=== After Fix ===");
      console.log("Value at offset 97 (total_proofs_verified low byte):", dataAfter[97]);
      console.log("Value at offset 105 (bump):", dataAfter[105]);

      if (dataAfter[105] === expectedBump) {
        console.log("\n✓ Bump is now correct:", expectedBump);
      } else {
        console.log("\n✗ Bump is still wrong!");
      }
    }
  } catch (error) {
    console.error("\n✗ Fix failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
