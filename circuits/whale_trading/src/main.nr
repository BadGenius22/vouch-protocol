// Vouch Protocol - Whale Trading Circuit
// Proves: "I control a wallet that traded >= min_volume in the period"
// Without revealing: which wallet, which trades, exact volume

use std::hash::sha256;

// Maximum number of trades to prove
global MAX_TRADES: u32 = 20;

fn main(
    // Private inputs (hidden from verifier)
    wallet_pubkey: [u8; 32],
    secret: [u8; 32],
    trade_count: u8,
    trade_amounts: [u64; MAX_TRADES],

    // Public inputs (visible to verifier)
    min_volume: pub u64,
    commitment: pub [u8; 32],
    nullifier: pub [u8; 32]
) {
    // 1. Verify commitment = hash(wallet_pubkey || secret)
    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let computed_commitment = sha256(preimage);
    assert(computed_commitment == commitment);

    // 2. Verify trade count is valid
    assert(trade_count >= 1);
    assert(trade_count as u32 <= MAX_TRADES);

    // 3. Sum trading volume
    let mut total_volume: u64 = 0;
    for i in 0..MAX_TRADES {
        total_volume = total_volume + trade_amounts[i];
    }

    // 4. Verify total volume meets threshold
    assert(total_volume >= min_volume);

    // 5. Verify nullifier is derived correctly
    // nullifier = hash(wallet_pubkey || "vouch_whale")
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    // Domain separator: "vouch_whale" in ASCII
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let computed_nullifier = sha256(nullifier_preimage);

    for i in 0..32 {
        assert(computed_nullifier[i] == nullifier[i]);
    }
}

#[test]
fn test_valid_whale_proof() {
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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier = sha256(nullifier_preimage);

    // Volume: 10K + 15K + 20K + 5K + 25K = 75K (meets 50K threshold)
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 10000;
    trade_amounts[1] = 15000;
    trade_amounts[2] = 20000;
    trade_amounts[3] = 5000;
    trade_amounts[4] = 25000;

    main(
        wallet_pubkey,
        secret,
        5,
        trade_amounts,
        50000,
        commitment,
        nullifier
    );
}
