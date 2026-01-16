# Vouch Protocol - Local Testing Guide

This guide walks you through testing the full ZK verification flow locally.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Solana CLI (for on-chain testing)
- A Solana wallet with devnet SOL

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start the Verifier Service

In Terminal 1:

```bash
pnpm dev:verifier
```

You should see:

```
============================================================
Vouch Protocol - ZK Verification Service
============================================================
[Verifier] Generated new keypair: <VERIFIER_PUBKEY>
[Verifier] Developer circuit loaded
[Verifier] Whale circuit loaded
============================================================
Server running on http://localhost:3001
```

**Note the verifier public key** - you'll need it to register the verifier on-chain.

### 3. Start the Web App

In Terminal 2:

```bash
pnpm dev
```

The web app will be available at `http://localhost:3000`.

### 4. Test the Verifier API

In Terminal 3:

```bash
pnpm test:verifier
```

Expected output:

```
✅ Health endpoint
✅ Verifier endpoint
✅ Verify validation
✅ Verify mock proof

Total: 4/4 tests passed
```

---

## Full Integration Testing

### Option A: Using Devnet (Recommended)

#### 1. Configure Solana CLI for Devnet

```bash
solana config set --url devnet
```

#### 2. Create/Fund a Wallet

```bash
# Create new wallet (if needed)
solana-keygen new

# Airdrop SOL for testing
solana airdrop 2
```

#### 3. Deploy the Anchor Program (if not deployed)

```bash
pnpm anchor:build
pnpm anchor:deploy
```

#### 4. Initialize Config & Register Verifier

First, get the verifier's public key:

```bash
curl http://localhost:3001/verifier
# Returns: {"publicKey":"<VERIFIER_PUBKEY>","message":"..."}
```

Then register it:

```bash
pnpm setup:verifier <VERIFIER_PUBKEY>
```

#### 5. Test in Web App

1. Open `http://localhost:3000`
2. Connect your Phantom/Solflare wallet
3. Navigate to Developer or Whale page
4. Generate a proof
5. Submit (will use verifier service automatically)

### Option B: Using Local Validator

#### 1. Start Local Validator

```bash
solana-test-validator
```

#### 2. Configure CLI

```bash
solana config set --url localhost
```

#### 3. Deploy & Setup

```bash
pnpm anchor:build
pnpm anchor:deploy
pnpm setup:verifier <VERIFIER_PUBKEY>
```

---

## Testing Individual Components

### Test Circuits (Noir)

```bash
pnpm circuits:test
```

### Test Anchor Program

```bash
pnpm anchor:test
```

### Test TypeScript

```bash
pnpm typecheck
```

### Test Web App Build

```bash
pnpm build
```

---

## API Endpoints

### Verifier Service (localhost:3001)

| Endpoint    | Method | Description                      |
| ----------- | ------ | -------------------------------- |
| `/health`   | GET    | Health check, circuit status     |
| `/verifier` | GET    | Get verifier public key          |
| `/verify`   | POST   | Verify proof and get attestation |

#### Example: Health Check

```bash
curl http://localhost:3001/health
```

Response:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "verifier": "...",
  "circuitsLoaded": {
    "developer": true,
    "whale": true
  }
}
```

#### Example: Verify Proof

```bash
curl -X POST http://localhost:3001/verify \
  -H "Content-Type: application/json" \
  -d '{
    "proof": "...",
    "publicInputs": ["0x...", "0x..."],
    "proofType": "developer",
    "nullifier": "...",
    "commitment": "..."
  }'
```

---

## Environment Variables

### Verifier Service (`apps/verifier/.env`)

```bash
# Server port (default: 3001)
PORT=3001

# CORS origins
CORS_ORIGIN=http://localhost:3000

# Verifier private key (optional - generates ephemeral if not set)
# VERIFIER_PRIVATE_KEY=<base58-or-json-array>
```

### Web App (`apps/web/.env.local`)

```bash
# Solana network
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# RPC URL
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Verifier service URL
NEXT_PUBLIC_VERIFIER_URL=http://localhost:3001

# Helius API key (optional)
HELIUS_API_KEY=...
```

---

## Troubleshooting

### Verifier service won't start

1. Check if port 3001 is in use:

   ```bash
   lsof -i :3001
   ```

2. Check if circuits are compiled:
   ```bash
   ls apps/web/public/circuits/
   ```
   Should contain `dev_reputation.json` and `whale_trading.json`.

### Circuits not loading

Recompile circuits:

```bash
pnpm circuits:compile
```

### Anchor build fails

Check Rust/Cargo version:

```bash
rustc --version  # Need 1.70+
cargo --version
```

### "Verifier not authorized" error

The verifier hasn't been registered on-chain. Run:

```bash
pnpm setup:verifier <VERIFIER_PUBKEY>
```

### "Nullifier already used" error

Each proof can only be verified once. Generate a new proof with a different secret.

---

## Development Workflow

### Typical Flow

1. Start verifier: `pnpm dev:verifier`
2. Start web: `pnpm dev`
3. Make changes
4. Test API: `pnpm test:verifier`
5. Test in browser

### Running Everything Together

```bash
pnpm dev:all
```

This starts both the web app and verifier service concurrently.

---

## Current Devnet Deployment

The program is currently deployed on devnet:

| Resource   | Address                                        |
| ---------- | ---------------------------------------------- |
| Program ID | `CwWhTbquAFY5dvEMctwWHddWvdsDVAxWmtGPUt6s6UxQ` |
| Config PDA | `B5jB5jEsKMdsnyCPE3rF9NCNHdznt35B4unNNgfRHWPX` |

---

## Security Notes

- **Ephemeral Keys**: By default, the verifier generates a new keypair on each restart. For production, set `VERIFIER_PRIVATE_KEY`.
- **CORS**: The verifier only accepts requests from configured origins.
- **Devnet vs Mainnet**: Never use devnet keys on mainnet.
