<h1 align="center">📦 @vouch-protocol/sdk</h1>

<p align="center">
  <strong>The official SDK for Vouch Protocol</strong><br/>
  Privacy-preserving credential verification for Solana applications
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@vouch-protocol/sdk?style=flat-square" alt="npm version"/>
  <img src="https://img.shields.io/npm/dm/@vouch-protocol/sdk?style=flat-square" alt="downloads"/>
  <img src="https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square" alt="TypeScript"/>
</p>

---

## 📋 Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [API Reference](#-api-reference)
- [Types](#-types)
- [Examples](#-examples)
- [Browser Requirements](#-browser-requirements)
- [Error Handling](#-error-handling)
- [Best Practices](#-best-practices)

---

## 📥 Installation

```bash
# npm
npm install @vouch-protocol/sdk

# pnpm (recommended)
pnpm add @vouch-protocol/sdk

# yarn
yarn add @vouch-protocol/sdk
```

### Peer Dependencies

Make sure you have these installed:

```bash
npm install @solana/wallet-adapter-react @solana/web3.js
```

---

## 🚀 Quick Start

### 1️⃣ Basic Setup

```typescript
import { proveDevReputation } from '@vouch-protocol/sdk';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

function App() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const verify = async () => {
    const result = await proveDevReputation(
      {
        walletPubkey: wallet.publicKey!.toBase58(),
        programs: deployedPrograms,
        minTvl: 10000,
      },
      { wallet, connection }
    );

    if (result.success) {
      console.log('✅ Verified!', result.verification?.signature);
    }
  };

  return <button onClick={verify}>Verify</button>;
}
```

### 2️⃣ With Progress Tracking

```typescript
const result = await proveDevReputation(input, {
  wallet,
  connection,
  onProgress: (progress) => {
    console.log(`${progress.stage}: ${progress.percentage}%`);
  },
});
```

### 3️⃣ With Error Handling

```typescript
import { VouchError, VouchErrorCode } from '@vouch-protocol/sdk';

try {
  const result = await proveDevReputation(input, options);
} catch (error) {
  if (error instanceof VouchError) {
    switch (error.code) {
      case VouchErrorCode.THRESHOLD_NOT_MET:
        console.log('TVL too low');
        break;
      case VouchErrorCode.NULLIFIER_ALREADY_USED:
        console.log('Already verified');
        break;
    }
  }
}
```

---

## 📚 API Reference

### 🎯 High-Level Functions

#### `proveDevReputation(input, options)`

Prove developer reputation anonymously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input.walletPubkey` | `string` | ✅ | Solana wallet address |
| `input.programs` | `ProgramData[]` | ✅ | Deployed programs with TVL |
| `input.minTvl` | `number` | ✅ | Minimum TVL threshold |
| `options.wallet` | `WalletContextState` | ✅ | Connected wallet |
| `options.connection` | `Connection` | ✅ | Solana connection |
| `options.onProgress` | `(progress) => void` | ❌ | Progress callback |
| `options.skipPrivacy` | `boolean` | ❌ | Skip ShadowWire (default: false) |
| `options.signal` | `AbortSignal` | ❌ | Cancellation signal |

**Returns:** `Promise<ProveFlowResult>`

---

#### `proveWhaleTrading(input, options)`

Prove whale trading volume anonymously.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input.walletPubkey` | `string` | ✅ | Solana wallet address |
| `input.tradingData` | `TradingVolumeData` | ✅ | Trading history |
| `input.minVolume` | `number` | ✅ | Minimum volume threshold |

**Returns:** `Promise<ProveFlowResult>`

---

### 🔧 Core Functions

#### `generateDevReputationProof(input)`

Low-level proof generation (runs in browser).

```typescript
import { generateDevReputationProof } from '@vouch-protocol/sdk';

const proof = await generateDevReputationProof({
  walletPubkey,
  programs,
  minTvl: 10000,
});
```

---

#### `submitProofToChain(connection, proof, proofType, payer, signTransaction, recipient?)`

Submit proof to Solana for verification.

```typescript
import { submitProofToChain } from '@vouch-protocol/sdk';

const result = await submitProofToChain(
  connection,
  proof,
  'developer',
  wallet.publicKey,
  wallet.signTransaction,
  recipientPublicKey // optional
);
```

---

#### `isNullifierUsed(connection, nullifier)`

Check if a nullifier has been used.

```typescript
import { isNullifierUsed } from '@vouch-protocol/sdk';

const used = await isNullifierUsed(connection, nullifier);
```

---

### 🔐 Privacy Functions

#### `isShadowWireAvailable()`

Check if ShadowWire privacy is available.

```typescript
import { isShadowWireAvailable } from '@vouch-protocol/sdk';

const available = await isShadowWireAvailable();
// true on mainnet with SDK loaded, false otherwise
```

---

#### `estimateProveFlowCost(connection, skipPrivacy?)`

Estimate costs before verification.

```typescript
import { estimateProveFlowCost } from '@vouch-protocol/sdk';

const estimate = await estimateProveFlowCost(connection);
console.log(`Total: ${estimate.totalCost} SOL`);
```

---

### 🎁 Airdrop Functions

#### `buildCreateCampaignInstruction(params)`

Create a private airdrop campaign.

```typescript
import { buildCreateCampaignInstruction } from '@vouch-protocol/sdk';

const ix = buildCreateCampaignInstruction({
  campaignId: campaignIdBytes,
  creator: wallet.publicKey,
  tokenMint,
  totalAmount: 1000000,
  maxRegistrations: 1000,
  proofType: 'developer',
});
```

---

## 📝 Types

### Input Types

```typescript
interface DevReputationInput {
  walletPubkey: string;        // Solana address (base58)
  programs: ProgramData[];     // Deployed programs
  minTvl: number;              // Threshold in USD
}

interface ProgramData {
  address: string;             // Program address
  name?: string;               // Optional name
  deployedAt: string;          // ISO timestamp
  deployer: string;            // Deployer wallet
  estimatedTVL: number;        // TVL in USD
}

interface WhaleTradingInput {
  walletPubkey: string;
  tradingData: TradingVolumeData;
  minVolume: number;
}

interface TradingVolumeData {
  totalVolume: number;
  tradeCount: number;
  amounts: number[];
  period: number;              // Days
  wallet: string;
}
```

### Result Types

```typescript
interface ProveFlowResult {
  success: boolean;
  proof?: ProofResult;
  verification?: VerificationResult;
  privacyUsed: boolean;
  privacyProvider: 'shadowwire' | 'none';
  error?: string;
  errorStage?: ProveFlowStage;
  cleanup: () => void | Promise<void>;
}

interface ProofResult {
  proof: Uint8Array;           // ZK proof bytes
  publicInputs: string[];      // Circuit public inputs
  nullifier: string;           // Hex-encoded nullifier
  commitment: string;          // Hex-encoded commitment
  generatedAt: number;         // Unix timestamp (ms)
  expiresAt: number;           // Expiration (ms)
}

interface VerificationResult {
  success: boolean;
  signature?: string;          // Transaction signature
  error?: string;
  errorCode?: VouchErrorCode;
}
```

### Progress Types

```typescript
type ProveFlowStage =
  | 'idle'
  | 'shielding'
  | 'generating-proof'
  | 'submitting'
  | 'withdrawing'
  | 'complete'
  | 'error';

interface ProveFlowProgress {
  stage: ProveFlowStage;
  message: string;
  percentage: number;          // 0-100
}
```

---

## 💡 Examples

### Example 1: Full Verification Flow

```typescript
import {
  proveDevReputation,
  isNullifierUsed,
  VouchError,
  VouchErrorCode,
} from '@vouch-protocol/sdk';

async function verifyDeveloper() {
  try {
    // 1. Check if already verified
    const programs = await fetchProgramsFromHelius(wallet.publicKey);

    // 2. Generate and submit proof
    const result = await proveDevReputation(
      {
        walletPubkey: wallet.publicKey.toBase58(),
        programs,
        minTvl: 25000,
      },
      {
        wallet,
        connection,
        onProgress: ({ stage, message, percentage }) => {
          updateUI(stage, message, percentage);
        },
      }
    );

    if (result.success) {
      return {
        success: true,
        txSignature: result.verification!.signature,
        nullifier: result.proof!.nullifier,
      };
    }

    return { success: false, error: result.error };
  } catch (error) {
    if (error instanceof VouchError) {
      return { success: false, error: error.message, code: error.code };
    }
    throw error;
  }
}
```

### Example 2: Cancellable Verification

```typescript
import { proveDevReputation, createFlowController } from '@vouch-protocol/sdk';

function VerifyComponent() {
  const controllerRef = useRef<ReturnType<typeof createFlowController>>();

  const startVerification = async () => {
    const controller = createFlowController();
    controllerRef.current = controller;

    const result = await proveDevReputation(input, {
      wallet,
      connection,
      signal: controller.signal,
    });

    controllerRef.current = undefined;
    return result;
  };

  const cancel = () => {
    controllerRef.current?.abort();
  };

  return (
    <>
      <button onClick={startVerification}>Verify</button>
      <button onClick={cancel}>Cancel</button>
    </>
  );
}
```

---

## 🌐 Browser Requirements

### CORS Headers

ZK proof generation requires SharedArrayBuffer. Add these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Next.js Configuration

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};
```

### Browser Support

| Browser | Support |
|---------|---------|
| Chrome 91+ | ✅ Full |
| Firefox 90+ | ✅ Full |
| Safari 15.2+ | ✅ Full |
| Edge 91+ | ✅ Full |
| Mobile Chrome | ⚠️ May be slow |
| Mobile Safari | ⚠️ May be slow |

---

## ⚠️ Error Handling

### Error Codes

```typescript
enum VouchErrorCode {
  // Wallet errors
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  WALLET_REJECTED = 'WALLET_REJECTED',

  // Proof errors
  PROOF_GENERATION_FAILED = 'PROOF_GENERATION_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  CIRCUIT_LOAD_FAILED = 'CIRCUIT_LOAD_FAILED',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  THRESHOLD_NOT_MET = 'THRESHOLD_NOT_MET',

  // Security errors
  PROOF_EXPIRED = 'PROOF_EXPIRED',
  NULLIFIER_ALREADY_USED = 'NULLIFIER_ALREADY_USED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
}
```

### Handling Errors

```typescript
import { isVouchError, VouchErrorCode } from '@vouch-protocol/sdk';

try {
  await proveDevReputation(input, options);
} catch (error) {
  if (isVouchError(error)) {
    const messages: Record<VouchErrorCode, string> = {
      [VouchErrorCode.WALLET_NOT_CONNECTED]: 'Please connect your wallet',
      [VouchErrorCode.THRESHOLD_NOT_MET]: 'Your TVL is below the threshold',
      [VouchErrorCode.NULLIFIER_ALREADY_USED]: 'Already verified',
      [VouchErrorCode.INSUFFICIENT_FUNDS]: 'Need more SOL for fees',
      // ... etc
    };

    showError(messages[error.code] || error.message);
  }
}
```

---

## ✅ Best Practices

### 1️⃣ Always Show Progress

```typescript
// Good ✅
const result = await proveDevReputation(input, {
  wallet,
  connection,
  onProgress: (p) => showProgress(p.message, p.percentage),
});

// Bad ❌
const result = await proveDevReputation(input, { wallet, connection });
// User sees nothing for 15-30 seconds
```

### 2️⃣ Handle All Error Cases

```typescript
// Good ✅
if (!result.success) {
  if (result.errorStage === 'generating-proof') {
    showError('Proof generation failed');
  } else if (result.errorStage === 'submitting') {
    showError('Transaction failed');
  }
}

// Bad ❌
if (!result.success) showError('Failed');
```

### 3️⃣ Check Nullifier Before Verification

```typescript
// Good ✅
const nullifier = computeNullifierForWallet(walletPubkey, 'developer');
const alreadyUsed = await isNullifierUsed(connection, nullifier);
if (alreadyUsed) {
  showInfo('You have already verified');
  return;
}
await proveDevReputation(input, options);

// Bad ❌
// Just call verify and let it fail
```

### 4️⃣ Provide Cancellation Option

```typescript
// Good ✅ - User can cancel long-running operation
const controller = createFlowController();
const result = await proveDevReputation(input, {
  ...options,
  signal: controller.signal,
});

// Bad ❌ - User is stuck waiting
await proveDevReputation(input, options);
```

---

## 📖 Documentation

- [Full Documentation](https://github.com/your-org/vouch-protocol)
- [Integration Guide](https://github.com/your-org/vouch-protocol/blob/main/docs/INTEGRATION_GUIDE.md)
- [Protocol Fees](https://github.com/your-org/vouch-protocol/blob/main/docs/PROTOCOL_FEES.md)
- [API Reference](https://github.com/your-org/vouch-protocol#-api-reference)

---

## 📜 License

MIT License - see [LICENSE](https://github.com/your-org/vouch-protocol/blob/main/LICENSE)

---

<p align="center">
  Made with 🔐 by the Vouch Protocol team
</p>
