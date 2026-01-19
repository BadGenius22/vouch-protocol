<h1 align="center">🔒 Security Policy</h1>

<p align="center">
  <strong>Vouch Protocol takes security seriously</strong><br/>
  This document outlines our security practices and vulnerability disclosure process
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Security-Priority%20%231-red?style=flat-square" alt="Security Priority"/>
  <img src="https://img.shields.io/badge/Response%20Time-<24%20hours-green?style=flat-square" alt="Response Time"/>
  <img src="https://img.shields.io/badge/Bug%20Bounty-Coming%20Soon-blue?style=flat-square" alt="Bug Bounty"/>
</p>

---

## 📋 Table of Contents

- [Reporting a Vulnerability](#-reporting-a-vulnerability)
- [Security Model](#-security-model)
- [Supported Versions](#-supported-versions)
- [Security Measures](#-security-measures)
- [Threat Model](#-threat-model)
- [Audit History](#-audit-history)
- [Bug Bounty Program](#-bug-bounty-program)
- [Security Checklist](#-security-checklist)
- [Contact](#-contact)

---

## 🚨 Reporting a Vulnerability

### Responsible Disclosure

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, report them via:

| Method | Contact | Response Time |
|--------|---------|---------------|
| 📧 Email | **security@vouch-protocol.com** | < 24 hours |
| 🔐 PGP | [Public Key](#pgp-key) | < 24 hours |

### What to Include

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VULNERABILITY REPORT TEMPLATE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SUBJECT: [Brief description of vulnerability]                       │
│                                                                      │
│  1. SUMMARY                                                          │
│     Brief description of the vulnerability                           │
│                                                                      │
│  2. AFFECTED COMPONENTS                                              │
│     - Package/file: [e.g., apps/web/src/lib/proof.ts]               │
│     - Version: [e.g., 0.1.0]                                        │
│     - Network: [mainnet/devnet/all]                                 │
│                                                                      │
│  3. SEVERITY ASSESSMENT                                              │
│     Your estimate: [Critical/High/Medium/Low]                        │
│                                                                      │
│  4. REPRODUCTION STEPS                                               │
│     Step-by-step instructions to reproduce                           │
│                                                                      │
│  5. PROOF OF CONCEPT                                                 │
│     Code, screenshots, or logs demonstrating the issue               │
│                                                                      │
│  6. POTENTIAL IMPACT                                                 │
│     What could an attacker do with this vulnerability?               │
│                                                                      │
│  7. SUGGESTED FIX (Optional)                                         │
│     If you have a proposed solution                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Disclosure Timeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                     DISCLOSURE PROCESS TIMELINE                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Day 0     │ Vulnerability reported                                  │
│            │ └── Acknowledgment sent within 24 hours                 │
│            │                                                          │
│  Day 1-3   │ Initial assessment                                      │
│            │ ├── Severity classification                              │
│            │ └── Preliminary response to reporter                    │
│            │                                                          │
│  Day 4-14  │ Fix development                                         │
│            │ ├── Patch development                                    │
│            │ ├── Internal testing                                     │
│            │ └── Reporter notified of progress                       │
│            │                                                          │
│  Day 15-30 │ Coordinated disclosure                                  │
│            │ ├── Fix deployed to production                          │
│            │ ├── Security advisory published                         │
│            │ └── Public acknowledgment (if desired)                  │
│            │                                                          │
│  Day 90    │ Full public disclosure                                  │
│            │ └── Detailed write-up published                         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### What to Expect

After you submit a vulnerability report:

1. **Acknowledgment** - We'll respond within 24 hours
2. **Assessment** - We'll evaluate severity and impact
3. **Updates** - We'll keep you informed of our progress
4. **Credit** - We'll acknowledge your contribution (unless you prefer anonymity)
5. **Bounty** - Eligible reports receive rewards (see Bug Bounty section)

---

## 🏗️ Security Model

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      VOUCH PROTOCOL SECURITY MODEL                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     CLIENT (BROWSER)                         │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │  Private Data (NEVER leaves browser)                 │   │    │
│  │  │  • Wallet private key                                │   │    │
│  │  │  • Secret random value                               │   │    │
│  │  │  • Full wallet address (hashed before proof)         │   │    │
│  │  │  • Actual TVL/trading amounts                        │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  │                           │                                  │    │
│  │                     ZK Proof Generation (WASM)               │    │
│  │                           │                                  │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │  Public Outputs (shared for verification)            │   │    │
│  │  │  • Commitment hash                                   │   │    │
│  │  │  • Nullifier hash                                    │   │    │
│  │  │  • Threshold proof (pass/fail)                       │   │    │
│  │  │  • ZK proof bytes                                    │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                │                                     │
│                         Proof Submission                             │
│                                ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     SOLANA BLOCKCHAIN                        │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │  On-Chain Verification                               │   │    │
│  │  │  • Verify ZK proof (cryptographic validation)        │   │    │
│  │  │  • Check nullifier uniqueness                        │   │    │
│  │  │  • Store commitment (if new)                         │   │    │
│  │  │  • Mark nullifier as used                            │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Privacy Guarantees

| Property | Guarantee | Technical Basis |
|----------|-----------|-----------------|
| **Wallet Anonymity** | Wallet address is never revealed | Commitment = Hash(wallet + secret) |
| **Threshold Privacy** | Exact amounts not revealed | ZK proves (amount ≥ threshold) only |
| **Unlinkability** | Different proofs can't be linked | Nullifier uses domain separation |
| **No Server Trust** | No trusted third party | Proof generated client-side |

### Trust Assumptions

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRUST ASSUMPTIONS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🟢 TRUSTED                                                          │
│  ├── Noir/Barretenberg cryptographic primitives                      │
│  ├── Solana blockchain consensus                                     │
│  ├── User's browser environment                                      │
│  └── WASM integrity (verified via SRI hashes)                       │
│                                                                      │
│  🟡 SEMI-TRUSTED                                                     │
│  ├── RPC provider (can see transaction timing)                       │
│  ├── Helius API (can see data queries, not proofs)                  │
│  └── Circuit serving CDN (integrity verified)                       │
│                                                                      │
│  🔴 NOT TRUSTED                                                      │
│  ├── Vouch Protocol servers (no server-side secrets)                │
│  ├── Other users (nullifiers prevent impersonation)                 │
│  └── Network observers (encrypted + ZK)                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Supported Versions

| Version | Status | Security Updates |
|---------|--------|------------------|
| 0.1.x | ✅ Active | Full support |
| < 0.1.0 | ❌ Unsupported | No updates |

**Note:** Always use the latest version for security fixes.

---

## 🛡️ Security Measures

### Cryptographic Security

| Component | Algorithm | Security Level |
|-----------|-----------|----------------|
| Proof System | UltraHonk (Barretenberg) | 128-bit |
| Hash Function | BLAKE2s | 256-bit output |
| Commitment Scheme | Hash-based | Binding + Hiding |
| Nullifier Derivation | Domain-separated hash | Collision-resistant |

### Code Security

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CODE SECURITY PRACTICES                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔐 SECURE DEVELOPMENT                                               │
│  ├── ✅ All dependencies pinned to exact versions                   │
│  ├── ✅ Automated dependency vulnerability scanning                  │
│  ├── ✅ TypeScript strict mode enabled                              │
│  ├── ✅ ESLint security rules enforced                              │
│  └── ✅ Input validation on all public APIs                         │
│                                                                      │
│  🔒 CIRCUIT SECURITY                                                 │
│  ├── ✅ No unconstrained values in public outputs                   │
│  ├── ✅ Domain separation for different proof types                 │
│  ├── ✅ Nullifier prevents double-spending                          │
│  └── ✅ Constant-time operations where possible                     │
│                                                                      │
│  ⚓ ANCHOR PROGRAM SECURITY                                          │
│  ├── ✅ All accounts validated with Anchor constraints              │
│  ├── ✅ PDA seeds prevent account confusion                         │
│  ├── ✅ Owner checks on all mutable accounts                        │
│  └── ✅ Signer verification for sensitive operations                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Infrastructure Security

| Layer | Protection |
|-------|------------|
| Transport | HTTPS/TLS 1.3 required |
| Browser | COOP/COEP headers for WASM isolation |
| Circuit Files | Subresource Integrity (SRI) hashes |
| RPC | Rate limiting, authenticated access |

---

## ⚠️ Threat Model

### In-Scope Threats

| Threat | Mitigation | Status |
|--------|------------|--------|
| **Proof Forgery** | Cryptographic proof verification | ✅ Mitigated |
| **Double Verification** | Nullifier system | ✅ Mitigated |
| **Front-Running** | Commitment scheme | ✅ Mitigated |
| **Wallet Deanonymization** | ZK proofs hide wallet | ✅ Mitigated |
| **Replay Attacks** | Unique nullifiers per domain | ✅ Mitigated |

### Out-of-Scope Threats

| Threat | Reason | Recommendation |
|--------|--------|----------------|
| **Compromised Browser** | User environment | Use trusted device |
| **Social Engineering** | Human factor | Security awareness |
| **Wallet Key Theft** | External to protocol | Secure key storage |
| **Network Timing Analysis** | Optional privacy layer | Use ShadowWire |

### Known Limitations

```
┌─────────────────────────────────────────────────────────────────────┐
│                      KNOWN SECURITY LIMITATIONS                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. TRANSACTION VISIBILITY (without ShadowWire)                      │
│     │                                                                │
│     ├── Risk: Proof submission transactions are public              │
│     ├── Impact: Can see THAT someone verified, not WHO              │
│     └── Mitigation: Use ShadowWire for full privacy                 │
│                                                                      │
│  2. HELIUS API QUERIES                                               │
│     │                                                                │
│     ├── Risk: Helius can see wallet lookup requests                 │
│     ├── Impact: Metadata about query timing                         │
│     └── Mitigation: Self-hosted RPC option (future)                 │
│                                                                      │
│  3. PROOF EXPIRATION                                                 │
│     │                                                                │
│     ├── Risk: Proofs valid for limited time (1 hour)                │
│     ├── Impact: Must submit within window                           │
│     └── Mitigation: Designed for security (not a bug)               │
│                                                                      │
│  4. THRESHOLD GRANULARITY                                            │
│     │                                                                │
│     ├── Risk: Proof reveals (amount ≥ threshold)                    │
│     ├── Impact: Some information leakage at boundary                │
│     └── Mitigation: Use wide threshold ranges                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Audit History

### Completed Audits

| Date | Auditor | Scope | Findings | Report |
|------|---------|-------|----------|--------|
| TBD | Pending | Full protocol | - | - |

### Planned Audits

| Timeline | Auditor | Scope |
|----------|---------|-------|
| Q1 2025 | TBD | Noir circuits |
| Q2 2025 | TBD | Anchor program |
| Q3 2025 | TBD | Full protocol |

**Note:** We are actively seeking audit partners. Contact us if interested.

---

## 💰 Bug Bounty Program

### Coming Soon

We are launching a bug bounty program. Details will be announced soon.

### Preliminary Reward Structure

| Severity | Description | Reward Range |
|----------|-------------|--------------|
| 🔴 **Critical** | Direct fund loss, proof forgery | $5,000 - $25,000 |
| 🟠 **High** | Privacy breach, DoS on mainnet | $1,000 - $5,000 |
| 🟡 **Medium** | Limited impact vulnerabilities | $250 - $1,000 |
| 🟢 **Low** | Minor issues, best practices | $50 - $250 |

### Scope

**In Scope:**
- Noir circuits (`circuits/`)
- Anchor program (`programs/vouch-verifier/`)
- SDK (`packages/sdk/`)
- Web application (`apps/web/src/lib/`)

**Out of Scope:**
- Third-party dependencies (report to maintainers)
- Social engineering
- Phishing
- Physical attacks
- DoS without meaningful impact

### Rules

1. **No Public Disclosure** - Report privately first
2. **No Exploitation** - Don't access real user data
3. **Minimal Testing** - Don't degrade services
4. **Good Faith** - Act ethically and legally
5. **Documentation** - Provide clear reproduction steps

---

## ✅ Security Checklist

### For Developers

```
┌─────────────────────────────────────────────────────────────────────┐
│                   DEVELOPER SECURITY CHECKLIST                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Before Every Commit:                                                │
│  □ No secrets in code (API keys, private keys)                      │
│  □ Input validation on new functions                                 │
│  □ Error handling doesn't leak sensitive info                       │
│  □ Dependencies updated and scanned                                  │
│                                                                      │
│  Before Every Release:                                               │
│  □ Security-focused code review                                      │
│  □ All tests passing                                                 │
│  □ CHANGELOG updated with security notes                            │
│  □ Version bumped appropriately                                      │
│                                                                      │
│  Circuit Changes:                                                    │
│  □ All constraints documented                                        │
│  □ No unconstrained outputs                                          │
│  □ Formal verification where possible                               │
│  □ Constraint count within limits                                    │
│                                                                      │
│  Anchor Changes:                                                     │
│  □ Account validation comprehensive                                  │
│  □ PDA seeds correct                                                 │
│  □ Signer checks present                                             │
│  □ Error codes meaningful                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### For Users

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER SECURITY CHECKLIST                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Before Verification:                                                │
│  □ Using official Vouch Protocol website                            │
│  □ URL is correct (check for typos/phishing)                        │
│  □ HTTPS connection (lock icon)                                     │
│  □ Wallet shows correct transaction details                         │
│                                                                      │
│  General Security:                                                   │
│  □ Keep browser and extensions updated                              │
│  □ Use hardware wallet for high-value accounts                      │
│  □ Never share seed phrases                                          │
│  □ Verify transaction details before signing                        │
│                                                                      │
│  If Something Seems Wrong:                                           │
│  □ Don't proceed with suspicious transactions                       │
│  □ Report to security@vouch-protocol.com                            │
│  □ Check official Discord for announcements                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📞 Contact

### Security Team

| Contact | Method | Response Time |
|---------|--------|---------------|
| Security Reports | security@vouch-protocol.com | < 24 hours |
| General Security Questions | GitHub Discussions | < 72 hours |

### PGP Key

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
[PGP key will be published here]
-----END PGP PUBLIC KEY BLOCK-----
```

**Fingerprint:** `XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX`

---

## 📜 Security Acknowledgments

We thank the following security researchers for their responsible disclosure:

| Researcher | Vulnerability | Date | Severity |
|------------|---------------|------|----------|
| *None yet* | - | - | - |

*Your name could be here! Report vulnerabilities responsibly.*

---

<p align="center">
  <strong>🔒 Security is our top priority</strong><br/>
  Thank you for helping keep Vouch Protocol safe
</p>

<p align="center">
  <sub>Last updated: January 2025</sub>
</p>
