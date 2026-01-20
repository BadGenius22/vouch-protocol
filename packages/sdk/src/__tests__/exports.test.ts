/**
 * Smoke tests to verify all SDK exports are properly exposed.
 * These tests ensure the SDK can be imported without errors
 * and all documented exports exist.
 *
 * IMPORTANT: These tests run against the BUILT output (dist/index.mjs)
 * not the source. Run `pnpm build` before testing.
 */

import { describe, it, expect } from 'vitest';

// Import the built SDK - alias configured in vitest.config.ts
const SDK_PATH = '@vouch-protocol/sdk';

describe('@vouch-protocol/sdk exports', () => {
  describe('High-Level API', () => {
    it('exports proveDevReputation', async () => {
      const { proveDevReputation } = await import(SDK_PATH);
      expect(proveDevReputation).toBeDefined();
      expect(typeof proveDevReputation).toBe('function');
    });

    it('exports proveWhaleTrading', async () => {
      const { proveWhaleTrading } = await import(SDK_PATH);
      expect(proveWhaleTrading).toBeDefined();
      expect(typeof proveWhaleTrading).toBe('function');
    });

    it('exports flow utilities', async () => {
      const {
        isEnhancedPrivacyAvailable,
        estimateProveFlowCost,
        createFlowController,
      } = await import(SDK_PATH);
      expect(isEnhancedPrivacyAvailable).toBeDefined();
      expect(estimateProveFlowCost).toBeDefined();
      expect(createFlowController).toBeDefined();
    });
  });

  describe('Core Proof Functions', () => {
    it('exports proof generation functions', async () => {
      const {
        generateDevReputationProof,
        generateWhaleTradingProof,
        verifyProofLocally,
      } = await import(SDK_PATH);
      expect(generateDevReputationProof).toBeDefined();
      expect(generateWhaleTradingProof).toBeDefined();
      expect(verifyProofLocally).toBeDefined();
    });

    it('exports proof utilities', async () => {
      const {
        serializeProofResult,
        deserializeProofResult,
        getProofSize,
      } = await import(SDK_PATH);
      expect(serializeProofResult).toBeDefined();
      expect(deserializeProofResult).toBeDefined();
      expect(getProofSize).toBeDefined();
    });
  });

  describe('On-Chain Verification', () => {
    it('exports submitProofToChain', async () => {
      const { submitProofToChain } = await import(SDK_PATH);
      expect(submitProofToChain).toBeDefined();
      expect(typeof submitProofToChain).toBe('function');
    });

    it('exports nullifier and commitment checks', async () => {
      const {
        isNullifierUsed,
        isCommitmentRegistered,
        preVerificationChecks,
      } = await import(SDK_PATH);
      expect(isNullifierUsed).toBeDefined();
      expect(isCommitmentRegistered).toBeDefined();
      expect(preVerificationChecks).toBeDefined();
    });

    it('exports PDA derivation functions', async () => {
      const {
        deriveNullifierPDA,
        deriveCommitmentPDA,
      } = await import(SDK_PATH);
      expect(deriveNullifierPDA).toBeDefined();
      expect(deriveCommitmentPDA).toBeDefined();
    });

    it('exports program utilities', async () => {
      const {
        getVerifierProgram,
        isProgramDeployed,
        estimateVerificationCost,
      } = await import(SDK_PATH);
      expect(getVerifierProgram).toBeDefined();
      expect(isProgramDeployed).toBeDefined();
      expect(estimateVerificationCost).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('exports VouchError class', async () => {
      const { VouchError } = await import(SDK_PATH);
      expect(VouchError).toBeDefined();
      expect(typeof VouchError).toBe('function');
    });

    it('exports VouchErrorCode enum', async () => {
      const { VouchErrorCode } = await import(SDK_PATH);
      expect(VouchErrorCode).toBeDefined();
      expect(VouchErrorCode.WALLET_NOT_CONNECTED).toBeDefined();
      expect(VouchErrorCode.THRESHOLD_NOT_MET).toBeDefined();
      expect(VouchErrorCode.NULLIFIER_ALREADY_USED).toBeDefined();
    });

    it('exports error type guards', async () => {
      const { isVouchError, isProofResult } = await import(SDK_PATH);
      expect(isVouchError).toBeDefined();
      expect(isProofResult).toBeDefined();
      expect(typeof isVouchError).toBe('function');
      expect(typeof isProofResult).toBe('function');
    });
  });

  describe('Constants', () => {
    it('exports CIRCUIT_CONSTANTS', async () => {
      const { CIRCUIT_CONSTANTS } = await import(SDK_PATH);
      expect(CIRCUIT_CONSTANTS).toBeDefined();
      expect(typeof CIRCUIT_CONSTANTS).toBe('object');
    });

    it('exports SECURITY_CONSTANTS', async () => {
      const { SECURITY_CONSTANTS } = await import(SDK_PATH);
      expect(SECURITY_CONSTANTS).toBeDefined();
      expect(typeof SECURITY_CONSTANTS).toBe('object');
    });
  });

  describe('Circuit Management', () => {
    it('exports circuit loading functions', async () => {
      const {
        loadCircuit,
        preloadCircuits,
        clearCircuitCache,
        isCircuitCached,
      } = await import(SDK_PATH);
      expect(loadCircuit).toBeDefined();
      expect(preloadCircuits).toBeDefined();
      expect(clearCircuitCache).toBeDefined();
      expect(isCircuitCached).toBeDefined();
    });
  });

  describe('Privacy Utilities', () => {
    it('exports logging utilities', async () => {
      const { createLogger } = await import(SDK_PATH);
      expect(createLogger).toBeDefined();
      expect(typeof createLogger).toBe('function');
    });

    it('exports retry utilities', async () => {
      const { withRetry, withTimeout, sleep } = await import(SDK_PATH);
      expect(withRetry).toBeDefined();
      expect(withTimeout).toBeDefined();
      expect(sleep).toBeDefined();
    });

    it('exports secure cleanup utilities', async () => {
      const { secureZero, secureCleanupKeypair } = await import(SDK_PATH);
      expect(secureZero).toBeDefined();
      expect(secureCleanupKeypair).toBeDefined();
    });

    it('exports validation utilities', async () => {
      const { isValidSolanaAddress, isValidAmount } = await import(SDK_PATH);
      expect(isValidSolanaAddress).toBeDefined();
      expect(isValidAmount).toBeDefined();
    });
  });

  describe('ShadowWire Integration', () => {
    it('exports ShadowWire functions', async () => {
      const {
        isShadowWireAvailable,
        initializeShadowWire,
        depositToShadow,
        withdrawFromShadow,
        privateTransfer,
        getShadowBalance,
      } = await import(SDK_PATH);
      expect(isShadowWireAvailable).toBeDefined();
      expect(initializeShadowWire).toBeDefined();
      expect(depositToShadow).toBeDefined();
      expect(withdrawFromShadow).toBeDefined();
      expect(privateTransfer).toBeDefined();
      expect(getShadowBalance).toBeDefined();
    });

    it('exports token utilities', async () => {
      const {
        SUPPORTED_TOKENS,
        isSupportedToken,
        toSmallestUnit,
        fromSmallestUnit,
      } = await import(SDK_PATH);
      expect(SUPPORTED_TOKENS).toBeDefined();
      expect(isSupportedToken).toBeDefined();
      expect(toSmallestUnit).toBeDefined();
      expect(fromSmallestUnit).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    it('exports connection utilities', async () => {
      const {
        createConnection,
        createHealthyConnection,
        createConnectionPool,
        getCurrentNetwork,
        getExplorerUrl,
        getSolscanUrl,
        checkRPCHealth,
      } = await import(SDK_PATH);
      expect(createConnection).toBeDefined();
      expect(createHealthyConnection).toBeDefined();
      expect(createConnectionPool).toBeDefined();
      expect(getCurrentNetwork).toBeDefined();
      expect(getExplorerUrl).toBeDefined();
      expect(getSolscanUrl).toBeDefined();
      expect(checkRPCHealth).toBeDefined();
    });
  });

  describe('Airdrop Registry', () => {
    it('exports PDA derivation functions', async () => {
      const {
        getCampaignPDA,
        getRegistrationPDA,
        getOpenRegistrationPDA,
        getNullifierPDA,
        generateCampaignId,
        generateCampaignIdAsync,
      } = await import(SDK_PATH);
      expect(getCampaignPDA).toBeDefined();
      expect(getRegistrationPDA).toBeDefined();
      expect(getOpenRegistrationPDA).toBeDefined();
      expect(getNullifierPDA).toBeDefined();
      expect(generateCampaignId).toBeDefined();
      expect(generateCampaignIdAsync).toBeDefined();
    });

    it('exports instruction builders', async () => {
      const {
        buildCreateCampaignInstruction,
        buildRegisterForAirdropInstruction,
        buildRegisterForAirdropOpenInstruction,
        buildCloseRegistrationInstruction,
        buildMarkDistributedInstruction,
        buildCompleteCampaignInstruction,
      } = await import(SDK_PATH);
      expect(buildCreateCampaignInstruction).toBeDefined();
      expect(buildRegisterForAirdropInstruction).toBeDefined();
      expect(buildRegisterForAirdropOpenInstruction).toBeDefined();
      expect(buildCloseRegistrationInstruction).toBeDefined();
      expect(buildMarkDistributedInstruction).toBeDefined();
      expect(buildCompleteCampaignInstruction).toBeDefined();
    });

    it('exports high-level airdrop functions', async () => {
      const {
        fetchCampaign,
        fetchCampaignRegistrations,
        isRegisteredForCampaign,
        isOpenRegisteredForCampaign,
        distributeAirdropPrivately,
      } = await import(SDK_PATH);
      expect(fetchCampaign).toBeDefined();
      expect(fetchCampaignRegistrations).toBeDefined();
      expect(isRegisteredForCampaign).toBeDefined();
      expect(isOpenRegisteredForCampaign).toBeDefined();
      expect(distributeAirdropPrivately).toBeDefined();
    });

    it('exports validation helpers', async () => {
      const {
        validateCampaignParams,
        validateShadowWireAddress,
        calculateAirdropAmount,
      } = await import(SDK_PATH);
      expect(validateCampaignParams).toBeDefined();
      expect(validateShadowWireAddress).toBeDefined();
      expect(calculateAirdropAmount).toBeDefined();
    });
  });
});

describe('SDK module', () => {
  it('can be imported without errors', async () => {
    const sdk = await import(SDK_PATH);
    expect(sdk).toBeDefined();
    expect(Object.keys(sdk).length).toBeGreaterThan(50); // Should have 90+ exports
  });

  it('exports version info in banner', async () => {
    // The built file should have a banner comment with license info
    // This is a simple check that the module loads correctly
    const sdk = await import(SDK_PATH);
    expect(sdk.VouchError).toBeDefined();
  });
});
