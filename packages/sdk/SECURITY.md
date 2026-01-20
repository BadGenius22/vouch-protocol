# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously at Vouch Protocol. If you discover a security vulnerability, please follow these guidelines:

### Do NOT

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed
- Exploit the vulnerability for personal gain

### Do

1. **Email us directly** at security@vouch.dev (or open a private security advisory on GitHub)
2. **Include details** such as:
   - Type of vulnerability (e.g., ZK circuit bug, smart contract issue, SDK vulnerability)
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. **Allow time** for us to respond and fix the issue before public disclosure

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the severity and impact within 7 days
- **Fix Timeline**: Critical issues will be addressed within 14 days
- **Credit**: With your permission, we will credit you in our security advisories

## Security Considerations

### ZK Proof Security

- Proofs are generated **client-side only** - private inputs never leave the browser
- The SDK uses exact-pinned versions of Noir (1.0.0-beta.18) and Barretenberg (3.0.2) to prevent supply chain attacks
- Nullifiers prevent double-proving (Sybil resistance)
- Commitments are binding - you cannot change the claimed wallet after proof generation

### On-Chain Security

- Verifier program is deployed on Solana devnet/mainnet
- PDAs are derived deterministically from nullifiers and commitments
- All transactions are signed by the user's wallet

### Dependencies

We carefully audit and pin critical dependencies:

| Dependency | Risk Level | Mitigation |
|------------|------------|------------|
| @noir-lang/noir_js | High | Exact version pin |
| @aztec/bb.js | High | Exact version pin |
| @coral-xyz/anchor | Medium | Caret range with audit |
| blakejs | Low | Mature, audited library |

### Browser Requirements

The SDK requires modern browsers with:
- SharedArrayBuffer support (for WASM multi-threading)
- Proper COOP/COEP headers for cross-origin isolation

Without these, proof generation will fail safely with a clear error message.

## Security Audits

- [ ] Smart contract audit (planned)
- [ ] ZK circuit audit (planned)
- [ ] SDK security review (planned)

## Bug Bounty

We are planning to launch a bug bounty program. Details will be announced on our GitHub repository.

## Contact

- **Security Issues**: security@vouch.dev
- **General Questions**: https://github.com/BadGenius22/vouch-protocol/discussions
- **Bug Reports**: https://github.com/BadGenius22/vouch-protocol/issues
