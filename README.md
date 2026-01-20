<p align="center">
  <img src="https://img.shields.io/badge/Solana-Privacy_SDK-9945FF?style=for-the-badge&logo=solana&logoColor=white" alt="Solana Privacy SDK"/>
</p>

<h1 align="center">🛡️ Vouch Protocol SDK</h1>

<p align="center">
  <strong>Privacy infrastructure for Solana.</strong><br/>
  Verify user credentials without revealing identity.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-examples">Examples</a> •
  <a href="INTEGRATION_GUIDE.md">Integration Guide</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Solana-Devnet-purple" alt="Solana Devnet"/>
  <img src="https://img.shields.io/badge/Noir-1.0.0--beta.18-orange" alt="Noir Version"/>
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue" alt="TypeScript"/>
</p>

---

## 🎯 What is Vouch Protocol?

Vouch Protocol enables **anonymous credential verification** on Solana using zero-knowledge proofs. Users can prove they meet certain criteria (like holding assets or deploying programs) **without revealing their wallet address or actual balances**.

### 🏗️ What You Can Build

| Use Case                                | Description                                                    | Example                                             |
| --------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| 🧑‍💻 **Anonymous Developer Verification** | Prove TVL across deployed programs without doxxing your wallet | "I have $50k+ TVL" without revealing which programs |
| 🐋 **Private Whale Gating**             | Gate access by trading volume without revealing holdings       | VIP access for $100k+ traders                       |
| 🎁 **Sybil-Resistant Airdrops**         | One claim per wallet, verified privately                       | Fair distribution without gaming                    |
| 🗳️ **Anonymous DAO Voting**             | Prove eligibility without linking votes to identity            | Governance without doxxing                          |
| 🔐 **Private KYC/Accreditation**        | Prove accredited investor status anonymously                   | Compliant but private                               |

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔒 Privacy-First Architecture

- **Client-side proof generation** - Private data never leaves the browser
- **Zero-knowledge proofs** - Reveal nothing except threshold is met
- **Nullifier pattern** - Prevents double-proving cryptographically

</td>
<td width="50%">

### ⚡ Production Ready

- **UltraHonk prover** - Fast proofs (~15-30 seconds)
- **On-chain verification** - Solana program verifies proofs
- **ShadowWire integration** - Optional enhanced privacy (mainnet)

</td>
</tr>
<tr>
<td width="50%">

### 🛠️ Developer Experience

- **TypeScript SDK** - Fully typed API
- **React hooks** - Easy frontend integration
- **Comprehensive docs** - Guides, examples, API reference

</td>
<td width="50%">

### 🏛️ Battle-Tested Stack

- **Noir circuits** - Audited ZK DSL from Aztec
- **Anchor program** - Secure Solana smart contracts
- **Barretenberg** - Production WASM prover

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Installation

```bash
npm install @vouch-protocol/sdk
# or
pnpm add @vouch-protocol/sdk
# or
yarn add @vouch-protocol/sdk
```

### Basic Usage

```typescript
import { proveDevReputation } from '@vouch-protocol/sdk';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// 🎯 Prove you're a developer with $10k+ TVL - without revealing your wallet
const result = await proveDevReputation(
  {
    walletPubkey: wallet.publicKey.toBase58(),
    programs: deployedPrograms, // fetched via Helius
    minTvl: 10000, // threshold to prove
  },
  { wallet, connection }
);

if (result.success) {
  console.log('✅ Verified on-chain:', result.verification?.signature);
  console.log('🔐 Nullifier:', result.proof?.nullifier);
}
```

---

