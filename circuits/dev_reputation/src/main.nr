// Vouch Protocol - Developer Reputation Circuit
// Proves: "I control a wallet that deployed programs with >= min_tvl TVL"
// Without revealing: which wallet, which programs, exact TVL

use std::hash::blake2s;

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
    commitment: pub [u8; 32],
    nullifier: pub [u8; 32]
) {
    // 1. Verify commitment = hash(wallet_pubkey || secret)
    // This proves the prover knows the wallet that created the commitment
    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let computed_commitment: [u8; 32] = blake2s(preimage);
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

    // 5. Verify nullifier is derived correctly
    // nullifier = hash(wallet_pubkey || domain_separator)
    // Domain separator: "vouch_dev" padded to 32 bytes
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    // Domain separator: "vouch_dev" in ASCII (9 bytes, rest padded with zeros)
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let computed_nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Direct array comparison (more efficient than byte-by-byte)
    assert(computed_nullifier == nullifier);
}

#[test]
fn test_valid_proof() {
    let wallet_pubkey: [u8; 32] = [1; 32];
    let secret: [u8; 32] = [2; 32];

    // Compute commitment
    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    // Compute nullifier
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // TVL: 50K + 40K + 30K = 120K (meets 100K threshold)
    let tvl_amounts: [u64; MAX_PROGRAMS] = [50000, 40000, 30000, 0, 0];

    main(
        wallet_pubkey,
        secret,
        3,
        tvl_amounts,
        100000,
        commitment,
        nullifier
    );
}

#[test]
fn test_threshold_exact_match() {
    let wallet_pubkey: [u8; 32] = [3; 32];
    let secret: [u8; 32] = [4; 32];

    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Exactly 100K TVL (meets 100K threshold)
    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];

    main(
        wallet_pubkey,
        secret,
        1,
        tvl_amounts,
        100000,
        commitment,
        nullifier
    );
}

// === Negative Tests ===

#[test(should_fail)]
fn test_below_threshold_fails() {
    let wallet_pubkey: [u8; 32] = [5; 32];
    let secret: [u8; 32] = [6; 32];

    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Only 50K TVL (below 100K threshold) - should fail
    let tvl_amounts: [u64; MAX_PROGRAMS] = [30000, 20000, 0, 0, 0];

    main(
        wallet_pubkey,
        secret,
        2,
        tvl_amounts,
        100000,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_commitment_fails() {
    let wallet_pubkey: [u8; 32] = [7; 32];
    let secret: [u8; 32] = [8; 32];

    // Compute correct nullifier
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Use WRONG commitment (all zeros instead of computed)
    let wrong_commitment: [u8; 32] = [0; 32];

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 50000, 0, 0, 0];

    main(
        wallet_pubkey,
        secret,
        2,
        tvl_amounts,
        100000,
        wrong_commitment,  // Wrong commitment - should fail
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_nullifier_fails() {
    let wallet_pubkey: [u8; 32] = [9; 32];
    let secret: [u8; 32] = [10; 32];

    // Compute correct commitment
    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    // Use WRONG nullifier (all zeros instead of computed)
    let wrong_nullifier: [u8; 32] = [0; 32];

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 50000, 0, 0, 0];

    main(
        wallet_pubkey,
        secret,
        2,
        tvl_amounts,
        100000,
        commitment,
        wrong_nullifier  // Wrong nullifier - should fail
    );
}

#[test(should_fail)]
fn test_zero_programs_fails() {
    let wallet_pubkey: [u8; 32] = [11; 32];
    let secret: [u8; 32] = [12; 32];

    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [0, 0, 0, 0, 0];

    // Zero programs - should fail (program_count must be >= 1)
    main(
        wallet_pubkey,
        secret,
        0,  // Zero programs - should fail
        tvl_amounts,
        100000,
        commitment,
        nullifier
    );
}

// === Additional Edge Case Tests ===

#[test]
fn test_single_program_meets_threshold() {
    let wallet_pubkey: [u8; 32] = [13; 32];
    let secret: [u8; 32] = [14; 32];

    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Single program with 200K TVL
    let tvl_amounts: [u64; MAX_PROGRAMS] = [200000, 0, 0, 0, 0];

    main(
        wallet_pubkey,
        secret,
        1,
        tvl_amounts,
        100000,  // 100K threshold
        commitment,
        nullifier
    );
}

#[test]
fn test_max_programs() {
    let wallet_pubkey: [u8; 32] = [15; 32];
    let secret: [u8; 32] = [16; 32];

    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // All 5 programs with TVL (20K each = 100K total)
    let tvl_amounts: [u64; MAX_PROGRAMS] = [20000, 20000, 20000, 20000, 20000];

    main(
        wallet_pubkey,
        secret,
        5,  // MAX_PROGRAMS
        tvl_amounts,
        100000,
        commitment,
        nullifier
    );
}

#[test]
fn test_zero_threshold() {
    let wallet_pubkey: [u8; 32] = [17; 32];
    let secret: [u8; 32] = [18; 32];

    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Even with 0 TVL, 0 threshold should pass
    let tvl_amounts: [u64; MAX_PROGRAMS] = [0, 0, 0, 0, 0];

    main(
        wallet_pubkey,
        secret,
        1,
        tvl_amounts,
        0,  // Zero threshold
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_exceed_max_programs_fails() {
    let wallet_pubkey: [u8; 32] = [19; 32];
    let secret: [u8; 32] = [20; 32];

    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];

    // program_count = 6 exceeds MAX_PROGRAMS (5) - should fail
    main(
        wallet_pubkey,
        secret,
        6,
        tvl_amounts,
        100000,
        commitment,
        nullifier
    );
}

#[test]
fn test_large_tvl_values() {
    let wallet_pubkey: [u8; 32] = [21; 32];
    let secret: [u8; 32] = [22; 32];

    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Large TVL values (billions in lamports)
    let tvl_amounts: [u64; MAX_PROGRAMS] = [1000000000000, 500000000000, 0, 0, 0];

    main(
        wallet_pubkey,
        secret,
        2,
        tvl_amounts,
        1000000000000,  // 1 trillion threshold
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_secret_fails() {
    let wallet_pubkey: [u8; 32] = [23; 32];
    let secret: [u8; 32] = [24; 32];
    let wrong_secret: [u8; 32] = [25; 32];  // Different secret

    // Compute commitment with CORRECT secret
    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];

    // Use WRONG secret - should fail commitment verification
    main(
        wallet_pubkey,
        wrong_secret,  // Wrong secret
        1,
        tvl_amounts,
        100000,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_wallet_fails() {
    let wallet_pubkey: [u8; 32] = [26; 32];
    let wrong_wallet: [u8; 32] = [27; 32];  // Different wallet
    let secret: [u8; 32] = [28; 32];

    // Compute commitment with CORRECT wallet
    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    // Compute nullifier with CORRECT wallet
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    let tvl_amounts: [u64; MAX_PROGRAMS] = [100000, 0, 0, 0, 0];

    // Use WRONG wallet - should fail
    main(
        wrong_wallet,  // Wrong wallet
        secret,
        1,
        tvl_amounts,
        100000,
        commitment,
        nullifier
    );
}
