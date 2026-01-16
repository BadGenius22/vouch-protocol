# Vouch Protocol - Security Audit Preparation Document

> Prepared for Third-Party Security Audit
> Version: 1.0
> Date: January 2026

---

## 1. Executive Summary

Vouch Protocol is a zero-knowledge proof-based anonymous reputation system built on Solana. It enables users to prove on-chain credentials (developer reputation, trading volume) without revealing their wallet address.

### Core Security Properties

| Property | Implementation |
|----------|---------------|
| **Privacy** | Client-side ZK proof generation (wallet address never leaves browser) |
| **Integrity** | Nullifier-based double-proving prevention |
| **Availability** | Decoupled verifier service architecture |
| **Authorization** | Admin controls with pause/unpause capability |

### Audit Scope Recommendation

| Priority | Component | Location | Estimated Hours |
|----------|-----------|----------|-----------------|
| Critical | Anchor Program | `programs/vouch-verifier/` | 40-60 hrs |
| Critical | Noir Circuits | `circuits/` | 20-30 hrs |
| High | Client SDK | `apps/web/src/lib/` | 15-20 hrs |
| Medium | Verifier Service | `apps/verifier/` | 10-15 hrs |
| Low | Frontend | `apps/web/` | 5-10 hrs |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VOUCH PROTOCOL ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐  │
│   │   Browser       │     │  Verifier        │     │   Solana    │  │
│   │   (Next.js)     │     │  Service         │     │   Devnet    │  │
│   │                 │     │                  │     │             │  │
│   │ ┌─────────────┐ │     │ ┌──────────────┐ │     │ ┌─────────┐ │  │
│   │ │ Wallet      │ │     │ │ Barretenberg │ │     │ │ Vouch   │ │  │
│   │ │ Adapter     │ │     │ │ Verifier     │ │     │ │ Program │ │  │
│   │ └─────────────┘ │     │ └──────────────┘ │     │ └─────────┘ │  │
│   │                 │     │                  │     │             │  │
│   │ ┌─────────────┐ │     │ ┌──────────────┐ │     │ ┌─────────┐ │  │
│   │ │ NoirJS +    │ │────▶│ │ Rate Limit   │ │────▶│ │ PDAs    │ │  │
│   │ │ bb.js       │ │     │ │ Middleware   │ │     │ │         │ │  │
│   │ │ (Proof Gen) │ │     │ └──────────────┘ │     │ │-config  │ │  │
│   │ └─────────────┘ │     │                  │     │ │-nullif. │ │  │
│   │                 │     │ ┌──────────────┐ │     │ │-commit. │ │  │
│   │ ┌─────────────┐ │     │ │ Express API  │ │     │ │-rate_lim│ │  │
│   │ │ Helius      │ │     │ └──────────────┘ │     │ └─────────┘ │  │
│   │ │ (Server Act)│ │     │                  │     │             │  │
│   │ └─────────────┘ │     │                  │     │             │  │
│   └─────────────────┘     └──────────────────┘     └─────────────┘  │
│                                                                       │
│   Private Data Flow: Wallet → Proof Gen → Never Leaves Browser       │
│   Public Data Flow: Proof → Verifier → Attestation → Solana          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User connects wallet** (browser-only, private key never exposed)
2. **Server Action fetches on-chain data** via Helius (API key server-side only)
3. **ZK proof generated in browser** using NoirJS + Barretenberg WASM
4. **Proof sent to Verifier Service** for cryptographic verification
5. **Verifier creates on-chain attestation** recording the verified proof
6. **Nullifier prevents re-use** of the same proof

---

## 3. Security Model

### 3.1 Trust Assumptions

| Component | Trust Level | Rationale |
|-----------|-------------|-----------|
| User's Browser | Trusted | Proof generation happens locally |
| Helius API | Semi-trusted | Only fetches public on-chain data |
| Verifier Service | Trusted Operator | Can be decentralized in future |
| Solana Program | Trustless | Verified by consensus |
| Noir Circuits | Cryptographically Secure | UltraHonk proof system |

### 3.2 Security Properties

#### Privacy Guarantees
- **Wallet Address**: Never revealed to verifiers or on-chain
- **Transaction History**: Used only for proof generation, never transmitted
- **Secret**: Random 32-byte value that proves wallet ownership

#### Integrity Guarantees
- **Nullifier**: Prevents same proof from being used twice
- **Commitment**: Binds proof to specific wallet without revealing it
- **Domain Separation**: Different proof types have different domain separators

