// Vouch Protocol - Whale Trading Circuit (v2)
// Proves: "I control a wallet that traded >= min_volume in the period"
// Without revealing: which wallet, which trades, exact volume
//
// Security features:
// - epoch: Temporal binding prevents replay attacks (nullifiers are time-bound)
// - data_hash: Commits to private data integrity (verifier can check data freshness)

use std::hash::blake2s;
use vouch_lib::{
    compute_commitment,
    compute_nullifier_with_epoch,
    DOMAIN_WHALE
};

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
    epoch: pub u64,           // Temporal binding (e.g., day number, campaign ID)
    data_hash: pub [u8; 32],  // Hash of private trade data for integrity
    commitment: pub [u8; 32],
    nullifier: pub [u8; 32]
) {
    // 1. Verify commitment = hash(wallet_pubkey || secret)
    let computed_commitment = compute_commitment(wallet_pubkey, secret);
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

    // 5. Verify data hash matches private data
    // This ensures the prover can't lie about trade amounts
    // Hash trades in chunks of 8 (using 160 bytes = 20 trades * 8 bytes)
    let computed_data_hash = compute_trade_data_hash(trade_amounts);
    assert(computed_data_hash == data_hash);

    // 6. Verify nullifier with temporal binding
    // nullifier = hash(wallet_pubkey || domain || epoch)
    let computed_nullifier = compute_nullifier_with_epoch(wallet_pubkey, DOMAIN_WHALE, epoch);
    assert(computed_nullifier == nullifier);
}

// ============================================================================
// Helper functions
// ============================================================================

/// Compute hash of trade data (20 u64 values = 160 bytes)
/// We hash in two rounds to avoid large preimage sizes
fn compute_trade_data_hash(trade_amounts: [u64; MAX_TRADES]) -> [u8; 32] {
    // First: hash first 10 trades
    let mut first_half: [u8; 80] = [0; 80];
    for i in 0..10 {
        let bytes = u64_to_bytes(trade_amounts[i]);
        for j in 0..8 {
            first_half[i * 8 + j] = bytes[j];
        }
    }

    // Second: hash second 10 trades
    let mut second_half: [u8; 80] = [0; 80];
    for i in 0..10 {
        let bytes = u64_to_bytes(trade_amounts[10 + i]);
        for j in 0..8 {
            second_half[i * 8 + j] = bytes[j];
        }
    }

    // Combine hashes
    let hash1: [u8; 32] = blake2s(first_half);
    let hash2: [u8; 32] = blake2s(second_half);

    // Final hash = blake2s(hash1 || hash2)
    let mut combined: [u8; 64] = [0; 64];
    for i in 0..32 {
        combined[i] = hash1[i];
        combined[32 + i] = hash2[i];
    }
    blake2s(combined)
}

/// Convert u64 to big-endian bytes
fn u64_to_bytes(value: u64) -> [u8; 8] {
    let mut bytes: [u8; 8] = [0; 8];
    bytes[0] = ((value >> 56) & 0xff) as u8;
    bytes[1] = ((value >> 48) & 0xff) as u8;
    bytes[2] = ((value >> 40) & 0xff) as u8;
    bytes[3] = ((value >> 32) & 0xff) as u8;
    bytes[4] = ((value >> 24) & 0xff) as u8;
    bytes[5] = ((value >> 16) & 0xff) as u8;
    bytes[6] = ((value >> 8) & 0xff) as u8;
    bytes[7] = (value & 0xff) as u8;
    bytes
}

// ============================================================================
// Test helpers
// ============================================================================

fn compute_test_nullifier(wallet_pubkey: [u8; 32], epoch: u64) -> [u8; 32] {
    compute_nullifier_with_epoch(wallet_pubkey, DOMAIN_WHALE, epoch)
}

// ============================================================================
// Tests
// ============================================================================

