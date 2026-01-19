# Changelog

All notable changes to `@vouch-protocol/sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-01-19

### Added

- Initial release of `@vouch-protocol/sdk`
- **High-Level API**
  - `proveDevReputation()` - Prove developer reputation anonymously
  - `proveWhaleTrading()` - Prove whale trading volume anonymously
  - `estimateProveFlowCost()` - Estimate verification costs
  - `createFlowController()` - Create cancellable proof flow
  - `isEnhancedPrivacyAvailable()` - Check ShadowWire availability

- **Core Proof Functions**
  - `generateDevReputationProof()` - Low-level proof generation
  - `generateWhaleTradingProof()` - Trading proof generation
  - `verifyProofLocally()` - Local verification for testing
  - Proof serialization utilities

- **On-Chain Verification**
  - `submitProofToChain()` - Submit proofs to Solana
  - `isNullifierUsed()` - Check nullifier status
  - `isCommitmentRegistered()` - Check commitment status
  - PDA derivation functions
  - Cost estimation utilities

- **Private Airdrop Registry**
  - Campaign creation and management
  - Registration functions (standard and open)
  - Distribution utilities
  - Campaign validation helpers

- **Privacy Utilities**
  - ShadowWire integration (mainnet)
  - Secure cleanup functions
  - Retry and timeout utilities
  - Validation helpers

- **Connection Management**
  - Connection pool creation
  - RPC health checking
  - Network detection
  - Explorer URL generators

### Security

- All proofs generated client-side (browser)
- Nullifier pattern prevents double-verification
- Domain separation for different proof types
- Secure random number generation for secrets

[Unreleased]: https://github.com/BadGenius22/vouch-protocol/compare/sdk-v0.1.0...HEAD
[0.1.0]: https://github.com/BadGenius22/vouch-protocol/releases/tag/sdk-v0.1.0
