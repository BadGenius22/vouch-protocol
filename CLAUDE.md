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
pnpm anchor:test                 # Run integration tests
pnpm anchor:deploy               # Deploy to devnet

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
│ • dev_reputation          │   │ • init_nullifier            │
│ • whale_trading           │   │ • verify_dev_reputation     │
│                           │   │ • verify_whale_trading      │
│ Workspace compilation     │   │ • nullifier registry (PDA)  │
└───────────────────────────┘   └─────────────────────────────┘
```

## Key Patterns

### Turborepo Workspace
```bash
pnpm --filter @vouch/web dev     # Run specific app
pnpm --filter @vouch/web build   # Build specific app
```

### Noir Workspace
All circuits compile together via workspace:
```bash
cd circuits && nargo compile --workspace
```

### Server Actions (secure data fetching)
```typescript
// apps/web/src/app/actions/helius.ts
'use server';
export async function getDeployedPrograms(wallet: string) {
  // HELIUS_API_KEY never exposed to client
}
```

### Shared Types
```typescript
// apps/web/src/lib/types.ts - Single source of truth
export interface ProofResult { ... }
export interface ProgramData { ... }
```

### Client-side Proof Generation
```typescript
// apps/web/src/lib/proof.ts
export async function generateDevReputationProof(input) {
  // Runs in browser - data never leaves device
  // Uses NoirJS + Barretenberg WASM
}
```

### Anchor Security Pattern
Nullifier initialization is separate from verification:
```rust
// Step 1: Initialize (creates account)
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

### Developer Reputation
- **Proves:** "I control a wallet with ≥$100K TVL across deployed programs"
- **Private:** wallet_pubkey, secret, program addresses, TVL amounts
- **Public:** commitment, min_tvl, nullifier

### Whale Trading
- **Proves:** "I traded ≥$50K volume in 30 days"
- **Private:** wallet_pubkey, secret, trade amounts
- **Public:** commitment, min_volume, nullifier

### Nullifier Pattern
```
commitment = hash(wallet_pubkey || secret)
nullifier = hash(wallet_pubkey || domain_separator)
```
- Commitment links wallet to proof
- Nullifier prevents double-proving (unique per wallet + proof_type)

## Environment Variables

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_VERIFIER_PROGRAM_ID=VouchXXX...
HELIUS_API_KEY=xxx  # Server-side only
```

## Reference Documents

- **PLAN.md:** Technical specification with code examples
- **STRATEGY.md:** Hackathon strategy and pitch