#[test]
fn test_valid_whale_proof() {
    let wallet_pubkey: [u8; 32] = [1; 32];
    let secret: [u8; 32] = [2; 32];
    let epoch: u64 = 20260120;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // Volume: 10K + 15K + 20K + 5K + 25K = 75K (meets 50K threshold)
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 10000;
    trade_amounts[1] = 15000;
    trade_amounts[2] = 20000;
    trade_amounts[3] = 5000;
    trade_amounts[4] = 25000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        5,
        trade_amounts,
        50000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_high_volume_whale() {
    let wallet_pubkey: [u8; 32] = [5; 32];
    let secret: [u8; 32] = [6; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // High volume: 500K total
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;
    trade_amounts[1] = 150000;
    trade_amounts[2] = 250000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        3,
        trade_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_different_epochs_different_nullifiers() {
    let wallet_pubkey: [u8; 32] = [7; 32];

    let nullifier_epoch1 = compute_test_nullifier(wallet_pubkey, 1);
    let nullifier_epoch2 = compute_test_nullifier(wallet_pubkey, 2);

    // Critical security property
    assert(nullifier_epoch1 != nullifier_epoch2);
}

// === Negative Tests ===

#[test(should_fail)]
fn test_below_threshold_volume_fails() {
    let wallet_pubkey: [u8; 32] = [7; 32];
    let secret: [u8; 32] = [8; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // Only 30K volume (below 50K threshold)
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 10000;
    trade_amounts[1] = 10000;
    trade_amounts[2] = 10000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        3,
        trade_amounts,
        50000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_commitment_fails() {
    let wallet_pubkey: [u8; 32] = [9; 32];
    let secret: [u8; 32] = [10; 32];
    let epoch: u64 = 1;

    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);
    let wrong_commitment: [u8; 32] = [0; 32];

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        50000,
        epoch,
        data_hash,
        wrong_commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_nullifier_fails() {
    let wallet_pubkey: [u8; 32] = [11; 32];
    let secret: [u8; 32] = [12; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let wrong_nullifier: [u8; 32] = [0; 32];

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        50000,
        epoch,
        data_hash,
        commitment,
        wrong_nullifier
    );
}

#[test(should_fail)]
fn test_wrong_epoch_nullifier_fails() {
    let wallet_pubkey: [u8; 32] = [13; 32];
    let secret: [u8; 32] = [14; 32];

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, 1);

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    // Use epoch 2 but nullifier computed with epoch 1
    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        50000,
        2,  // Different epoch
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_data_hash_fails() {
    let wallet_pubkey: [u8; 32] = [15; 32];
    let secret: [u8; 32] = [16; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // Actual trades
    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;

    // Hash from fake trades
    let mut fake_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    fake_amounts[0] = 200000;
    let wrong_data_hash = compute_trade_data_hash(fake_amounts);

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        50000,
        epoch,
        wrong_data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_zero_trades_fails() {
    let wallet_pubkey: [u8; 32] = [17; 32];
    let secret: [u8; 32] = [18; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        0,  // Zero trades
        trade_amounts,
        50000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

// === Additional Edge Case Tests ===

#[test]
fn test_single_large_trade() {
    let wallet_pubkey: [u8; 32] = [19; 32];
    let secret: [u8; 32] = [20; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 1000000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_max_trades() {
    let wallet_pubkey: [u8; 32] = [21; 32];
    let secret: [u8; 32] = [22; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    // All 20 trades with 5K each = 100K total
    let trade_amounts: [u64; MAX_TRADES] = [5000; MAX_TRADES];
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        20,
        trade_amounts,
        100000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_zero_threshold() {
    let wallet_pubkey: [u8; 32] = [23; 32];
    let secret: [u8; 32] = [24; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        0,  // Zero threshold
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_exceed_max_trades_fails() {
    let wallet_pubkey: [u8; 32] = [25; 32];
    let secret: [u8; 32] = [26; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let trade_amounts: [u64; MAX_TRADES] = [10000; MAX_TRADES];
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        21,  // Exceeds MAX_TRADES
        trade_amounts,
        50000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_large_volume_values() {
    let wallet_pubkey: [u8; 32] = [27; 32];
    let secret: [u8; 32] = [28; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 1000000000000;
    trade_amounts[1] = 500000000000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        2,
        trade_amounts,
        1000000000000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_secret_fails() {
    let wallet_pubkey: [u8; 32] = [29; 32];
    let secret: [u8; 32] = [30; 32];
    let wrong_secret: [u8; 32] = [31; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        wrong_secret,
        1,
        trade_amounts,
        50000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test(should_fail)]
fn test_wrong_wallet_fails() {
    let wallet_pubkey: [u8; 32] = [32; 32];
    let wrong_wallet: [u8; 32] = [33; 32];
    let secret: [u8; 32] = [34; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 100000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wrong_wallet,
        secret,
        1,
        trade_amounts,
        50000,
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}

#[test]
fn test_threshold_exact_match() {
    let wallet_pubkey: [u8; 32] = [35; 32];
    let secret: [u8; 32] = [36; 32];
    let epoch: u64 = 1;

    let commitment = compute_commitment(wallet_pubkey, secret);
    let nullifier = compute_test_nullifier(wallet_pubkey, epoch);

    let mut trade_amounts: [u64; MAX_TRADES] = [0; MAX_TRADES];
    trade_amounts[0] = 50000;
    let data_hash = compute_trade_data_hash(trade_amounts);

    main(
        wallet_pubkey,
        secret,
        1,
        trade_amounts,
        50000,  // Exact match
        epoch,
        data_hash,
        commitment,
        nullifier
    );
}
