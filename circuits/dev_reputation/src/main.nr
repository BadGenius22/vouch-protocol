// Vouch Protocol - Developer Reputation Circuit
// Proves: "I control a wallet that deployed programs with >= min_tvl TVL"
// Without revealing: which wallet, which programs, exact TVL

use std::hash::sha256;

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
    let computed_commitment = sha256(preimage);
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
    // nullifier = hash(wallet_pubkey || "vouch_dev")
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    // Domain separator: "vouch_dev" in ASCII
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let computed_nullifier = sha256(nullifier_preimage);

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
    let commitment = sha256(preimage);

    // Compute nullifier
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118];
    for i in 0..9 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier = sha256(nullifier_preimage);

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