### 3.3 Nullifier Pattern

```
commitment = blake2s(wallet_pubkey || secret)
nullifier  = blake2s(wallet_pubkey || domain || zeros)

Where:
- wallet_pubkey: 32 bytes (private input)
- secret: 32 bytes (private input, user-generated)
- domain: "vouch_dev" (9 bytes) or "vouch_whale" (11 bytes)
- zeros: Padding to 32 bytes
```

---

## 4. Threat Model

### 4.1 Attacker Profiles

| Attacker | Capabilities | Goals |
|----------|-------------|-------|
| Malicious User | Can generate fake proofs | Claim false credentials |
| Network Observer | Can see transactions | De-anonymize users |
| Malicious Verifier | Can submit false attestations | Damage reputation system |
| Smart Contract Attacker | Can craft malicious transactions | Drain funds, DoS |

### 4.2 Attack Vectors and Mitigations

#### A. Proof Forgery
- **Risk**: User creates proof without meeting threshold
- **Mitigation**: Cryptographic soundness of UltraHonk prevents forgery
- **Verification**: Barretenberg verifier in verifier service

#### B. Double-Proving
- **Risk**: User uses same credential multiple times
- **Mitigation**: Nullifier stored on-chain, checked before verification
- **Location**: `programs/vouch-verifier/src/lib.rs` - `verify_dev_reputation`

#### C. Replay Attacks
- **Risk**: Old proofs submitted again
- **Mitigation**: Proof TTL validation, nullifier uniqueness
- **Location**: `apps/web/src/lib/security.ts` - TTL functions

#### D. Transaction Linkability
- **Risk**: Observer links proof submission to original wallet
- **Mitigation**: Burner wallet pattern for proof submission
- **Implementation**: User can submit from any wallet

#### E. Rate Limit Bypass
- **Risk**: Attacker submits many proofs to DoS system
- **Mitigation**: Per-wallet rate limiting with PDA tracking
- **Location**: `programs/vouch-verifier/src/lib.rs` - `RateLimit` account

#### F. Admin Key Compromise
- **Risk**: Admin key stolen, used to pause/manipulate protocol
- **Mitigation**: Multisig recommended, timelock for critical operations
- **TODO**: Implement multisig authority

---

## 5. Component Security Analysis

### 5.1 Anchor Program (`programs/vouch-verifier/`)

#### Critical Functions

| Function | Purpose | Security Considerations |
|----------|---------|------------------------|
| `initialize_config` | Set up protocol | Should only be callable once |
| `pause_protocol` | Emergency stop | Admin-only, emits event |
| `verify_dev_reputation` | Record dev proof | Checks nullifier, rate limit |
| `verify_whale_trading` | Record whale proof | Checks nullifier, rate limit |
| `init_rate_limit` | Create rate limit PDA | One per wallet |
| `add_verifier` / `remove_verifier` | Manage verifiers | Admin-only |

#### PDA Seeds

```rust
// Config (singleton)
seeds = [b"config"]

// Nullifier (one per proof)
seeds = [b"nullifier", nullifier.as_ref()]

// Commitment (one per wallet-domain)
seeds = [b"commitment", commitment.as_ref()]

// Rate Limit (one per wallet)
seeds = [b"rate_limit", wallet.as_ref()]

// Verifier Status (one per verifier)
seeds = [b"verifier", verifier.as_ref()]
```

#### Audit Focus Areas

1. **Nullifier uniqueness enforcement** - Critical for preventing double-proving
2. **Rate limit counter resets** - Ensure daily reset works correctly
3. **Admin controls** - Verify pause/unpause affects all functions
4. **Event emission** - All state changes should emit events
5. **Account validation** - Ensure all accounts are properly validated

### 5.2 Noir Circuits (`circuits/`)

#### Developer Reputation Circuit

```
Inputs:
  Private: wallet_pubkey[32], secret[32], program_count, tvl_amounts[5]
  Public: min_tvl, commitment[32], nullifier[32]

Constraints:
  1. commitment == blake2s(wallet_pubkey || secret)
  2. nullifier == blake2s(wallet_pubkey || "vouch_dev" || zeros)
  3. sum(tvl_amounts[0..program_count]) >= min_tvl
  4. program_count <= 5
```

#### Whale Trading Circuit

