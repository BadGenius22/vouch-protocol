// Vouch Protocol - Shared Circuit Library
// Common cryptographic functions used across all circuits

use std::hash::blake2s;

/// Compute commitment = blake2s(wallet_pubkey || secret)
/// This proves the prover knows the wallet that created the commitment
pub fn compute_commitment(wallet_pubkey: [u8; 32], secret: [u8; 32]) -> [u8; 32] {
    let mut preimage: [u8; 64] = [0; 64];
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
        preimage[i + 32] = secret[i];
    }
    blake2s(preimage)
}

/// Compute nullifier with temporal binding
/// nullifier = blake2s(wallet_pubkey || domain || epoch_bytes)
///
/// The epoch adds temporal binding to prevent replay attacks:
/// - Same wallet + same domain + different epoch = different nullifier
/// - Epoch can represent: day number, week number, campaign ID, etc.
///
/// Layout: [wallet_pubkey (32 bytes)] [domain (up to 24 bytes)] [epoch (8 bytes)]
pub fn compute_nullifier_with_epoch<let DOMAIN_LEN: u32>(
    wallet_pubkey: [u8; 32],
    domain: [u8; DOMAIN_LEN],
    epoch: u64
) -> [u8; 32] {
    // Use 72-byte preimage: 32 (wallet) + 32 (domain padded) + 8 (epoch)
    let mut preimage: [u8; 72] = [0; 72];

    // Copy wallet pubkey
    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
    }

    // Copy domain (padded to 32 bytes)
    for i in 0..DOMAIN_LEN {
        preimage[32 + i] = domain[i];
    }

    // Append epoch as big-endian bytes
    let epoch_bytes = epoch_to_bytes(epoch);
    for i in 0..8 {
        preimage[64 + i] = epoch_bytes[i];
    }

    blake2s(preimage)
}

/// Legacy nullifier computation (without epoch) - for backwards compatibility
/// nullifier = blake2s(wallet_pubkey || domain_padded_to_32)
pub fn compute_nullifier_legacy<let DOMAIN_LEN: u32>(
    wallet_pubkey: [u8; 32],
    domain: [u8; DOMAIN_LEN]
) -> [u8; 32] {
    let mut preimage: [u8; 64] = [0; 64];

    for i in 0..32 {
        preimage[i] = wallet_pubkey[i];
    }

    for i in 0..DOMAIN_LEN {
        preimage[32 + i] = domain[i];
    }

    blake2s(preimage)
}

/// Compute data hash for private data integrity
/// This ensures the prover commits to specific private data values
pub fn compute_data_hash(data: [u8; 64]) -> [u8; 32] {
    blake2s(data)
}

/// Convert u64 array to bytes for hashing (for TVL/trade amounts)
/// Takes up to 8 u64 values and converts to 64-byte array
pub fn amounts_to_bytes_8(amounts: [u64; 8]) -> [u8; 64] {
    let mut result: [u8; 64] = [0; 64];
    for i in 0..8 {
        let bytes = u64_to_bytes(amounts[i]);
        for j in 0..8 {
            result[i * 8 + j] = bytes[j];
        }
    }
    result
}

/// Convert epoch (u64) to big-endian bytes
pub fn epoch_to_bytes(epoch: u64) -> [u8; 8] {
    u64_to_bytes(epoch)
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
// Domain Separators
// ============================================================================

/// Domain separator for developer reputation circuit
pub global DOMAIN_DEV: [u8; 9] = [118, 111, 117, 99, 104, 95, 100, 101, 118]; // "vouch_dev"

/// Domain separator for whale trading circuit
pub global DOMAIN_WHALE: [u8; 11] = [118, 111, 117, 99, 104, 95, 119, 104, 97, 108, 101]; // "vouch_whale"

// ============================================================================
// Tests
// ============================================================================

#[test]
fn test_commitment_computation() {
    let wallet: [u8; 32] = [1; 32];
    let secret: [u8; 32] = [2; 32];

    let commitment = compute_commitment(wallet, secret);

    // Verify deterministic output
    let commitment2 = compute_commitment(wallet, secret);
    assert(commitment == commitment2);

    // Different input = different output
    let different_secret: [u8; 32] = [3; 32];
    let commitment3 = compute_commitment(wallet, different_secret);
    assert(commitment != commitment3);
}

#[test]
fn test_nullifier_with_epoch() {
    let wallet: [u8; 32] = [1; 32];
    let domain: [u8; 9] = DOMAIN_DEV;

    let nullifier_epoch1 = compute_nullifier_with_epoch(wallet, domain, 1);
    let nullifier_epoch2 = compute_nullifier_with_epoch(wallet, domain, 2);

    // Different epochs = different nullifiers
    assert(nullifier_epoch1 != nullifier_epoch2);

    // Same epoch = same nullifier
    let nullifier_epoch1_again = compute_nullifier_with_epoch(wallet, domain, 1);
    assert(nullifier_epoch1 == nullifier_epoch1_again);
}

#[test]
fn test_domain_separation() {
    let wallet: [u8; 32] = [1; 32];

    let nullifier_dev = compute_nullifier_with_epoch(wallet, DOMAIN_DEV, 1);
    let nullifier_whale = compute_nullifier_with_epoch(wallet, DOMAIN_WHALE, 1);

    // Different domains = different nullifiers (even same wallet, same epoch)
    assert(nullifier_dev != nullifier_whale);
}

#[test]
fn test_u64_to_bytes() {
    // Test with known value: 0x0102030405060708
    let value: u64 = 0x0102030405060708;
    let bytes = u64_to_bytes(value);

    assert(bytes[0] == 1);
    assert(bytes[1] == 2);
    assert(bytes[2] == 3);
    assert(bytes[3] == 4);
    assert(bytes[4] == 5);
    assert(bytes[5] == 6);
    assert(bytes[6] == 7);
    assert(bytes[7] == 8);
}

#[test]
fn test_amounts_to_bytes() {
    let amounts: [u64; 8] = [100, 200, 0, 0, 0, 0, 0, 0];
    let bytes = amounts_to_bytes_8(amounts);

    // First amount (100 = 0x64) should be at bytes 0-7
    assert(bytes[7] == 100); // Last byte of first u64

    // Second amount (200 = 0xC8) should be at bytes 8-15
    assert(bytes[15] == 200); // Last byte of second u64
}