## 🔬 How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           YOUR APPLICATION                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐    │
│   │   👤 User    │───▶│  📱 Your dApp    │───▶│  📦 Vouch SDK     │    │
│   │  (Browser)   │    │  (React/Next)    │    │  (TypeScript)     │    │
│   └──────────────┘    └──────────────────┘    └─────────┬─────────┘    │
│                                                          │              │
├──────────────────────────────────────────────────────────┼──────────────┤
│                      PROOF GENERATION (Client-Side)      │              │
│                                                          ▼              │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │                    🔐 Zero-Knowledge Proof                    │     │
│   │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │     │
│   │  │ Private     │───▶│ Noir        │───▶│ ZK Proof    │       │     │
│   │  │ Inputs      │    │ Circuit     │    │ + Nullifier │       │     │
│   │  │ (wallet,    │    │ (WASM)      │    │             │       │     │
│   │  │  secret)    │    │             │    │             │       │     │
│   │  └─────────────┘    └─────────────┘    └──────┬──────┘       │     │
│   │        🔒                                      │              │     │
│   │   Never leaves                                 │              │     │
│   │   the browser!                                 │              │     │
│   └────────────────────────────────────────────────┼──────────────┘     │
│                                                    │                    │
├────────────────────────────────────────────────────┼────────────────────┤
│                   ON-CHAIN VERIFICATION            │                    │
│                                                    ▼                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    ⛓️ Solana Blockchain                         │   │
│   │  ┌─────────────────┐    ┌─────────────────┐                    │   │
│   │  │ Vouch Verifier  │───▶│ Nullifier PDA   │                    │   │
│   │  │ Program         │    │ (prevents       │                    │   │
│   │  │ (Anchor)        │    │  double-use)    │                    │   │
│   │  └─────────────────┘    └─────────────────┘                    │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 🔄 Proof Flow (Step by Step)

```
  Step 1                Step 2                Step 3                Step 4
┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐
│ 👤 User │          │ 📊 Data │          │ 🔐 ZK   │          │ ✅ On-  │
│ Connects│   ───▶   │ Fetched │   ───▶   │ Proof   │   ───▶   │ Chain   │
│ Wallet  │          │ (Helius)│          │ Created │          │ Verify  │
└─────────┘          └─────────┘          └─────────┘          └─────────┘
     │                    │                    │                    │
     │                    │                    │                    │
     ▼                    ▼                    ▼                    ▼
  Client              Server               Browser              Solana
  (Browser)           Action               (WASM)               Program
```

| Step  | Component      | What Happens                                              | Privacy                      |
| ----- | -------------- | --------------------------------------------------------- | ---------------------------- |
| **1** | Wallet Connect | User connects their Solana wallet                         | Wallet known only to user    |
| **2** | Data Fetch     | Server fetches on-chain data via Helius API               | Server sees wallet (trusted) |
| **3** | Proof Gen      | ZK proof generated in browser using NoirJS + Barretenberg | 🔐 Private data stays local  |
| **4** | Verification   | Proof submitted to Solana verifier program                | Only proof visible on-chain  |

### 🧮 Cryptographic Primitives

```
┌──────────────────────────────────────────────────────────────────┐
│                    NULLIFIER PATTERN                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   commitment = BLAKE2s(wallet_pubkey ║ secret)                   │
│                    │                                              │
│                    └──▶ Proves: "I know this wallet"             │
│                                                                   │
│   nullifier = BLAKE2s(wallet_pubkey ║ domain ║ zeros)            │
│                    │                                              │
│                    └──▶ Prevents: Double-proving                 │
│                                                                   │
│   Domain separators:                                              │
│   • Developer: "vouch_dev" (9 bytes, zero-padded to 32)          │
│   • Whale: "vouch_whale" (11 bytes, zero-padded to 32)           │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📚 API Reference

### 🎯 High-Level Functions (Recommended)

These functions handle the entire proof flow including optional privacy enhancement.

#### `proveDevReputation(input, options)`

Prove developer reputation (TVL across deployed programs) anonymously.

```typescript
import { proveDevReputation } from '@vouch-protocol/sdk';

const result = await proveDevReputation(
  {
    walletPubkey: string,      // Solana wallet address
    programs: ProgramData[],    // Deployed programs with TVL
    minTvl: number,            // Threshold to prove (e.g., 10000 for $10k)
  },
  {
    wallet: WalletContextState,     // Connected wallet
    connection: Connection,         // Solana connection
    onProgress?: (progress) => void, // Progress callback
    skipPrivacy?: boolean,          // Skip ShadowWire (default: false)
  }
);

