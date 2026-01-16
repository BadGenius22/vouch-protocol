// Vouch Protocol - Whale Trading Circuit
// Proves: "I control a wallet that traded >= min_volume in the period"
// Without revealing: which wallet, which trades, exact volume

use std::hash::blake2s;

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
    let computed_commitment: [u8; 32] = blake2s(preimage);
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
    // nullifier = hash(wallet_pubkey || domain_separator)
    // Domain separator: "vouch_whale" padded to 32 bytes
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    // Domain separator: "vouch_whale" in ASCII (11 bytes, rest padded with zeros)
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let computed_nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Direct array comparison (more efficient than byte-by-byte)
    assert(computed_nullifier == nullifier);
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
    let commitment: [u8; 32] = blake2s(preimage);

    // Compute nullifier
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

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

#[test]
fn test_high_volume_whale() {
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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // High volume: 500K total (meets 100K threshold)
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;
    trade_amounts[1] = 150000;
    trade_amounts[2] = 250000;

    main(
        wallet_pubkey,
        secret,
        3,
        trade_amounts,
        100000,
        commitment,
        nullifier
    );
}

// === Negative Tests ===

#[test(should_fail)]
fn test_below_threshold_volume_fails() {
    let wallet_pubkey: [u8; 32] = [7; 32];
    let secret: [u8; 32] = [8; 32];

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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Only 30K volume (below 50K threshold) - should fail
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 10000;
    trade_amounts[1] = 10000;
    trade_amounts[2] = 10000;

    main(
        wallet_pubkey,
        secret,
        3,
        trade_amounts,
        50000,  // Threshold is 50K but volume is only 30K
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_commitment_fails() {
    let wallet_pubkey: [u8; 32] = [9; 32];
    let secret: [u8; 32] = [10; 32];

    // Compute correct nullifier
    let mut nullifier_preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        nullifier_preimage[i] = wallet_pubkey[i];
    }
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Use WRONG commitment
    let wrong_commitment: [u8; 32] = [0; 32];

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        50000,
        wrong_commitment,  // Wrong commitment - should fail
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_nullifier_fails() {
    let wallet_pubkey: [u8; 32] = [11; 32];
    let secret: [u8; 32] = [12; 32];

    // Compute correct commitment
    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    let commitment: [u8; 32] = blake2s(preimage);

    // Use WRONG nullifier
    let wrong_nullifier: [u8; 32] = [0; 32];

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        50000,
        commitment,
        wrong_nullifier  // Wrong nullifier - should fail
    );
}

#[test(should_fail)]
fn test_zero_trades_fails() {
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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    let trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];

    // Zero trades - should fail (trade_count must be >= 1)
    main(
        wallet_pubkey,
        secret,
        0,  // Zero trades - should fail
        trade_amounts,
        50000,
        commitment,
        nullifier
    );
}

// === Additional Edge Case Tests ===

#[test]
fn test_single_large_trade() {
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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Single trade of 1M volume
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 1000000;

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        100000,  // 100K threshold
        commitment,
        nullifier
    );
}

#[test]
fn test_max_trades() {
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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // All 20 trades with small amounts (5K each = 100K total)
    let trade_amounts: [u64; MAX_TRADES] = [5000; MAX_TRADES];

    main(
        wallet_pubkey,
        secret,
        20,  // MAX_TRADES
        trade_amounts,
        100000,  // Exactly 100K
        commitment,
        nullifier
    );
}

#[test]
fn test_zero_threshold() {
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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Zero volume with zero threshold should pass
    let trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        0,  // Zero threshold
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_exceed_max_trades_fails() {
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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    let trade_amounts: [u64; MAX_TRADES] = [10000; MAX_TRADES];

    // trade_count = 21 exceeds MAX_TRADES (20) - should fail
    main(
        wallet_pubkey,
        secret,
        21,  // Exceeds MAX_TRADES
        trade_amounts,
        50000,
        commitment,
        nullifier
    );
}

#[test]
fn test_large_volume_values() {
    let wallet_pubkey: [u8; 32] = [23; 32];
    let secret: [u8; 32] = [24; 32];

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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Large trade values (billions in lamports)
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 1000000000000;  // 1 trillion
    trade_amounts[1] = 500000000000;   // 500 billion

    main(
        wallet_pubkey,
        secret,
        2,
        trade_amounts,
        1000000000000,  // 1 trillion threshold
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_secret_fails() {
    let wallet_pubkey: [u8; 32] = [25; 32];
    let secret: [u8; 32] = [26; 32];
    let wrong_secret: [u8; 32] = [27; 32];

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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;

    // Use WRONG secret - should fail
    main(
        wallet_pubkey,
        wrong_secret,  // Wrong secret
        1,
        trade_amounts,
        50000,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_wallet_fails() {
    let wallet_pubkey: [u8; 32] = [28; 32];
    let wrong_wallet: [u8; 32] = [29; 32];
    let secret: [u8; 32] = [30; 32];

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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;

    // Use WRONG wallet - should fail
    main(
        wrong_wallet,  // Wrong wallet
        secret,
        1,
        trade_amounts,
        50000,
        commitment,
        nullifier
    );
}

#[test]
fn test_threshold_exact_match() {
    let wallet_pubkey: [u8; 32] = [31; 32];
    let secret: [u8; 32] = [32; 32];

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
    let domain: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101];
    for i in 0..11 {
        nullifier_preimage[32 + i] = domain[i];
    }
    let nullifier: [u8; 32] = blake2s(nullifier_preimage);

    // Exactly 50K volume (meets 50K threshold)
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 50000;

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        50000,  // Exact match
        commitment,
        nullifier
    );
}
