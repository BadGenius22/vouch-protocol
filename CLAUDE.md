# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vouch Protocol is a zero-knowledge proof-based anonymous reputation protocol for Solana. It enables developers and traders to prove on-chain credentials without revealing their wallet address or identity.

## Required Skills

Always use these skills when working on this repository:

- **`/solana-dev`** - Solana development patterns, Anchor best practices, and framework-kit guidance
- **`/vercel-react-best-practices`** - React and Next.js performance optimization patterns
- **`/web-design-guidelines`** - UI code review for accessibility and design best practices

## Tech Stack

- **Blockchain:** Solana (Anchor 0.29+)
- **ZK Framework:** Noir 1.0.0-beta.18 + UltraHonk (@aztec/bb.js 3.0.2) - client-side proof generation
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **Data:** Helius SDK (via Server Actions)
- **Build System:** Turborepo + pnpm

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
pnpm circuits:compile            # Compile all circuits
pnpm circuits:test               # Test all circuits
cd circuits && nargo test --exact dev_reputation::test_valid_proof  # Single circuit test

# Anchor (Solana)
pnpm anchor:build                # Build Solana program
pnpm anchor:test                 # Run all integration tests
anchor test -- --grep "creates commitment"  # Single test by name
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
│ circuits/                 │   │ programs/vouch-verifier/    │
│ • dev_reputation          │   │ • create_commitment         │
│ • whale_trading           │   │ • init_nullifier            │
│                           │   │ • verify_dev_reputation     │
│                           │   │ • verify_whale_trading      │
└───────────────────────────┘   └─────────────────────────────┘
```

### Key Files

| Purpose | Location |
|---------|----------|
| Proof Generation | `apps/web/src/lib/proof.ts` |
| Circuit Loader | `apps/web/src/lib/circuit.ts` |
| On-chain Verification | `apps/web/src/lib/verify.ts` |
| Types & Errors | `apps/web/src/lib/types.ts` |
| Server Actions | `apps/web/src/app/actions/helius.ts` |
| Anchor Program | `programs/vouch-verifier/src/lib.rs` |
| Dev Circuit | `circuits/dev_reputation/src/main.nr` |
| Whale Circuit | `circuits/whale_trading/src/main.nr` |
| Compiled Circuits | `apps/web/public/circuits/*.json` |

## Proof Flow

1. User connects wallet (client-side)
2. Server Action fetches on-chain data via Helius
3. Data sent to client for proof generation
4. **ZK proof generated in browser** (NoirJS + Barretenberg WASM)
5. Client calls `init_nullifier` to create nullifier PDA
6. Client calls `verify_*` with proof from burner wallet
7. Verifier checks proof, marks nullifier used

## Circuit Logic

### Nullifier Pattern
```
commitment = blake2s(wallet_pubkey || secret)  // Proves wallet knowledge
nullifier = blake2s(wallet_pubkey || domain || zeros)  // Prevents double-proving
```
- Domain separators: `"vouch_dev"` (9 bytes) or `"vouch_whale"` (11 bytes), zero-padded to 32 bytes

### Developer Reputation (`circuits/dev_reputation/`)
- **Proves:** "I control a wallet with ≥ min_tvl TVL across deployed programs"
- **Private inputs:** wallet_pubkey[32], secret[32], program_count, tvl_amounts[5]
- **Public inputs:** min_tvl, commitment[32], nullifier[32]

### Whale Trading (`circuits/whale_trading/`)
- **Proves:** "I traded ≥ min_volume in the period"
- **Private inputs:** wallet_pubkey[32], secret[32], trade_count, trade_amounts[20]
- **Public inputs:** min_volume, commitment[32], nullifier[32]

### Anchor PDA Seeds
```rust
// Nullifier: [b"nullifier", nullifier.as_ref()]
// Commitment: [b"commitment", commitment.as_ref()]
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
export async function generateDevReputationProof(
  input: DevReputationInput,
  onProgress?: ProofProgressCallback
): Promise<ProofResult> {
  // Runs in browser - private data never leaves device
  const { noir, backend } = await loadCircuit('dev_reputation');
  const { witness } = await noir.execute(circuitInputs);
  const proofData = await backend.generateProof(witness);
  return { proof, publicInputs, nullifier, commitment };
}
```

### Circuit Loader (WASM management)
```typescript
// apps/web/src/lib/circuit.ts
export async function loadCircuit(circuitType: CircuitType) {
  // Fetches from /public/circuits/{type}.json
  // Initializes UltraHonkBackend (WASM)
  // Requires COOP/COEP headers for SharedArrayBuffer
  // Caches for 1 hour with race condition prevention
}
```

## Environment Variables

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_VERIFIER_PROGRAM_ID=VouchXXX...
HELIUS_API_KEY=xxx  # Server-side only (optional - falls back to mock)
```

## Version Compatibility

All Noir components must use matching versions. Pin exact versions to avoid type conflicts:

| Component | Version |
|-----------|---------|
| Nargo CLI | 1.0.0-beta.18 |
| @noir-lang/noir_js | 1.0.0-beta.18 |
| @aztec/bb.js | 3.0.2 |
| @noir-lang/types | 1.0.0-beta.18 |

## Proving System Choice

We use **UltraHonk** (not UltraPlonk) because Vouch generates proofs client-side in browser and verifies on Solana. UltraHonk is faster with lower RAM usage, ideal for browser environments.

## Reference Documents

- **IMPLEMENTATION_PLAN.md:** Detailed execution plan with phases, security checklist, CI/CD workflows
