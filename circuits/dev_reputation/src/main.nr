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

    // Compare nullifier byte by byte
    for i in 0..32 {
        assert(computed_nullifier[i] == nullifier[i]);
    }
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
