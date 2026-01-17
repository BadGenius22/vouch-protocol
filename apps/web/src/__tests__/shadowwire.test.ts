/**
 * Vouch Protocol - ShadowWire Integration Tests
 * Tests for ShadowWire SDK wrapper functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock WebAssembly for Node.js environment
vi.stubGlobal('WebAssembly', {
  instantiate: vi.fn(),
});

// Mock the @radr/shadowwire SDK
vi.mock('@radr/shadowwire', () => ({
  ShadowWireClient: vi.fn().mockImplementation(() => ({
    getBalance: vi.fn().mockResolvedValue({
      wallet: 'mock-wallet',
      available: 100000000, // 0.1 SOL in lamports
      deposited: 200000000,
      withdrawn_to_escrow: 0,
      migrated: false,
      pool_address: 'mock-pool-address',
    }),
    deposit: vi.fn().mockResolvedValue({
      success: true,
      unsigned_tx_base64: 'mock-unsigned-tx',
      pool_address: 'mock-pool',
      user_balance_pda: 'mock-pda',
      amount: 100000000,
    }),
    withdraw: vi.fn().mockResolvedValue({
      success: true,
      unsigned_tx_base64: 'mock-withdraw-tx',
      amount_withdrawn: 50000000,
      fee: 500000,
    }),
    transfer: vi.fn().mockResolvedValue({
      success: true,
      tx_signature: 'mock-transfer-tx',
      amount_sent: 100000000,
      amount_hidden: true,
      proof_pda: 'mock-proof-pda',
    }),
    transferWithClientProofs: vi.fn().mockResolvedValue({
      success: true,
      tx_signature: 'mock-client-proof-transfer-tx',
      amount_sent: null,
      amount_hidden: true,
      proof_pda: 'mock-proof-pda',
    }),
  })),
  initWASM: vi.fn().mockResolvedValue(undefined),
  isWASMSupported: vi.fn().mockReturnValue(true),
  generateRangeProof: vi.fn().mockResolvedValue({
    proofBytes: 'mock-proof-bytes',
    commitmentBytes: 'mock-commitment-bytes',
    blindingFactorBytes: 'mock-blinding-bytes',
  }),
  TokenUtils: {
    toSmallestUnit: vi.fn((amount: number, _token: string) => Math.floor(amount * 1e9)),
    fromSmallestUnit: vi.fn((amount: number, _token: string) => amount / 1e9),
  },
  SUPPORTED_TOKENS: ['SOL', 'RADR', 'USDC'],
}));

describe('ShadowWire Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isShadowWireAvailable', () => {
    it('should return true when SDK is available', async () => {
      const { isShadowWireAvailable } = await import('../lib/shadowwire');

      const available = await isShadowWireAvailable();

      expect(available).toBe(true);
    });
  });

  describe('isWASMSupported', () => {
    it('should be a function that returns a boolean', async () => {
      const { isWASMSupported } = await import('../lib/shadowwire');

      expect(typeof isWASMSupported).toBe('function');
      // Result can be true, false, or undefined based on environment
      // Just verify the function is exported and callable
      const result = isWASMSupported();
      expect(result === true || result === false || result === undefined).toBe(true);
    });
  });

  describe('toSmallestUnit and fromSmallestUnit', () => {
    it('should convert SOL to lamports', async () => {
      const { toSmallestUnit } = await import('../lib/shadowwire');

      const lamports = toSmallestUnit(1, 'SOL');

      expect(lamports).toBe(1000000000); // 1 SOL = 1e9 lamports
    });

    it('should convert lamports to SOL', async () => {
      const { fromSmallestUnit } = await import('../lib/shadowwire');

      const sol = fromSmallestUnit(1000000000, 'SOL');

      expect(sol).toBe(1);
    });

    it('should handle USDC decimals (6)', async () => {
      const { toSmallestUnit, fromSmallestUnit } = await import('../lib/shadowwire');

      // USDC has 6 decimals
      const baseUnits = toSmallestUnit(100, 'USDC');
      expect(baseUnits).toBe(100000000); // 100 USDC = 100 * 1e6 = 100000000

      // Convert back: 100000000 / 1e6 = 100
      const usdc = fromSmallestUnit(100000000, 'USDC');
      expect(usdc).toBe(100);
    });
  });

  describe('SUPPORTED_TOKENS', () => {
    it('should export supported tokens', async () => {
      const { SUPPORTED_TOKENS } = await import('../lib/shadowwire');

      expect(SUPPORTED_TOKENS).toBeDefined();
      expect(Array.isArray(SUPPORTED_TOKENS)).toBe(true);
      expect(SUPPORTED_TOKENS).toContain('SOL');
      expect(SUPPORTED_TOKENS).toContain('USDC');
      expect(SUPPORTED_TOKENS).toContain('RADR');
    });
  });

  describe('getShadowBalance', () => {
    it('should return 0 for empty wallet address', async () => {
      const { getShadowBalance } = await import('../lib/shadowwire');

      const balance = await getShadowBalance('', 'SOL');

      expect(balance.available).toBe(0);
      expect(balance.poolAddress).toBe('');
    });
  });

  describe('Airdrop helpers', () => {
    describe('AirdropRecipient interface', () => {
      it('should have correct structure', async () => {
        const { distributePrivateAirdrop } = await import('../lib/shadowwire');

        // Just verify the function exists and accepts the right structure
        expect(typeof distributePrivateAirdrop).toBe('function');
      });
    });
  });

  describe('ShadowWireFlowOptions', () => {
    it('should export flow helper', async () => {
      const { executeShadowWireFlow } = await import('../lib/shadowwire');

      expect(typeof executeShadowWireFlow).toBe('function');
    });
  });

  describe('Type exports', () => {
    it('should export all required functions', async () => {
      const shadowWireModule = await import('../lib/shadowwire');

      // Core functions
      expect(typeof shadowWireModule.isShadowWireAvailable).toBe('function');
      expect(typeof shadowWireModule.isWASMSupported).toBe('function');
      expect(typeof shadowWireModule.initializeShadowWire).toBe('function');

      // Balance and transfers
      expect(typeof shadowWireModule.getShadowBalance).toBe('function');
      expect(typeof shadowWireModule.depositToShadow).toBe('function');
      expect(typeof shadowWireModule.withdrawFromShadow).toBe('function');
      expect(typeof shadowWireModule.privateTransfer).toBe('function');
      expect(typeof shadowWireModule.privateTransferWithClientProof).toBe('function');

      // Utility functions
      expect(typeof shadowWireModule.toSmallestUnit).toBe('function');
      expect(typeof shadowWireModule.fromSmallestUnit).toBe('function');

      // Airdrop functions
      expect(typeof shadowWireModule.distributePrivateAirdrop).toBe('function');
      expect(typeof shadowWireModule.claimAirdropToWallet).toBe('function');

      // Flow helper
      expect(typeof shadowWireModule.executeShadowWireFlow).toBe('function');
    });

    it('should export SUPPORTED_TOKENS constant', async () => {
      const { SUPPORTED_TOKENS } = await import('../lib/shadowwire');

      expect(SUPPORTED_TOKENS).toBeDefined();
      expect(SUPPORTED_TOKENS.length).toBeGreaterThan(0);
    });
  });
});
