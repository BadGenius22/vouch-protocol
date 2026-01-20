import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction, Transaction } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD");

/**
 * Fix the config account layout after adding max_epoch_age field.
 *
 * The problem: The migrate_config script only wrote max_epoch_age at offset 89,
 * but didn't move total_proofs_verified and bump to their new positions.
 *
 * OLD layout (98 bytes total):
 * - 8 bytes: discriminator
 * - 32 bytes: admin
 * - 32 bytes: pause_authority
 * - 4 bytes: verifier_count
 * - 1 byte: is_paused
 * - 4 bytes: max_proofs_per_day
 * - 8 bytes: cooldown_seconds
 * - 8 bytes: total_proofs_verified (offset 89-96)
 * - 1 byte: bump (offset 97)
 *
 * NEW layout (106 bytes total):
 * - 8 bytes: discriminator
 * - 32 bytes: admin
 * - 32 bytes: pause_authority
 * - 4 bytes: verifier_count
 * - 1 byte: is_paused
 * - 4 bytes: max_proofs_per_day
 * - 8 bytes: cooldown_seconds
 * - 8 bytes: max_epoch_age (NEW at offset 89-96)
 * - 8 bytes: total_proofs_verified (offset 97-104)
 * - 1 byte: bump (offset 105)
 */
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

  // Fetch current config account
  const configAccountInfo = await provider.connection.getAccountInfo(configPda);
  if (!configAccountInfo) {
    console.error("Config account not found!");
    process.exit(1);
  }

  console.log("Current config account size:", configAccountInfo.data.length, "bytes");

  // Read current data
  const data = configAccountInfo.data;
  console.log("\n=== Current Config Account Data ===");

  // Discriminator (8 bytes)
  console.log("Discriminator:", Buffer.from(data.slice(0, 8)).toString("hex"));

  // Admin (32 bytes at offset 8)
  const admin = new PublicKey(data.slice(8, 40));
  console.log("Admin:", admin.toBase58());

  // Pause authority (32 bytes at offset 40)
  const pauseAuthority = new PublicKey(data.slice(40, 72));
  console.log("Pause authority:", pauseAuthority.toBase58());

  // Verifier count (4 bytes at offset 72)
  const verifierCount = data.readUInt32LE(72);
  console.log("Verifier count:", verifierCount);

  // Is paused (1 byte at offset 76)
  const isPaused = data[76] !== 0;
  console.log("Is paused:", isPaused);

  // Max proofs per day (4 bytes at offset 77)
  const maxProofsPerDay = data.readUInt32LE(77);
  console.log("Max proofs per day:", maxProofsPerDay);

  // Cooldown seconds (8 bytes at offset 81)
  const cooldownSeconds = data.readBigInt64LE(81);
  console.log("Cooldown seconds:", cooldownSeconds.toString());

  // Check what's at offset 89 (should be max_epoch_age OR old total_proofs_verified)
  const valueAt89 = data.readBigUInt64LE(89);
  console.log("\nValue at offset 89:", valueAt89.toString());

  // Check what's at offset 97 (could be old bump or new total_proofs_verified)
  if (data.length > 97) {
    console.log("Bytes at offset 97-105:", Buffer.from(data.slice(97, Math.min(106, data.length))).toString("hex"));
  }

  // The old bump should have been at offset 97 (value 255)
  // Let's check if the bump is there
  if (data.length > 97) {
    const oldBumpPosition = data[97];
    console.log("Value at offset 97 (old bump position):", oldBumpPosition);
  }

  // If size is 106, check offset 105 for bump
  if (data.length >= 106) {
    const newBumpPosition = data[105];
    console.log("Value at offset 105 (new bump position):", newBumpPosition);
  }

  console.log("\n=== Analysis ===");

  if (data.length === 98) {
    console.log("Config is at OLD size (98 bytes) - needs full migration");
    // OLD layout at offset 89: total_proofs_verified (8 bytes), then bump (1 byte) at 97
    const oldTotalProofs = data.readBigUInt64LE(89);
    const oldBump = data[97];
    console.log("Old total_proofs_verified:", oldTotalProofs.toString());
    console.log("Old bump:", oldBump);
    console.log("\nThis requires running migrate_config first!");
  } else if (data.length === 106) {
    console.log("Config is at NEW size (106 bytes)");

    // Current interpretation with buggy migration:
    // - offset 89: max_epoch_age (written by migration)
    // - offset 97: old bump value (255) is now being misread
    // - offset 105: zeros

    // What we need to do:
    // 1. Read the old bump value from offset 97 (it's likely 255)
    // 2. Read total_proofs_verified which was overwritten at offset 89
    //    (but wait, migrate_config wrote max_epoch_age there, so total_proofs_verified is lost!)

    // Actually, let me check if the value at offset 97 looks like a bump
    const valueAt97 = data[97];
    const valueAt105 = data[105];

    console.log("Value at offset 97 (stuck old bump?):", valueAt97);
    console.log("Value at offset 105 (current bump read):", valueAt105);
    console.log("Expected bump:", expectedBump);

    if (valueAt97 === expectedBump) {
      console.log("\n✓ Old bump (255) is at offset 97");
      console.log("✗ Anchor is reading bump from offset 105 which is:", valueAt105);
      console.log("\n=== FIX NEEDED ===");
      console.log("We need to write the correct bump (255) at offset 105");

      // Also, total_proofs_verified was at offset 89 in the old layout
      // But migrate_config overwrote it with max_epoch_age
      // So total_proofs_verified is now lost and we'll set it to 0
      // (Or we could try to read it from a backup/history)
    }
  }

  // Ask for confirmation before fixing
  console.log("\n=== Proposed Fix ===");
  console.log("1. Write bump (255) at offset 105");
  console.log("2. Set total_proofs_verified to 0 at offset 97-104 (was lost in migration)");
  console.log("\nThis will fix the ConstraintSeeds error.");

  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question("\nProceed with fix? (yes/no): ", async (answer: string) => {
      rl.close();
      if (answer.toLowerCase() !== "yes") {
        console.log("Aborted");
        process.exit(0);
      }
      resolve();
    });
  });

  // Create a transaction to fix the config
  // We need to use the migrate_config instruction again to fix the layout
  // But actually, migrate_config only handles realloc, not fixing the layout

  // The cleanest fix is to create a new instruction that properly shifts the data
  // For now, let's use a simpler approach: directly modify the account data using
  // a special one-time fix instruction

  // Actually, we can't directly modify the account data without a program instruction
  // Let me create a fix_config_layout instruction

  console.log("\n=== Creating fix transaction ===");

  // For this fix, we'll need to add a new instruction to the program
  // OR we can use the existing migrate_config in a clever way

  // Actually, the easiest fix is to re-deploy the program with a fix_config_layout instruction
  // But that's a lot of work

  // Alternative: Since we have admin access, we can:
  // 1. Create a new instruction that fixes the layout
  // 2. Or manually construct the correct account data

  // Let me check if we can use setAccountData or similar...
  // Actually, we can't - only the program can modify its own PDAs

  // The proper fix is to add a fix_config_layout instruction to the program
  console.log("ERROR: Cannot fix config layout without adding a new program instruction.");
  console.log("\nOptions:");
  console.log("1. Add fix_config_layout instruction to the Anchor program");
  console.log("2. Re-initialize config (would lose verifier_count state)");
  console.log("3. Use Anchor 'upgrade' with IDL that has the fix");

  console.log("\n=== Recommended Fix ===");
  console.log("Add this instruction to lib.rs and redeploy:");
  console.log(`
    /// Fix config layout after broken migration
    /// This is a one-time fix for the max_epoch_age migration that didn't shift existing fields
    pub fn fix_config_layout(ctx: Context<MigrateConfig>) -> Result<()> {
        let config_info = &ctx.accounts.config;
        let admin = &ctx.accounts.admin;

        // Verify admin
        {
            let data = config_info.try_borrow_data()?;
            let stored_admin = Pubkey::try_from(&data[8..40]).map_err(|_| VouchError::Unauthorized)?;
            require!(stored_admin == admin.key(), VouchError::Unauthorized);
        }

        // Compute correct bump
        let (_, bump) = Pubkey::find_program_address(&[b"config"], &crate::ID);

        // Fix the layout:
        // - Offset 89-96: max_epoch_age (keep as is - was written by migrate_config)
        // - Offset 97-104: total_proofs_verified (set to 0, was lost)
        // - Offset 105: bump (write the correct value)
        {
            let mut data = config_info.try_borrow_mut_data()?;
            // Set total_proofs_verified to 0
            data[97..105].copy_from_slice(&0u64.to_le_bytes());
            // Set bump to correct value
            data[105] = bump;
        }

        msg!("Config layout fixed: bump set to {}", bump);

        Ok(())
    }
  `);
}

main().catch(console.error);
