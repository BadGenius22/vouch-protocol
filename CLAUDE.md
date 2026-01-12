# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vouch Protocol is a zero-knowledge proof-based anonymous reputation protocol for Solana. It enables developers and traders to prove on-chain credentials without revealing their wallet address or identity.

**Target:** Solana Privacy Hackathon 2026

## Tech Stack

- **Blockchain:** Solana (Anchor 0.29+)
- **ZK Framework:** Noir 1.0.0-beta.18 + UltraHonk (@aztec/bb.js) - client-side proof generation
- **Frontend:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS, shadcn/ui
- **Data:** Helius SDK (via Server Actions)
- **Build System:** Turborepo + pnpm

## Project Structure

```
vouch-protocol/
├── apps/
│   └── web/                     # Next.js 14 frontend (@vouch/web)
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── app/             # App Router
│           │   ├── actions/     # Server Actions (Helius)
│           │   ├── developer/   # Dev proof flow
│           │   └── whale/       # Whale proof flow
│           ├── components/
│           │   ├── layout/
│           │   ├── ui/          # shadcn/ui components
│           │   └── wallet/
│           ├── idl/             # Generated Anchor IDL
│           └── lib/
│               ├── types.ts     # Shared TypeScript types & errors
│               ├── circuit.ts   # Circuit loader utility
│               ├── proof.ts     # Client-side proof generation (NoirJS)
│               ├── verify.ts    # On-chain verification helpers
│               └── utils.ts     # Utility functions
├── circuits/                    # Noir ZK circuits (workspace)
│   ├── Nargo.toml               # Workspace config
│   ├── dev_reputation/
│   │   ├── Nargo.toml
│   │   ├── Prover.toml
│   │   └── src/main.nr
│   └── whale_trading/
│       ├── Nargo.toml
│       ├── Prover.toml
│       └── src/main.nr
├── programs/                    # Anchor/Solana programs
│   └── vouch-verifier/
│       ├── Cargo.toml
│       └── src/lib.rs
├── tests/                       # Anchor integration tests
│   └── vouch-verifier.ts
├── packages/                    # Shared packages (future)
├── turbo.json                   # Turborepo config
├── pnpm-workspace.yaml          # pnpm workspace
├── package.json                 # Root package.json
├── Anchor.toml
├── Cargo.toml                   # Rust workspace
├── tsconfig.json                # Root TypeScript config
├── tsconfig.anchor.json         # Anchor tests config
└── .nvmrc                       # Node version (20)
```

## Commands

```bash
# Setup
pnpm install                     # Install all dependencies

# Development
pnpm dev                         # Start Next.js (port 3000)
pnpm build                       # Build for production
pnpm lint                        # Run ESLint
pnpm typecheck                   # TypeScript type checking

# Circuits (Noir)
pnpm circuits:compile            # Compile all circuits (workspace)
pnpm circuits:test               # Test all circuits (workspace)
pnpm circuits:prove              # Generate proofs (workspace)

# Anchor (Solana)
pnpm anchor:build                # Build Solana program
pnpm anchor:test                 # Run integration tests (ts-mocha)
pnpm anchor:deploy               # Deploy to devnet

# Turborepo filtering
pnpm --filter @vouch/web dev     # Run specific app
pnpm --filter @vouch/web build   # Build specific app

# Maintenance
pnpm clean                       # Clean all build artifacts
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ apps/web/ (Next.js 14)                                      │
├─────────────────────────────────────────────────────────────┤
│ Client (Browser)              │ Server Actions              │
│ • Wallet connection           │ • Helius data fetching      │
│ • NoirJS proof generation     │ • HELIUS_API_KEY (secure)   │
│ • UI/UX with shadcn/ui        │                             │
└───────────────────────────────┴─────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│ Noir Circuits             │   │ Anchor Program              │
│ circuits/                 │   │ programs/vouch-verifier     │
│ • dev_reputation          │   │ • create_commitment         │
│ • whale_trading           │   │ • init_nullifier            │
│                           │   │ • verify_dev_reputation     │
│ Workspace compilation     │   │ • verify_whale_trading      │
└───────────────────────────┘   └─────────────────────────────┘
```

## Key Patterns

### Server Actions (secure data fetching)
```typescript
// apps/web/src/app/actions/helius.ts
'use server';
export async function getDeployedPrograms(wallet: string) {
  // HELIUS_API_KEY never exposed to client
  // Falls back to mock data if key not set
}
```

### Client-side Proof Generation
```typescript
// apps/web/src/lib/proof.ts
export async function generateDevReputationProof(input) {
  // Runs in browser - data never leaves device
  // Uses NoirJS + UltraHonk WASM for real ZK proof generation
  const { noir, backend } = await loadCircuit('dev_reputation');
  const { witness } = await noir.execute(circuitInputs);
  const proofData = await backend.generateProof(witness);
}
```

