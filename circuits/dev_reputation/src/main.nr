// Vouch Protocol - Developer Reputation Circuit (v2)
// Proves: "I control a wallet that deployed programs with >= min_tvl TVL"
// Without revealing: which wallet, which programs, exact TVL
//
// Security features:
// - epoch: Temporal binding prevents replay attacks (nullifiers are time-bound)
// - data_hash: Commits to private data integrity (verifier can check data freshness)

use vouch_lib::{
    compute_commitment,
    compute_nullifier_with_epoch,
    amounts_to_bytes_8,
    compute_data_hash,
    DOMAIN_DEV
};

// Maximum number of programs to prove
global MAX_PROGRAMS: u32 = 5;

fn main(
    // Private inputs (hidden from verifier)
    wallet_pubkey: [u8; 32],
    secret: [u8; 32],
    program_count: u8,
    tvl_amounts: [u64; MAX_PROGRAMS],

    // Public inputs (visible to verifier)
    min_tvl: pub u64,
    epoch: pub u64,           // Temporal binding (e.g., day number, campaign ID)
    data_hash: pub [u8; 32],  // Hash of private TVL data for integrity
    commitment: pub [u8; 32],
    nullifier: pub [u8; 32]
) {
    // 1. Verify commitment = hash(wallet_pubkey || secret)
    let computed_commitment = compute_commitment(wallet_pubkey, secret);
    assert(computed_commitment == commitment);

    // 2. Verify program count is valid
    assert(program_count >= 1);
    assert(program_count as u32 <= MAX_PROGRAMS);

    // 3. Sum TVL across all programs
    let mut total_tvl: u64 = 0;
    for i in 0..MAX_PROGRAMS {
        total_tvl = total_tvl + tvl_amounts[i];
    }

    // 4. Verify total TVL meets threshold
    assert(total_tvl >= min_tvl);

    // 5. Verify data hash matches private data
    // This ensures the prover can't lie about TVL amounts
    let mut tvl_for_hash: [u64; 8] = [0; 8];
    for i in 0..MAX_PROGRAMS {
        tvl_for_hash[i] = tvl_amounts[i];
    }
    let data_bytes = amounts_to_bytes_8(tvl_for_hash);
    let computed_data_hash = compute_data_hash(data_bytes);
    assert(computed_data_hash == data_hash);

    // 6. Verify nullifier with temporal binding
    // nullifier = hash(wallet_pubkey || domain || epoch)
    let computed_nullifier = compute_nullifier_with_epoch(wallet_pubkey, DOMAIN_DEV, epoch);
    assert(computed_nullifier == nullifier);
}

// ============================================================================
// Helper for tests
// ============================================================================

fn compute_test_nullifier(wallet_pubkey: [u8; 32], epoch: u64) -> [u8; 32] {
    compute_nullifier_with_epoch(wallet_pubkey, DOMAIN_DEV, epoch)
}

fn compute_test_data_hash(tvl_amounts: [u64; MAX_PROGRAMS]) -> [u8; 32] {
    let mut tvl_for_hash: [u64; 8] = [0; 8];
    for i in 0..MAX_PROGRAMS {
        tvl_for_hash[i] = tvl_amounts[i];
    }
    let data_bytes = amounts_to_bytes_8(tvl_for_hash);
    compute_data_hash(data_bytes)
}

// ============================================================================
// Tests
// ============================================================================

