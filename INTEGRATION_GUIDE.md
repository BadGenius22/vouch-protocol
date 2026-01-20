<h1 align="center">📘 Vouch Protocol Integration Guide</h1>

<p align="center">
  <strong>Complete guide to integrating privacy-preserving verification into your Solana dApp</strong>
</p>

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Installation](#-installation)
3. [Quick Start Tutorial](#-quick-start-tutorial)
4. [Step-by-Step Integration](#-step-by-step-integration)
5. [Advanced Patterns](#-advanced-patterns)
6. [UI/UX Best Practices](#-uiux-best-practices)
7. [Backend Integration](#-backend-integration)
8. [Error Handling](#-error-handling)
9. [Security Checklist](#-security-checklist)
10. [Troubleshooting](#-troubleshooting)
11. [FAQ](#-faq)

---

## 🔧 Prerequisites

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Node.js** | v20.0.0 | v20.x LTS |
| **pnpm/npm/yarn** | Latest | pnpm 9.x |
| **Browser** | Chrome 91+ | Chrome/Firefox latest |
| **Memory** | 4GB RAM | 8GB+ RAM |

### Solana Requirements

| Requirement | Description |
|-------------|-------------|
| **Wallet Adapter** | `@solana/wallet-adapter-react` configured |
| **Network** | Devnet (testing) or Mainnet (production) |
| **SOL Balance** | ~0.01 SOL for transaction fees |

### ⚠️ Critical: Browser CORS Headers

> **ZK proof generation uses SharedArrayBuffer, which requires specific CORS headers.**

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers, proof generation will fail with:
```
ReferenceError: SharedArrayBuffer is not defined
```

---

## 📥 Installation

### Step 1: Install the SDK

```bash
# Using pnpm (recommended)
pnpm add @vouch-protocol/sdk

# Using npm
npm install @vouch-protocol/sdk

# Using yarn
yarn add @vouch-protocol/sdk
```

### Step 2: Install Peer Dependencies

```bash
pnpm add @solana/wallet-adapter-react @solana/web3.js
```

### Step 3: Configure CORS Headers

#### Next.js

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

#### Vite

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

#### Express/Node.js

```javascript
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});
```

---

## 🚀 Quick Start Tutorial

### Goal: Verify a developer has $10k+ TVL in 5 minutes

#### 1️⃣ Set Up Your React Component

```tsx
// components/VerifyDeveloper.tsx
import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { proveDevReputation, type ProveFlowProgress } from '@vouch-protocol/sdk';

export function VerifyDeveloper() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (!wallet.publicKey) {
      setStatus('❌ Please connect your wallet first');
      return;
    }

    setIsVerifying(true);
    setStatus('🔄 Starting verification...');

    try {
      // 1. Fetch deployed programs (you'll need to implement this)
      const programs = await fetchDeployedPrograms(wallet.publicKey.toBase58());

      // 2. Generate and submit proof
      const result = await proveDevReputation(
        {
          walletPubkey: wallet.publicKey.toBase58(),
          programs,
          minTvl: 10000, // $10k minimum
        },
        {
          wallet,
          connection,
          onProgress: (p: ProveFlowProgress) => {
            setProgress(p.percentage);
            setStatus(getStatusMessage(p.stage));
          },
        }
      );

      // 3. Handle result
      if (result.success) {
        setStatus(`✅ Verified! TX: ${result.verification?.signature?.slice(0, 8)}...`);
      } else {
        setStatus(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="verify-card">
      <h2>🧑‍💻 Developer Verification</h2>
      <p>Prove you have $10k+ TVL without revealing your wallet</p>

      <button onClick={handleVerify} disabled={isVerifying || !wallet.connected}>
        {isVerifying ? 'Verifying...' : 'Verify Now'}
      </button>

      {progress > 0 && (
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  );
}

function getStatusMessage(stage: string): string {
  const messages: Record<string, string> = {
    idle: '⏳ Waiting...',
    shielding: '🔒 Initializing privacy layer...',
    'generating-proof': '🧮 Generating zero-knowledge proof...',
    submitting: '⛓️ Submitting to Solana...',
    complete: '✅ Verification complete!',
    error: '❌ Error occurred',
  };
  return messages[stage] || '🔄 Processing...';
}
```

#### 2️⃣ Fetch Program Data

```typescript
// lib/helius.ts
import { Helius } from 'helius-sdk';

const helius = new Helius(process.env.HELIUS_API_KEY!);

export async function fetchDeployedPrograms(wallet: string) {
  // Option 1: Use Helius DAS API
  const assets = await helius.rpc.getAssetsByOwner({
    ownerAddress: wallet,
  });

  // Option 2: Mock data for testing
  return [
    {
      address: 'Program111111111111111111111111111111111111',
      name: 'My DeFi Protocol',
      deployedAt: new Date().toISOString(),
      deployer: wallet,
      estimatedTVL: 15000, // $15k
    },
  ];
}
```

#### 3️⃣ Run and Test

```bash
pnpm dev
```

Navigate to your component and click "Verify Now"!

---

## 📖 Step-by-Step Integration

### Phase 1: Basic Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1: BASIC                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. Install SDK ────▶ 2. Configure CORS ────▶ 3. Add UI    │
│                                                              │
│   Result: Working proof generation in browser                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Production Hardening

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 2: PRODUCTION                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   4. Error Handling ──▶ 5. Progress UI ──▶ 6. Cancellation  │
│                                                              │
│   Result: Production-ready user experience                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Backend Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 3: BACKEND                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   7. Server Verify ──▶ 8. Nullifier DB ──▶ 9. Webhooks      │
│                                                              │
│   Result: Full-stack integration with backend                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Advanced Patterns

### Pattern 1: Tiered Verification

```typescript
// lib/verification-tiers.ts
import { proveDevReputation } from '@vouch-protocol/sdk';

const TIERS = {
  bronze: { minTvl: 1000, badge: '🥉', label: 'Emerging Developer' },
  silver: { minTvl: 10000, badge: '🥈', label: 'Established Developer' },
  gold: { minTvl: 50000, badge: '🥇', label: 'Top Developer' },
  platinum: { minTvl: 100000, badge: '💎', label: 'Elite Developer' },
} as const;

type TierKey = keyof typeof TIERS;

export async function verifyForHighestTier(
  walletPubkey: string,
  programs: ProgramData[],
  wallet: WalletContextState,
  connection: Connection
): Promise<{ tier: TierKey; badge: string; label: string } | null> {
  // Try from highest to lowest tier
  const tierOrder: TierKey[] = ['platinum', 'gold', 'silver', 'bronze'];

  for (const tierKey of tierOrder) {
    const tier = TIERS[tierKey];

    const result = await proveDevReputation(
      { walletPubkey, programs, minTvl: tier.minTvl },
      { wallet, connection }
    );

    if (result.success) {
      return { tier: tierKey, badge: tier.badge, label: tier.label };
    }
  }

  return null; // Doesn't qualify for any tier
}
```

### Pattern 2: Cancellable Verification with Timeout

```typescript
// hooks/useVerification.ts
import { useState, useRef, useCallback } from 'react';
import {
  proveDevReputation,
  createFlowController,
  type ProveFlowProgress,
} from '@vouch-protocol/sdk';

const VERIFICATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useVerification() {
  const [progress, setProgress] = useState<ProveFlowProgress | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const controllerRef = useRef<ReturnType<typeof createFlowController> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startVerification = useCallback(async (input: DevReputationInput, options: Omit<ProveFlowOptions, 'signal'>) => {
    // Create abort controller
    const controller = createFlowController();
    controllerRef.current = controller;

    // Set timeout
    timeoutRef.current = setTimeout(() => {
      controller.abort();
    }, VERIFICATION_TIMEOUT);

    setIsVerifying(true);

    try {
      const result = await proveDevReputation(input, {
        ...options,
        signal: controller.signal,
        onProgress: (p) => {
          setProgress(p);
          options.onProgress?.(p);
        },
      });

      return result;
    } finally {
      setIsVerifying(false);
      controllerRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return {
    startVerification,
    cancel,
    progress,
    isVerifying,
  };
}
```

### Pattern 3: Pre-check Before Verification

```typescript
// lib/pre-checks.ts
import {
  isNullifierUsed,
  estimateProveFlowCost,
  computeNullifierForWallet,
} from '@vouch-protocol/sdk';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

interface PreCheckResult {
  canProceed: boolean;
  issues: string[];
  warnings: string[];
  estimatedCost: number;
}

export async function runPreChecks(
  connection: Connection,
  walletPubkey: string,
  proofType: 'developer' | 'whale'
): Promise<PreCheckResult> {
  const issues: string[] = [];
  const warnings: string[] = [];

  // 1. Check if already verified
  const nullifier = computeNullifierForWallet(walletPubkey, proofType);
  const alreadyUsed = await isNullifierUsed(connection, nullifier);

  if (alreadyUsed) {
    issues.push('⚠️ This wallet has already been verified');
  }

  // 2. Check SOL balance
  const balance = await connection.getBalance(new PublicKey(walletPubkey));
  const estimate = await estimateProveFlowCost(connection);

  if (balance < estimate.totalCost * LAMPORTS_PER_SOL) {
    issues.push(`💰 Insufficient balance. Need ${estimate.totalCost} SOL, have ${balance / LAMPORTS_PER_SOL} SOL`);
  }

  // 3. Check network
  if (estimate.network === 'mainnet' && !estimate.willUsePrivacy) {
    warnings.push('🔒 Privacy layer unavailable - proof will be submitted directly');
  }

  return {
    canProceed: issues.length === 0,
    issues,
    warnings,
    estimatedCost: estimate.totalCost,
  };
}
```

---

## 🎨 UI/UX Best Practices

### ✅ Do: Show Clear Progress

```tsx
// Good: Detailed progress with stages
function ProgressIndicator({ progress }: { progress: ProveFlowProgress }) {
  const stages = [
    { key: 'shielding', icon: '🔒', label: 'Privacy' },
    { key: 'generating-proof', icon: '🧮', label: 'Proof' },
    { key: 'submitting', icon: '⛓️', label: 'Submit' },
    { key: 'complete', icon: '✅', label: 'Done' },
  ];

  return (
    <div className="progress-stages">
      {stages.map((stage, i) => (
        <div
          key={stage.key}
          className={`stage ${progress.stage === stage.key ? 'active' : ''}`}
        >
          <span className="icon">{stage.icon}</span>
          <span className="label">{stage.label}</span>
        </div>
      ))}
    </div>
  );
}
```

### ❌ Don't: Leave Users Hanging

```tsx
// Bad: No feedback during long operation
<button onClick={verify}>Verify</button>
{/* User sees nothing for 30 seconds! */}
```

### ✅ Do: Explain What's Happening

```tsx
function VerificationExplainer() {
  return (
    <div className="explainer">
      <h3>🔐 How This Works</h3>
      <ol>
        <li>
          <strong>Your data stays private</strong> - Proof is generated in your browser
        </li>
        <li>
          <strong>Only the result is shared</strong> - We verify you meet the threshold,
          not your actual balance
        </li>
        <li>
          <strong>One-time verification</strong> - Each wallet can only verify once
        </li>
      </ol>
    </div>
  );
}
```

### ✅ Do: Provide Cancellation

```tsx
function VerifyButton() {
  const { startVerification, cancel, isVerifying } = useVerification();

  return (
    <div className="button-group">
      {isVerifying ? (
        <>
          <button disabled>Verifying...</button>
          <button onClick={cancel} className="secondary">
            Cancel
          </button>
        </>
      ) : (
        <button onClick={startVerification}>Verify</button>
      )}
    </div>
  );
}
```

---

## 🖥️ Backend Integration

### Server-Side Proof Verification

```typescript
// api/verify-proof.ts
import { verifyProofLocally, isProofResult } from '@vouch-protocol/sdk';

export async function POST(request: Request) {
  const { proofData, nullifier, campaignId } = await request.json();

  // 1. Validate proof format
  if (!isProofResult(proofData)) {
    return Response.json({ error: 'Invalid proof format' }, { status: 400 });
  }

  // 2. Verify proof cryptographically
  const isValid = await verifyProofLocally(proofData, 'dev_reputation');
  if (!isValid) {
    return Response.json({ error: 'Invalid proof' }, { status: 400 });
  }

  // 3. Check nullifier hasn't been used for this campaign
  const existingClaim = await db.claims.findUnique({
    where: { nullifier_campaignId: { nullifier, campaignId } },
  });

  if (existingClaim) {
    return Response.json({ error: 'Already claimed' }, { status: 409 });
  }

  // 4. Record the claim
  await db.claims.create({
    data: {
      nullifier,
      campaignId,
      commitment: proofData.commitment,
      verifiedAt: new Date(),
    },
  });

  // 5. Grant access/benefit
  // ... your logic here

  return Response.json({ success: true });
}
```

### Database Schema (Prisma Example)

```prisma
// prisma/schema.prisma
model Campaign {
  id           String   @id @default(cuid())
  name         String
  minTvl       Int
  proofType    String
  createdAt    DateTime @default(now())
  claims       Claim[]
}

model Claim {
  id         String   @id @default(cuid())
  nullifier  String
  commitment String
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id])
  verifiedAt DateTime @default(now())

  @@unique([nullifier, campaignId])
  @@index([campaignId])
}
```

---

## ⚠️ Error Handling

### Error Code Reference

| Code | Cause | User Message | Resolution |
|------|-------|--------------|------------|
| `WALLET_NOT_CONNECTED` | No wallet | "Please connect your wallet" | Show wallet connect button |
| `THRESHOLD_NOT_MET` | TVL too low | "Your TVL doesn't meet the minimum" | Show current TVL if possible |
| `NULLIFIER_ALREADY_USED` | Already verified | "This wallet has already verified" | Show existing verification |
| `CIRCUIT_LOAD_FAILED` | WASM error | "Failed to load verification system" | Check CORS headers |
| `PROOF_GENERATION_FAILED` | Circuit error | "Proof generation failed" | Retry or contact support |
| `INSUFFICIENT_FUNDS` | Low SOL | "Insufficient SOL for fees" | Show required amount |
| `TRANSACTION_FAILED` | Solana error | "Transaction failed" | Retry with higher fee |

### Comprehensive Error Handler

```typescript
// lib/error-handler.ts
import { VouchError, VouchErrorCode, isVouchError } from '@vouch-protocol/sdk';

interface ErrorUIState {
  title: string;
  message: string;
  action?: {
    label: string;
    handler: () => void;
  };
  severity: 'error' | 'warning' | 'info';
}

export function getErrorUIState(
  error: unknown,
  actions: {
    connectWallet: () => void;
    retry: () => void;
    showSupport: () => void;
  }
): ErrorUIState {
  if (!isVouchError(error)) {
    return {
      title: 'Unexpected Error',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      action: { label: 'Retry', handler: actions.retry },
      severity: 'error',
    };
  }

  const errorStates: Record<VouchErrorCode, ErrorUIState> = {
    [VouchErrorCode.WALLET_NOT_CONNECTED]: {
      title: 'Wallet Not Connected',
      message: 'Please connect your wallet to continue',
      action: { label: 'Connect Wallet', handler: actions.connectWallet },
      severity: 'warning',
    },
    [VouchErrorCode.THRESHOLD_NOT_MET]: {
      title: 'Threshold Not Met',
      message: 'Your current TVL does not meet the minimum requirement',
      severity: 'info',
    },
    [VouchErrorCode.NULLIFIER_ALREADY_USED]: {
      title: 'Already Verified',
      message: 'This wallet has already completed verification',
      severity: 'info',
    },
    [VouchErrorCode.CIRCUIT_LOAD_FAILED]: {
      title: 'System Error',
      message: 'Failed to load verification system. Please refresh the page.',
      action: { label: 'Refresh', handler: () => window.location.reload() },
      severity: 'error',
    },
    // ... add more as needed
  };

  return errorStates[error.code] || {
    title: 'Verification Failed',
    message: error.message,
    action: { label: 'Contact Support', handler: actions.showSupport },
    severity: 'error',
  };
}
```

---

## 🔒 Security Checklist

### Pre-Launch Checklist

```
☐ CORS headers configured correctly
☐ HTTPS enabled in production
☐ Environment variables secured (no client exposure)
☐ Rate limiting on API endpoints
☐ Nullifier database indexed for fast lookups
☐ Error messages don't leak sensitive info
☐ CSP headers configured
☐ Input validation on all endpoints
```

### Security Best Practices

| Practice | Implementation |
|----------|----------------|
| **Never log secrets** | Remove console.log of private data |
| **Validate on server** | Don't trust client-side verification alone |
| **Use HTTPS** | All production traffic must be encrypted |
| **Rate limit** | Prevent brute-force attempts |
| **Audit nullifiers** | Monitor for unusual patterns |

---

## 🔧 Troubleshooting

### Issue: "SharedArrayBuffer is not defined"

**Cause:** Missing CORS headers

**Solution:**
```javascript
// Add to your server config
headers: {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}
```

### Issue: Proof generation takes forever

**Cause:** Low-powered device or memory pressure

**Solution:**
```typescript
// Add timeout with user feedback
const result = await proveDevReputation(input, {
  ...options,
  timeoutMs: 120000, // 2 minute timeout
  onProgress: (p) => {
    if (p.percentage > 0 && p.percentage < 50) {
      showMessage('This may take 15-30 seconds...');
    }
  },
});
```

### Issue: "Transaction failed"

**Cause:** Solana network congestion or low fees

**Solution:**
```typescript
// Retry with exponential backoff
async function submitWithRetry(proof, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await submitProofToChain(connection, proof, ...);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // 1s, 2s, 4s
    }
  }
}
```

---

## ❓ FAQ

### Q: How long does proof generation take?

**A:** Typically 15-30 seconds on a modern computer. Mobile devices may take longer.

### Q: Can I verify the same wallet twice?

**A:** No. The nullifier pattern ensures each wallet can only verify once per domain.

### Q: What if my TVL changes after verification?

**A:** Verification is a point-in-time check. Future changes don't affect past proofs.

### Q: Is my wallet address revealed?

**A:** No. The ZK proof reveals only that you meet the threshold, not your actual wallet.

### Q: Can I run this on mobile?

**A:** Yes, but performance may be slower. We recommend desktop for best experience.

### Q: What networks are supported?

**A:** Mainnet (with privacy), Devnet (testing), and Testnet.

---

## 📚 Additional Resources

- [📦 SDK Reference](../packages/sdk/README.md)
- [💰 Protocol Fees](./PROTOCOL_FEES.md)
- [🔐 Security Policy](../SECURITY.md)
- [🤝 Contributing Guide](../CONTRIBUTING.md)

---

<p align="center">
  <strong>Need help?</strong><br/>
  <a href="https://github.com/BadGenius22/vouch-protocol/issues">Open an Issue</a> •
  <a href="https://discord.gg/vouch">Join Discord</a>
</p>