```
Inputs:
  Private: wallet_pubkey[32], secret[32], trade_count, trade_amounts[20]
  Public: min_volume, commitment[32], nullifier[32]

Constraints:
  1. commitment == blake2s(wallet_pubkey || secret)
  2. nullifier == blake2s(wallet_pubkey || "vouch_whale" || zeros)
  3. sum(trade_amounts[0..trade_count]) >= min_volume
  4. trade_count <= 20
```

#### Audit Focus Areas

1. **Constraint completeness** - All claims must be constrained
2. **Hash function usage** - Blake2s implementation correctness
3. **Domain separation** - Different circuits have different domains
4. **Overflow protection** - Large TVL/volume values handled correctly
5. **Array bounds** - program_count/trade_count properly bounded

### 5.3 Client SDK (`apps/web/src/lib/`)

#### Key Files

| File | Purpose | Security Focus |
|------|---------|---------------|
| `proof.ts` | Proof generation | Secret randomness, data handling |
| `security.ts` | Input validation | XSS prevention, size limits |
| `circuit.ts` | Circuit loading | WASM integrity, caching |
| `verify.ts` | On-chain submission | Transaction signing |
| `types.ts` | Error handling | No sensitive data in errors |

#### Audit Focus Areas

1. **Secret generation** - Uses `crypto.getRandomValues()`
2. **Input sanitization** - All user inputs validated
3. **Proof size limits** - MAX_PROOF_SIZE_BYTES = 4096
4. **TTL enforcement** - Proofs expire after 5 minutes default
5. **Error messages** - No wallet addresses in error messages

### 5.4 Verifier Service (`apps/verifier/`)

#### Endpoints

| Endpoint | Method | Purpose | Security |
|----------|--------|---------|----------|
| `/api/verify` | POST | Verify proof | Rate limited |
| `/health` | GET | Health check | Public |

#### Audit Focus Areas

1. **Proof validation** - Barretenberg verification correctness
2. **Rate limiting** - Redis-based, per-IP and per-wallet
3. **Error handling** - No proof data in logs
4. **Authorization** - Verifier keypair protection

---

## 6. Test Coverage Summary

### 6.1 Anchor Program Tests

**Location**: `tests/vouch-verifier.ts`
**Framework**: Anchor Test + Chai

| Test Category | Tests | Coverage |
|--------------|-------|----------|
| Configuration | 4 | Initialize, update, events |
| Admin Controls | 6 | Pause, unpause, admin transfer |
| Rate Limiting | 5 | Init, enforcement, reset |
| Verifier Management | 4 | Add, remove, status |
| Commitments | 3 | Create, duplicate prevention |
| Nullifiers | 4 | Create, reuse prevention |
| Dev Reputation | 6 | Valid proof, invalid states |
| Whale Trading | 4 | Valid proof, invalid states |
| **Total** | **36+** | **~90%** |

### 6.2 Noir Circuit Tests

**Location**: `circuits/*/src/main.nr`
**Framework**: Nargo test

| Circuit | Test Cases |
|---------|-----------|
| dev_reputation | 8 tests (valid proof, edge cases, failures) |
| whale_trading | 9 tests (valid proof, edge cases, failures) |
| **Total** | **17+** | **~95%** |

### 6.3 Client SDK Tests

**Location**: `apps/web/src/__tests__/`
**Framework**: Vitest

| Test File | Coverage |
|-----------|----------|
| security.test.ts | TTL, validation, sanitization |
| types.test.ts | Error codes, constants |
| proof.test.ts | Serialization, round-trip |
| **Total** | **~80%** |

### 6.4 E2E Tests

**Location**: `apps/web/e2e/`
**Framework**: Playwright

| Test File | Test Count |
|-----------|-----------|
| homepage.spec.ts | 22 tests |
| developer.spec.ts | 18 tests |
| whale.spec.ts | 18 tests |
| navigation.spec.ts | 25 tests |
| error-handling.spec.ts | 20 tests |
| **Total** | **100+** |

---

## 7. Known Issues and Limitations

### 7.1 Current Limitations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| Single verifier operator | Centralization risk | Multi-verifier planned |
| No upgrade mechanism | Can't fix bugs post-deploy | Redeploy required |
| Browser-only proof gen | Mobile limitations | PWA support planned |
| Helius dependency | Single data provider | Fallback RPCs planned |

### 7.2 Accepted Risks

| Risk | Rationale |
|------|-----------|
| Verifier can censor proofs | Trust assumption, decentralize later |
| Admin can pause protocol | Emergency response capability |
| No slashing for false attestations | V1 simplicity, add in V2 |