#[test]
fn test_valid_proof() {
    let wallet_pubkey: [u8; 32] = [1; 32];
    let secret: [u8; 32] = [2; 32];
    let epoch: u64 = 20260120; // Example: YYYYMMDD format

    // Compute commitment
    let commitment = compute_commitment(wallet_pubkey, secret);

    // Compute nullifier with epoch
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // TVL: 50K + 40K + 30K = 120K (meets 100K threshold)
    let tvl_amounts: [u64; MAX_PROGRAMS] = [50000, 40000, 30000, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        3,
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_threshold_exact_match() {
    let wallet_pubkey: [u8; 32] = [3; 32];
    let secret: [u8; 32] = [4; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // Exactly 100K TVL
    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        1,
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_different_epochs_different_nullifiers() {
    let wallet_pubkey: [u8; 32] = [5; 32];

    let nullifier_epoch1 = compute_test_nullifier(wallet_pubkey, 1);
    let nullifier_epoch2 = compute_test_nullifier(wallet_pubkey, 2);

    // Critical security property: different epochs = different nullifiers
    assert(nullifier_epoch1 != nullifier_epoch2);
}

// === Negative Tests ===

#[test(should_fail)]
fn test_below_threshold_fails() {
    let wallet_pubkey: [u8; 32] = [5; 32];
    let secret: [u8; 32] = [6; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // Only 50K TVL (below 100K threshold)
    let tvl_amounts: [u64; MAX_PROGRAMS] = [30000, 20000, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        2,
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_commitment_fails() {
    let wallet_pubkey: [u8; 32] = [7; 32];
    let secret: [u8; 32] = [8; 32];
    let epoch: u64 = 1;

    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // Use WRONG commitment
    let wrong_commitment: [u8; 32] = [0; 32];

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 50000, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        2,
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        wrong_commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_nullifier_fails() {
    let wallet_pubkey: [u8; 32] = [9; 32];
    let secret: [u8; 32] = [10; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);

    // Use WRONG nullifier
    let wrong_nullifier: [u8; 32] = [0; 32];

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 50000, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        2,
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        wrong_nullifier
    );
}

#[test(should_fail)]
fn test_wrong_epoch_nullifier_fails() {
    let wallet_pubkey: [u8; 32] = [11; 32];
    let secret: [u8; 32] = [12; 32];

    let commitment = compute_commitment(wallet_pubkey, secret);

    // Compute nullifier with epoch 1
    let nullifier = compute_test_nullifier(wallet_pubkey, 1);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    // But use epoch 2 in the proof - should fail
    main(
        wallet_pubkey,
        secret,
        1,
        tvl_amounts,
        100000,
        2,  // Different epoch
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_data_hash_fails() {
    let wallet_pubkey: [u8; 32] = [13; 32];
    let secret: [u8; 32] = [14; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // Actual TVL amounts
    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];

    // Compute hash from DIFFERENT amounts
    let fake_amounts: [u64; MAX_PROGRAMS] = [200000, 0, 0, 0, 0];
    let wrong_data_hash = compute_test_data_hash(fake_amounts);

    // Should fail - data hash doesn't match actual TVL
    main(
        wallet_pubkey,
        secret,
        1,
        tvl_amounts,
        100000,
        epoch,
        wrong_data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_zero_programs_fails() {
    let wallet_pubkey: [u8; 32] = [15; 32];
    let secret: [u8; 32] = [16; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [0, 0, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        0,  // Zero programs - should fail
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

// === Additional Edge Case Tests ===

#[test]
fn test_single_program_meets_threshold() {
    let wallet_pubkey: [u8; 32] = [17; 32];
    let secret: [u8; 32] = [18; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [200000, 0, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        1,
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_max_programs() {
    let wallet_pubkey: [u8; 32] = [19; 32];
    let secret: [u8; 32] = [20; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // All 5 programs with TVL
    let tvl_amounts: [u64; MAX_PROGRAMS] = [20000, 20000, 20000, 20000, 20000];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        5,
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_zero_threshold() {
    let wallet_pubkey: [u8; 32] = [21; 32];
    let secret: [u8; 32] = [22; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [0, 0, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        1,
        tvl_amounts,
        0,  // Zero threshold
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_exceed_max_programs_fails() {
    let wallet_pubkey: [u8; 32] = [23; 32];
    let secret: [u8; 32] = [24; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        6,  // Exceeds MAX_PROGRAMS
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_large_tvl_values() {
    let wallet_pubkey: [u8; 32] = [25; 32];
    let secret: [u8; 32] = [26; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // Large TVL values (billions)
    let tvl_amounts: [u64; MAX_PROGRAMS] = [1000000000000, 500000000000, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    main(
        wallet_pubkey,
        secret,
        2,
        tvl_amounts,
        1000000000000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_secret_fails() {
    let wallet_pubkey: [u8; 32] = [27; 32];
    let secret: [u8; 32] = [28; 32];
    let wrong_secret: [u8; 32] = [29; 32];
    let epoch: u64 = 1;

    // Compute commitment with CORRECT secret
    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    // Use WRONG secret - should fail
    main(
        wallet_pubkey,
        wrong_secret,
        1,
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_wallet_fails() {
    let wallet_pubkey: [u8; 32] = [30; 32];
    let wrong_wallet: [u8; 32] = [31; 32];
    let secret: [u8; 32] = [32; 32];
    let epoch: u64 = 1;

    // Compute with CORRECT wallet
    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];
    let data_hash = compute_test_data_hash(tvl_amounts);

    // Use WRONG wallet - should fail
    main(
        wrong_wallet,
        secret,
        1,
        tvl_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}