// Result
{
  success: boolean,
  proof?: ProofResult,
  verification?: VerificationResult,
  privacyUsed: boolean,
  error?: string,
}
```

#### `proveWhaleTrading(input, options)`

Prove whale trading volume anonymously.

```typescript
import { proveWhaleTrading } from '@vouch-protocol/sdk';

const result = await proveWhaleTrading(
  {
    walletPubkey: string,
    tradingData: TradingVolumeData,
    minVolume: number, // e.g., 100000 for $100k
  },
  { wallet, connection }
);
```

### 🔧 Core Functions

For advanced use cases requiring more control.

| Function                       | Description                      |
| ------------------------------ | -------------------------------- |
| `generateDevReputationProof()` | Generate ZK proof (low-level)    |
| `generateWhaleTradingProof()`  | Generate whale proof (low-level) |
| `submitProofToChain()`         | Submit proof to Solana           |
| `isNullifierUsed()`            | Check if nullifier was used      |
| `verifyProofLocally()`         | Verify proof client-side         |

### 📝 Types

```typescript
// Input Types
interface DevReputationInput {
  walletPubkey: string;
  programs: ProgramData[];
  minTvl: number;
}

interface ProgramData {
  address: string;
  name?: string;
  deployedAt: string;
  deployer: string;
  estimatedTVL: number;
}

// Result Types
interface ProofResult {
  proof: Uint8Array;
  publicInputs: string[];
  nullifier: string;
  commitment: string;
  generatedAt: number;
  expiresAt: number;
}

interface ProveFlowResult {
  success: boolean;
  proof?: ProofResult;
  verification?: VerificationResult;
  privacyUsed: boolean;
  privacyProvider: 'shadowwire' | 'none';
  error?: string;
}
```

---

## 💡 Examples

### Example 1: Gate Discord Access by Developer TVL

```typescript
import { proveDevReputation, isNullifierUsed } from '@vouch-protocol/sdk';