### 7.3 TODO Items for Audit

- [ ] Implement multisig for admin operations
- [ ] Add timelock for critical operations
- [ ] Add verifier rotation mechanism
- [ ] Implement proof compression for on-chain storage
- [ ] Add emergency withdrawal mechanism

---

## 8. Recommendations for Auditors

### 8.1 Priority Areas

1. **Nullifier uniqueness** - Most critical security property
2. **Circuit constraint completeness** - Ensure all claims are proven
3. **Rate limit bypass** - Check for edge cases
4. **Admin privilege escalation** - Verify access controls
5. **Proof validation** - Barretenberg integration correctness

### 8.2 Suggested Testing

```bash
# Run Anchor tests
cd /path/to/vouch-protocol
pnpm anchor:test

# Run Circuit tests
pnpm circuits:test

# Run Client SDK tests
cd apps/web && pnpm test:run

# Run E2E tests
cd apps/web && pnpm test:e2e
```

### 8.3 Key Code Paths

| Path | Criticality | Notes |
|------|-------------|-------|
| `programs/vouch-verifier/src/lib.rs:verify_dev_reputation` | Critical | Main verification logic |
| `circuits/dev_reputation/src/main.nr:main` | Critical | Circuit constraints |
| `apps/verifier/src/routes/verify.ts` | High | Proof verification |
| `apps/web/src/lib/proof.ts:generateDevReputationProof` | High | Proof generation |
| `apps/web/src/lib/security.ts` | Medium | Input validation |

### 8.4 Environment Setup

```bash
# Prerequisites
- Node.js 18+
- Rust 1.70+
- Nargo 1.0.0-beta.18
- Anchor CLI 0.29+
- Solana CLI 1.18+

# Install dependencies
pnpm install

# Build everything
pnpm build
pnpm anchor:build
pnpm circuits:compile
```

---

## 9. Contact Information

For questions during the audit:

- **Technical Lead**: [Contact Info]
- **Security Contact**: security@vouch.protocol
- **Repository**: https://github.com/vouch-protocol/vouch

---

## Appendix A: Account Structures

```rust
// Configuration singleton
pub struct Config {
    pub admin: Pubkey,
    pub is_paused: bool,
    pub max_proofs_per_day: u32,
    pub cooldown_seconds: i64,
    pub total_proofs_verified: u64,
    pub bump: u8,
}

// Nullifier tracking
pub struct Nullifier {
    pub nullifier: [u8; 32],
    pub used: bool,
    pub used_at: i64,
    pub bump: u8,
}

// Commitment tracking
pub struct Commitment {
    pub commitment: [u8; 32],
    pub created_at: i64,
    pub creator: Pubkey,
    pub bump: u8,
}

// Rate limit per wallet
pub struct RateLimit {
    pub wallet: Pubkey,
    pub proofs_today: u32,
    pub last_proof_at: i64,
    pub day_start: i64,
    pub bump: u8,
}

// Verifier status
pub struct VerifierStatus {
    pub verifier: Pubkey,
    pub is_active: bool,
    pub proofs_verified: u64,
    pub added_at: i64,
    pub bump: u8,
}
```

## Appendix B: Event Definitions

```rust
// Protocol initialized
event ConfigInitialized {
    admin: Pubkey,
    max_proofs_per_day: u32,
}

// Protocol paused/unpaused
event ProtocolPaused { admin: Pubkey, timestamp: i64 }
event ProtocolUnpaused { admin: Pubkey, timestamp: i64 }

// Verifier added/removed
event VerifierAdded { verifier: Pubkey, added_by: Pubkey }
event VerifierRemoved { verifier: Pubkey, removed_by: Pubkey }

// Proof verified
event DevReputationVerified {
    commitment: [u8; 32],
    nullifier: [u8; 32],
    min_tvl: u64,
    timestamp: i64,
}

event WhaleTradingVerified {
    commitment: [u8; 32],
    nullifier: [u8; 32],
    min_volume: u64,
    timestamp: i64,
}
```

## Appendix C: Version Information

| Component | Version |
|-----------|---------|
| Nargo CLI | 1.0.0-beta.18 |
| @noir-lang/noir_js | 1.0.0-beta.18 |
| @aztec/bb.js | 0.82.3 |
| Anchor | 0.29.0 |
| Solana | 1.18.x |
| Next.js | 14.2.x |
| Node.js | 18+ |

---

*Document prepared for security audit. Last updated: January 2026*