### Circuit Loader (WASM management)
```typescript
// apps/web/src/lib/circuit.ts
// Handles loading compiled circuits and caching
import { UltraHonkBackend } from '@aztec/bb.js';

export async function loadCircuit(circuitType: CircuitType) {
  // Fetches from /public/circuits/{type}.json
  // Initializes UltraHonkBackend (WASM) - uses SharedArrayBuffer with COOP/COEP headers
  // Caches for 1 hour with race condition prevention
}
```

### Anchor Account Structure
```rust
// programs/vouch-verifier/src/lib.rs
// PDA seeds for nullifier: [b"nullifier", nullifier.as_ref()]
// PDA seeds for commitment: [b"commitment", commitment.as_ref()]
```

### Two-Step Verification Pattern
Nullifier initialization is separate from verification for security:
```rust
// Step 1: Initialize (creates PDA account)
pub fn init_nullifier(ctx, nullifier) -> Result<()>

// Step 2: Verify (marks as used)
pub fn verify_dev_reputation(ctx, proof, public_inputs, min_tvl) -> Result<()>
```

## Proof Flow

1. User connects wallet (client-side)
2. Server Action fetches on-chain data via Helius
3. Data sent to client for proof generation
4. **ZK proof generated in browser** (NoirJS + Barretenberg)
5. Client calls `init_nullifier` to create nullifier PDA
6. Client calls `verify_*` with proof from burner wallet
7. Verifier checks proof, marks nullifier used

## Circuit Logic

### Developer Reputation (`circuits/dev_reputation/src/main.nr`)
- **Proves:** "I control a wallet with ≥ min_tvl TVL across deployed programs"
- **Private inputs:** wallet_pubkey[32], secret[32], program_count, tvl_amounts[5]
- **Public inputs:** min_tvl, commitment[32], nullifier[32]
- **Constraints:**
  - `commitment == blake2s(wallet_pubkey || secret)`
  - `sum(tvl_amounts) >= min_tvl`
  - `nullifier == blake2s(wallet_pubkey || "vouch_dev" || zeros)`

### Whale Trading (`circuits/whale_trading/`)
- **Proves:** "I traded ≥ min_volume in the period"
- **Private inputs:** wallet_pubkey[32], secret[32], trade_count, trade_amounts[20]
- **Same pattern** with domain separator "vouch_whale"

### Nullifier Pattern
```
commitment = blake2s(wallet_pubkey || secret)  // 64 bytes → 32 bytes
nullifier = blake2s(wallet_pubkey || domain || zeros)  // 64 bytes → 32 bytes
```
- **Hash function:** blake2s (from Noir std library)
- Commitment links wallet to proof (proves knowledge)
- Nullifier prevents double-proving (unique per wallet + proof_type)
- Domain separator: "vouch_dev" (9 bytes) or "vouch_whale" (11 bytes), padded with zeros

## Environment Variables

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_VERIFIER_PROGRAM_ID=VouchXXX...
HELIUS_API_KEY=xxx  # Server-side only (optional - falls back to mock)
```

## Current Implementation Status

**Completed (Phase 1):**
- Anchor program with commitment, nullifier, and verification instructions
- Noir circuits for dev_reputation and whale_trading (using blake2s)
- Circuit compilation with Nargo 1.0.0-beta.18
- NoirJS 1.0.0-beta.18 + UltraHonk (@aztec/bb.js@0.82.3) integration for proof generation
- Circuit loader utility with caching and race condition prevention
- COOP/COEP headers for SharedArrayBuffer multithreading support
- Circuit preloading on app initialization for better UX
- Error handling with VouchError types
- Next.js frontend with wallet connection and proof flow UI
- Server Actions for Helius data fetching (with mock fallback)
- TypeScript types with strict typing

**TODO (Phase 2+):**
- Implement actual proof verification in Anchor program
- Connect to real Helius API for on-chain data
- Mint credential NFT on successful verification
- Deploy to devnet with real program ID

## Version Compatibility

| Component | Version |
|-----------|---------|
| Nargo CLI | 1.0.0-beta.18 |
| @noir-lang/noir_js | 1.0.0-beta.18 |
| @aztec/bb.js | 0.82.3 |
| @noir-lang/types | 1.0.0-beta.18 |

**Note:** All Noir components must use matching versions. Pin exact versions to avoid type conflicts.

## Proving System Choice

**UltraHonk** (current) vs **UltraPlonk**:

| Backend | Proving Speed | RAM Usage | On-Chain Gas | Best For |
|---------|---------------|-----------|--------------|----------|
| UltraHonk | ⚡ Faster | Lower | Higher | Browser/Client proofs |
| UltraPlonk | Slower | Higher | Lower | EVM on-chain verification |

We use UltraHonk because Vouch generates proofs client-side and verifies on Solana (not EVM).

## Reference Documents

- **IMPLEMENTATION_PLAN.md:** Detailed execution plan with 6 phases