async function verifyForDiscordRole() {
  // 1. Generate proof
  const result = await proveDevReputation(
    { walletPubkey, programs, minTvl: 50000 },
    { wallet, connection }
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  // 2. Check nullifier hasn't been used for this campaign
  const { nullifier } = result.proof!;
  const alreadyUsed = await checkNullifierInDatabase(nullifier, 'discord-dev');

  if (alreadyUsed) {
    throw new Error('This wallet already claimed the role');
  }

  // 3. Grant role and mark nullifier
  await grantDiscordRole(userId, 'verified-developer');
  await markNullifierUsed(nullifier, 'discord-dev');

  return { success: true, role: 'verified-developer' };
}
```

### Example 2: Private Airdrop Registration

```typescript
import { proveWhaleTrading, buildRegisterForAirdropInstruction } from '@vouch-protocol/sdk';

async function registerForAirdrop(campaignId: string) {
  // 1. Prove whale status
  const result = await proveWhaleTrading(
    { walletPubkey, tradingData, minVolume: 100000 },
    { wallet, connection }
  );

  if (!result.success) return result;

  // 2. Register for airdrop with proof
  const ix = buildRegisterForAirdropInstruction({
    campaignId: Buffer.from(campaignId),
    proof: result.proof!.proof,
    nullifier: result.proof!.nullifier,
    recipientWallet: burnerWallet.publicKey, // Receive to burner for privacy
  });

  // 3. Send transaction
  const tx = new Transaction().add(ix);
  const signature = await sendTransaction(tx, connection);

  return { success: true, signature };
}
```

### Example 3: Progress Tracking UI

```typescript
import { proveDevReputation, type ProveFlowProgress } from '@vouch-protocol/sdk';

function VerifyButton() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);

  const handleProgress = (p: ProveFlowProgress) => {
    setProgress(p.percentage);

    switch (p.stage) {
      case 'shielding':
        setStatus('🔒 Initializing privacy layer...');
        break;
      case 'generating-proof':
        setStatus('🧮 Generating zero-knowledge proof...');
        break;
      case 'submitting':
        setStatus('⛓️ Submitting to Solana...');
        break;
      case 'complete':
        setStatus('✅ Verification complete!');
        break;
      case 'error':
        setStatus(`❌ Error: ${p.message}`);
        break;
    }
  };

  const verify = async () => {
    const result = await proveDevReputation(input, {
      wallet,
      connection,
      onProgress: handleProgress,
    });
  };

  return (
    <div>
      <button onClick={verify}>Verify Developer Status</button>
      <div className="progress-bar" style={{ width: `${progress}%` }} />
      <p>{status}</p>
    </div>
  );
}
```

---

## 🏛️ Architecture

### Tech Stack

| Layer             | Technology                           | Purpose                      |
| ----------------- | ------------------------------------ | ---------------------------- |
| **🎨 Frontend**   | Next.js 16, React 19, TypeScript 5.9 | User interface               |
| **🔐 ZK Proofs**  | Noir 1.0.0-beta.18, UltraHonk        | Client-side proof generation |
| **⛓️ Blockchain** | Solana, Anchor 0.32.1                | On-chain verification        |
| **🔏 Privacy**    | ShadowWire (optional)                | Enhanced transaction privacy |
| **📊 Data**       | Helius SDK                           | On-chain data fetching       |

### Project Structure

```
vouch-protocol/
├── 📦 packages/
│   └── sdk/                    # @vouch-protocol/sdk
│       ├── src/index.ts        # SDK entry point
│       └── dist/               # Built package
│
├── 📱 apps/
│   ├── web/                    # Demo application
│   │   ├── src/
│   │   │   ├── app/           # Next.js App Router
│   │   │   ├── components/    # React components
│   │   │   └── lib/           # Core library (re-exported by SDK)
│   │   └── public/circuits/   # Compiled Noir circuits
│   │
│   └── verifier/              # ZK verification microservice
│
├── 🔐 circuits/               # Noir ZK circuits
│   ├── dev_reputation/        # Developer TVL proof
│   └── whale_trading/         # Trading volume proof
│
├── ⛓️ programs/
│   └── vouch-verifier/        # Solana Anchor program
│
└── 📖 docs/                   # Documentation
    ├── INTEGRATION_GUIDE.md
    └── PROTOCOL_FEES.md
