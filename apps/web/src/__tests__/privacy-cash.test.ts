/**
 * Vouch Protocol - Privacy Cash Integration Tests
 * Tests for Privacy Cash SDK wrapper functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

describe('Privacy Cash Integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('generateEphemeralKeypair', () => {
    it('should generate a valid ephemeral keypair', async () => {
      const { generateEphemeralKeypair } = await import('../lib/privacy-cash');

      const ephemeral = generateEphemeralKeypair();

      expect(ephemeral.keypair).toBeDefined();
      expect(ephemeral.keypair).toBeInstanceOf(Keypair);
      expect(ephemeral.publicKey).toBeDefined();
      expect(typeof ephemeral.publicKey).toBe('string');
      expect(ephemeral.publicKey.length).toBeGreaterThan(30); // Base58 address
      expect(ephemeral.secretKey).toBeDefined();
      expect(ephemeral.secretKey).toBeInstanceOf(Uint8Array);
      expect(ephemeral.secretKey.length).toBe(64); // Ed25519 secret key
    });

    it('should generate unique keypairs each time', async () => {
      const { generateEphemeralKeypair } = await import('../lib/privacy-cash');

      const ephemeral1 = generateEphemeralKeypair();
      const ephemeral2 = generateEphemeralKeypair();

      expect(ephemeral1.publicKey).not.toBe(ephemeral2.publicKey);
    });

    it('should have matching publicKey and keypair.publicKey', async () => {
      const { generateEphemeralKeypair } = await import('../lib/privacy-cash');

      const ephemeral = generateEphemeralKeypair();

      expect(ephemeral.publicKey).toBe(ephemeral.keypair.publicKey.toBase58());
    });
  });

  describe('isPrivacyCashAvailable', () => {
    it('should return true when SDK can be imported', async () => {
      // Mock the SDK to be available
      vi.doMock('privacycash', () => ({
        PrivacyCash: vi.fn(),
      }));

      const { isPrivacyCashAvailable } = await import('../lib/privacy-cash');

      const available = await isPrivacyCashAvailable();

      expect(available).toBe(true);
    });
  });

  describe('EphemeralKeypair interface', () => {
    it('should have correct structure', async () => {
      const { generateEphemeralKeypair } = await import('../lib/privacy-cash');

      const ephemeral = generateEphemeralKeypair();

      // Check interface properties
      expect(ephemeral).toHaveProperty('keypair');
      expect(ephemeral).toHaveProperty('publicKey');
      expect(ephemeral).toHaveProperty('secretKey');

      // Check types
      expect(ephemeral.keypair.publicKey).toBeDefined();
      expect(ephemeral.keypair.secretKey).toBeDefined();
    });
  });

  describe('LAMPORTS_PER_SOL constant usage', () => {
    it('should use correct LAMPORTS_PER_SOL value', () => {
      // Verify the constant is correct
      expect(LAMPORTS_PER_SOL).toBe(1000000000);
    });

    it('should correctly convert SOL to lamports', () => {
      const sol = 0.05;
      const lamports = Math.floor(sol * LAMPORTS_PER_SOL);

      expect(lamports).toBe(50000000);
    });

    it('should correctly convert lamports to SOL', () => {
      const lamports = 50000000;
      const sol = lamports / LAMPORTS_PER_SOL;

      expect(sol).toBe(0.05);
    });
  });

  describe('Type exports', () => {
    it('should export PrivacyFundingOptions type', async () => {
      // This is a compile-time check, but we can verify the module exports
      const privacyCashModule = await import('../lib/privacy-cash');

      // Check that the main functions are exported
      expect(typeof privacyCashModule.generateEphemeralKeypair).toBe('function');
      expect(typeof privacyCashModule.fundEphemeralWallet).toBe('function');
      expect(typeof privacyCashModule.createPrivacyCashClient).toBe('function');
      expect(typeof privacyCashModule.depositToPrivacyCash).toBe('function');
      expect(typeof privacyCashModule.withdrawFromPrivacyCash).toBe('function');
      expect(typeof privacyCashModule.getPrivateCashBalance).toBe('function');
      expect(typeof privacyCashModule.fundBurnerViaPrivacyCash).toBe('function');
      expect(typeof privacyCashModule.shieldForProof).toBe('function');
      expect(typeof privacyCashModule.withdrawPrivately).toBe('function');
      expect(typeof privacyCashModule.getPrivateBalance).toBe('function');
      expect(typeof privacyCashModule.isPrivacyCashAvailable).toBe('function');
    });

    it('should export SPL token functions', async () => {
      const privacyCashModule = await import('../lib/privacy-cash');

      expect(typeof privacyCashModule.depositSPLToPrivacyCash).toBe('function');
      expect(typeof privacyCashModule.withdrawSPLFromPrivacyCash).toBe('function');
      expect(typeof privacyCashModule.getSPLPrivateBalance).toBe('function');
    });
  });
});
