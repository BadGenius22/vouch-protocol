# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vouch Protocol is a zero-knowledge proof-based anonymous reputation protocol for Solana. It enables developers and traders to prove on-chain credentials without revealing their wallet address or identity.

**Target:** Solana Privacy Hackathon 2026

## Tech Stack

- **Blockchain:** Solana (Anchor 0.29+)
- **ZK Framework:** Noir + Barretenberg (client-side proof generation)
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
│               ├── types.ts     # Shared TypeScript types
│               ├── proof.ts     # Client-side proof generation
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
  // TODO: Integrate NoirJS + Barretenberg WASM (currently mock)
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
- **Private inputs:** wallet_pubkey, secret, program_count, tvl_amounts[5]
- **Public inputs:** min_tvl, commitment, nullifier
- **Constraints:**
  - `commitment == sha256(wallet_pubkey || secret)`
  - `sum(tvl_amounts) >= min_tvl`
  - `nullifier == sha256(wallet_pubkey || "vouch_dev")`

### Whale Trading (`circuits/whale_trading/`)
- **Proves:** "I traded ≥ min_volume in the period"
- **Same pattern** with domain separator "vouch_whale"

### Nullifier Pattern
```
commitment = sha256(wallet_pubkey || secret)
nullifier = sha256(wallet_pubkey || domain_separator)
```
- Commitment links wallet to proof (proves knowledge)
- Nullifier prevents double-proving (unique per wallet + proof_type)
- Domain separator: "vouch_dev" or "vouch_whale"

## Environment Variables

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_VERIFIER_PROGRAM_ID=VouchXXX...
HELIUS_API_KEY=xxx  # Server-side only (optional - falls back to mock)
```

## Current Implementation Status

**Completed:**
- Anchor program with commitment, nullifier, and verification instructions
- Noir circuits for dev_reputation and whale_trading
- Next.js frontend with wallet connection and proof flow UI
- Server Actions for Helius data fetching (with mock fallback)
- TypeScript types and proof generation helpers

**TODO:**
- Integrate real NoirJS + Barretenberg for proof generation (currently mock)
- Implement actual Groth16/UltraPlonk verification in Anchor program
- Connect to real Helius API for on-chain data
- Mint credential NFT on successful verification
- Deploy to devnet with real program ID

## Reference Documents

- **PLAN.md:** Technical specification with code examples
- **STRATEGY.md:** Hackathon strategy and pitch