```

### Circuit Specifications

#### Developer Reputation Circuit

```noir
// circuits/dev_reputation/src/main.nr
fn main(
    // Private inputs (never revealed)
    wallet_pubkey: [u8; 32],
    secret: [u8; 32],
    program_count: u32,
    tvl_amounts: [u64; 5],

    // Public inputs (verified on-chain)
    min_tvl: pub u64,
    commitment: pub [u8; 32],
    nullifier: pub [u8; 32],
) {
    // Verify commitment = hash(wallet || secret)
    // Verify nullifier = hash(wallet || domain || zeros)
    // Verify sum(tvl_amounts) >= min_tvl
}
```

#### Whale Trading Circuit

```noir
// circuits/whale_trading/src/main.nr
fn main(
    wallet_pubkey: [u8; 32],
    secret: [u8; 32],
    trade_count: u32,
    trade_amounts: [u64; 20],

    min_volume: pub u64,
    commitment: pub [u8; 32],
    nullifier: pub [u8; 32],
) {
    // Similar structure with 20 trade slots
}
```

---

## 💰 Protocol Fees

| Operation          | Fee         | Network | Purpose                 |
| ------------------ | ----------- | ------- | ----------------------- |
| Proof Verification | 0.001 SOL   | All     | Nullifier account rent  |
| Privacy Shield     | 0.002 SOL   | Mainnet | ShadowWire pool fees    |
| Network Fees       | ~0.0001 SOL | All     | Solana transaction fees |

**📊 Total estimated cost:** 0.001 - 0.004 SOL per verification

> 🆓 **Free Tier:** Devnet usage is always free (only standard Solana fees apply)

See [docs/PROTOCOL_FEES.md](docs/PROTOCOL_FEES.md) for detailed breakdown.

---

## 🔒 Security

### Security Model

| Aspect                | Implementation              | Guarantee                       |
| --------------------- | --------------------------- | ------------------------------- |
| **Private Data**      | Never leaves browser        | Client-side proof generation    |
| **Proof Soundness**   | Noir + UltraHonk            | Cryptographic security          |
| **Double-Proving**    | Nullifier pattern           | One proof per wallet per domain |
| **Replay Protection** | On-chain nullifier tracking | Cannot reuse proofs             |
| **No Trusted Setup**  | UltraHonk (transparent)     | No ceremony required            |

### Best Practices

1. **Always use HTTPS** in production
2. **Enable CORS headers** for SharedArrayBuffer support
3. **Never log or store** user secrets
4. **Validate proofs server-side** for high-security applications
5. **Use burner wallets** for maximum privacy

### Reporting Vulnerabilities

Report security issues to: **security@vouch-protocol.xyz**

See [SECURITY.md](SECURITY.md) for our security policy.

---

## 🛠️ Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (for Anchor)
- Nargo 1.0.0-beta.18 (for Noir circuits)

### Setup

```bash
# Clone the repository
git clone https://github.com/BadGenius22/vouch-protocol
cd vouch-protocol

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Commands

```bash
# Development
pnpm dev                    # Start Next.js dev server
pnpm build                  # Build for production

# Testing
pnpm test                   # Run tests
pnpm anchor:test            # Run Anchor integration tests

# Circuits
pnpm circuits:compile       # Compile Noir circuits
pnpm circuits:test          # Test circuits

# Linting
pnpm lint                   # Run ESLint
pnpm typecheck              # TypeScript type checking
```

### Vercel Deployment

Deploy to Vercel with these settings:

| Setting | Value |
|---------|-------|
| Root Directory | `apps/web` |
| Framework | Next.js |
| Build Command | `pnpm build` |
| Install Command | `pnpm install` |

**Required Environment Variables:**

```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_VERIFIER_PROGRAM_ID=EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD

# For devnet, use the test verifier key from keys/verifier-keypair.json:
VERIFIER_PRIVATE_KEY=[66,127,75,60,135,68,161,140,32,183,140,200,162,150,193,217,127,29,175,9,64,254,193,94,80,63,200,10,173,235,210,34,16,60,201,226,249,60,175,76,142,189,182,25,113,231,89,233,180,156,153,1,151,80,111,68,86,114,65,126,247,134,96,38]

# Optional - for fetching real on-chain data
HELIUS_API_KEY=your_helius_api_key
```

> **Note:** The verifier service is embedded in Next.js API routes and deploys automatically with the app.

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## 👨‍💻 Author

<p align="center">
  <strong>Dewangga Praxindo</strong><br/>
  <a href="https://github.com/BadGenius22">@BadGenius22</a>
</p>

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

Copyright (c) 2026 Dewangga Praxindo

---

## 🙏 Acknowledgments

- [Noir Language](https://noir-lang.org/) - Zero-knowledge DSL
- [Aztec Protocol](https://aztec.network/) - Barretenberg prover
- [ShadowWire](https://www.radrlabs.io/) - Privacy infrastructure
- [Helius](https://helius.xyz/) - Solana data API
- [Anchor](https://www.anchor-lang.com/) - Solana framework

---

<p align="center">
  <strong>Built with 🔐 for the Solana ecosystem</strong><br/>
  <em>Privacy is a right, not a feature.</em>
</p>

<p align="center">
  <a href="https://github.com/BadGenius22/vouch-protocol">GitHub</a> •
  <a href="docs/INTEGRATION_GUIDE.md">Docs</a> •
  <a href="https://discord.gg/vouch">Discord</a>
</p>
