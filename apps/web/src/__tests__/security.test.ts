/**
 * Vouch Protocol - Security Utilities Tests
 * Tests for input validation, proof TTL, and security helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isProofExpired,
  getProofTimeRemaining,
  validateProofNotExpired,
  calculateProofExpiration,
  validateProofSize,
  validatePublicInputsSize,
  isValidHexString,
  isValidBase58String,
  sanitizeString,
  validateProof,
  validateSerializedProof,
  isValidSolanaAddress,
  validateSolanaAddress,
  formatRateLimitTime,
} from '../lib/security';
import { SECURITY_CONSTANTS, VouchError, VouchErrorCode } from '../lib/types';
import type { ProofResult, SerializedProofResult } from '../lib/types';

describe('security utilities', () => {
  // Mock Date.now for deterministic tests
  let mockNow: number;

  beforeEach(() => {
    mockNow = 1704067200000; // 2024-01-01 00:00:00 UTC
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // === Proof TTL Tests ===

  describe('isProofExpired', () => {
    it('should return false for non-expired proof', () => {
      const proof = { expiresAt: mockNow + 60000 } as ProofResult;
      expect(isProofExpired(proof)).toBe(false);
    });

    it('should return true for expired proof', () => {
      const proof = { expiresAt: mockNow - 1000 } as ProofResult;
      expect(isProofExpired(proof)).toBe(true);
    });

    it('should return false for exact expiration time', () => {
      const proof = { expiresAt: mockNow } as ProofResult;
      expect(isProofExpired(proof)).toBe(false);
    });

    it('should work with SerializedProofResult', () => {
      const proof = { expiresAt: mockNow - 1000 } as SerializedProofResult;
      expect(isProofExpired(proof)).toBe(true);
    });
  });

  describe('getProofTimeRemaining', () => {
    it('should return positive time for non-expired proof', () => {
      const proof = { expiresAt: mockNow + 60000 } as ProofResult;
      expect(getProofTimeRemaining(proof)).toBe(60000);
    });

    it('should return 0 for expired proof', () => {
      const proof = { expiresAt: mockNow - 1000 } as ProofResult;
      expect(getProofTimeRemaining(proof)).toBe(0);
    });

    it('should return 0 for exactly expired proof', () => {
      const proof = { expiresAt: mockNow } as ProofResult;
      expect(getProofTimeRemaining(proof)).toBe(0);
    });
  });

  describe('validateProofNotExpired', () => {
    it('should not throw for non-expired proof', () => {
      const proof = { expiresAt: mockNow + 60000 } as ProofResult;
      expect(() => validateProofNotExpired(proof)).not.toThrow();
    });

    it('should throw VouchError for expired proof', () => {
      const proof = { expiresAt: mockNow - 5000 } as ProofResult;
      expect(() => validateProofNotExpired(proof)).toThrow(VouchError);
    });

    it('should include expiration time in error message', () => {
      const proof = { expiresAt: mockNow - 5000 } as ProofResult;
      try {
        validateProofNotExpired(proof);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(VouchError);
        expect((error as VouchError).code).toBe(VouchErrorCode.PROOF_EXPIRED);
        expect((error as VouchError).message).toContain('5 seconds ago');
      }
    });
  });

  describe('calculateProofExpiration', () => {
    it('should calculate expiration with default TTL', () => {
      const result = calculateProofExpiration();
      expect(result.generatedAt).toBe(mockNow);
      expect(result.expiresAt).toBe(mockNow + SECURITY_CONSTANTS.DEFAULT_PROOF_TTL_MS);
    });

    it('should calculate expiration with custom TTL', () => {
      const ttl = 10 * 60 * 1000; // 10 minutes
      const result = calculateProofExpiration(ttl);
      expect(result.generatedAt).toBe(mockNow);
      expect(result.expiresAt).toBe(mockNow + ttl);
    });

    it('should clamp TTL to minimum', () => {
      const result = calculateProofExpiration(1000); // 1 second (below minimum)
      expect(result.expiresAt).toBe(mockNow + SECURITY_CONSTANTS.MIN_PROOF_TTL_MS);
    });

    it('should clamp TTL to maximum', () => {
      const result = calculateProofExpiration(60 * 60 * 1000); // 1 hour (above maximum)
      expect(result.expiresAt).toBe(mockNow + SECURITY_CONSTANTS.MAX_PROOF_TTL_MS);
    });
  });

  // === Input Validation Tests ===

  describe('validateProofSize', () => {
    it('should not throw for valid proof size', () => {
      const proof = new Uint8Array(1024);
      expect(() => validateProofSize(proof)).not.toThrow();
    });

    it('should throw for proof exceeding max size', () => {
      const proof = new Uint8Array(SECURITY_CONSTANTS.MAX_PROOF_SIZE_BYTES + 1);
      expect(() => validateProofSize(proof)).toThrow(VouchError);
    });

    it('should include sizes in error message', () => {
      const size = SECURITY_CONSTANTS.MAX_PROOF_SIZE_BYTES + 100;
      const proof = new Uint8Array(size);
      try {
        validateProofSize(proof);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(VouchError);
        expect((error as VouchError).code).toBe(VouchErrorCode.PROOF_TOO_LARGE);
        expect((error as VouchError).message).toContain(size.toString());
      }
    });

    it('should accept exactly max size proof', () => {
      const proof = new Uint8Array(SECURITY_CONSTANTS.MAX_PROOF_SIZE_BYTES);
      expect(() => validateProofSize(proof)).not.toThrow();
    });

    it('should accept empty proof', () => {
      const proof = new Uint8Array(0);
      expect(() => validateProofSize(proof)).not.toThrow();
    });
  });

  describe('validatePublicInputsSize', () => {
    it('should not throw for valid public inputs', () => {
      const inputs = ['abc', 'def', 'ghi'];
      expect(() => validatePublicInputsSize(inputs)).not.toThrow();
    });

    it('should throw for oversized public inputs', () => {
      const largeInput = 'a'.repeat(SECURITY_CONSTANTS.MAX_PUBLIC_INPUTS_SIZE_BYTES + 1);
      expect(() => validatePublicInputsSize([largeInput])).toThrow(VouchError);
    });

    it('should sum all input sizes', () => {
      const halfMax = Math.floor(SECURITY_CONSTANTS.MAX_PUBLIC_INPUTS_SIZE_BYTES / 2);
      const input1 = 'a'.repeat(halfMax);
      const input2 = 'b'.repeat(halfMax);
      const input3 = 'c'.repeat(10); // Push over the limit
      expect(() => validatePublicInputsSize([input1, input2, input3])).toThrow(VouchError);
    });

    it('should accept empty array', () => {
      expect(() => validatePublicInputsSize([])).not.toThrow();
    });
  });

  // === String Validation Tests ===

  describe('isValidHexString', () => {
    it('should return true for valid hex string', () => {
      expect(isValidHexString('deadbeef')).toBe(true);
      expect(isValidHexString('DEADBEEF')).toBe(true);
      expect(isValidHexString('0123456789abcdef')).toBe(true);
    });

    it('should return true for hex string with 0x prefix', () => {
      expect(isValidHexString('0xdeadbeef')).toBe(true);
      expect(isValidHexString('0x1234')).toBe(true);
    });

    it('should return false for odd-length hex string', () => {
      expect(isValidHexString('abc')).toBe(false);
      expect(isValidHexString('12345')).toBe(false);
    });

    it('should return false for non-hex characters', () => {
      expect(isValidHexString('ghij')).toBe(false);
      expect(isValidHexString('hello')).toBe(false);
    });

    it('should return false for non-string input', () => {
      expect(isValidHexString(123 as unknown as string)).toBe(false);
      expect(isValidHexString(null as unknown as string)).toBe(false);
      expect(isValidHexString(undefined as unknown as string)).toBe(false);
    });

    it('should return true for empty string', () => {
      expect(isValidHexString('')).toBe(true);
    });
  });

  describe('isValidBase58String', () => {
    it('should return true for valid base58 string', () => {
      expect(isValidBase58String('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')).toBe(true);
    });

    it('should return false for invalid base58 characters', () => {
      expect(isValidBase58String('0OIl')).toBe(false); // Contains invalid chars
      expect(isValidBase58String('hello0')).toBe(false); // Contains 0
      expect(isValidBase58String('helloO')).toBe(false); // Contains O
      expect(isValidBase58String('helloI')).toBe(false); // Contains I
      expect(isValidBase58String('hellol')).toBe(false); // Contains l
    });

    it('should return false for non-string input', () => {
      expect(isValidBase58String(123 as unknown as string)).toBe(false);
      expect(isValidBase58String(null as unknown as string)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should escape HTML special characters', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    it('should escape single quotes', () => {
      expect(sanitizeString("onclick='alert(1)'")).toBe('onclick=&#x27;alert(1)&#x27;');
    });

    it('should escape backticks', () => {
      expect(sanitizeString('`template`')).toBe('&#x60;template&#x60;');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeString(123 as unknown as string)).toBe('');
      expect(sanitizeString(null as unknown as string)).toBe('');
    });

    it('should not modify safe strings', () => {
      expect(sanitizeString('hello world')).toBe('hello world');
      expect(sanitizeString('abc123')).toBe('abc123');
    });
  });

  // === Solana Address Validation ===

  describe('isValidSolanaAddress', () => {
    it('should return true for valid Solana addresses', () => {
      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true);
      expect(isValidSolanaAddress('So11111111111111111111111111111111111111112')).toBe(true);
    });

    it('should return false for too short addresses', () => {
      expect(isValidSolanaAddress('1234567890123456789012345678901')).toBe(false); // 31 chars
    });

    it('should return false for too long addresses', () => {
      expect(isValidSolanaAddress('123456789012345678901234567890123456789012345')).toBe(false); // 45 chars
    });

    it('should return false for addresses with invalid characters', () => {
      expect(isValidSolanaAddress('1111111111111111111111111111111O')).toBe(false); // Contains O
      expect(isValidSolanaAddress('11111111111111111111111111111110')).toBe(false); // Contains 0
    });
  });

  describe('validateSolanaAddress', () => {
    it('should not throw for valid address', () => {
      expect(() => validateSolanaAddress('11111111111111111111111111111111')).not.toThrow();
    });

    it('should throw VouchError for invalid address', () => {
      expect(() => validateSolanaAddress('invalid')).toThrow(VouchError);
    });

    it('should have correct error code', () => {
      try {
        validateSolanaAddress('invalid');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as VouchError).code).toBe(VouchErrorCode.INVALID_PROOF_FORMAT);
      }
    });
  });

  // === Comprehensive Proof Validation ===

  describe('validateProof', () => {
    const createValidProof = (): ProofResult => ({
      proof: new Uint8Array(1024),
      publicInputs: ['input1', 'input2'],
      nullifier: 'deadbeef',
      commitment: 'cafebabe',
      epoch: '20000',
      dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      generatedAt: mockNow,
      expiresAt: mockNow + 300000,
    });

    it('should not throw for valid proof', () => {
      const proof = createValidProof();
      expect(() => validateProof(proof)).not.toThrow();
    });

    it('should throw for oversized proof', () => {
      const proof = createValidProof();
      proof.proof = new Uint8Array(SECURITY_CONSTANTS.MAX_PROOF_SIZE_BYTES + 1);
      expect(() => validateProof(proof)).toThrow(VouchError);
    });

    it('should throw for expired proof', () => {
      const proof = createValidProof();
      proof.expiresAt = mockNow - 1000;
      expect(() => validateProof(proof)).toThrow(VouchError);
    });

    it('should throw for invalid nullifier format', () => {
      const proof = createValidProof();
      proof.nullifier = 'not-valid-hex!';
      expect(() => validateProof(proof)).toThrow(VouchError);
    });

    it('should throw for invalid commitment format', () => {
      const proof = createValidProof();
      proof.commitment = 'invalid';
      expect(() => validateProof(proof)).toThrow(VouchError);
    });
  });

  describe('validateSerializedProof', () => {
    const createValidSerializedProof = (): SerializedProofResult => ({
      proof: 'deadbeef'.repeat(128), // 1024 hex chars = 512 bytes
      publicInputs: ['input1', 'input2'],
      nullifier: 'deadbeef',
      commitment: 'cafebabe',
      epoch: '20000',
      dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      generatedAt: mockNow,
      expiresAt: mockNow + 300000,
    });

    it('should not throw for valid serialized proof', () => {
      const proof = createValidSerializedProof();
      expect(() => validateSerializedProof(proof)).not.toThrow();
    });

    it('should throw for invalid hex proof', () => {
      const proof = createValidSerializedProof();
      proof.proof = 'not-valid-hex!';
      expect(() => validateSerializedProof(proof)).toThrow(VouchError);
    });

    it('should throw for oversized proof (hex string)', () => {
      const proof = createValidSerializedProof();
      // Hex string is 2x the byte size, so we need 2 * (max + 1) chars
      proof.proof = 'ab'.repeat(SECURITY_CONSTANTS.MAX_PROOF_SIZE_BYTES + 1);
      expect(() => validateSerializedProof(proof)).toThrow(VouchError);
    });

    it('should throw for expired proof', () => {
      const proof = createValidSerializedProof();
      proof.expiresAt = mockNow - 1000;
      expect(() => validateSerializedProof(proof)).toThrow(VouchError);
    });
  });

  // === Rate Limit Formatting ===

  describe('formatRateLimitTime', () => {
    it('should format seconds correctly', () => {
      expect(formatRateLimitTime(1000)).toBe('1 second');
      expect(formatRateLimitTime(5000)).toBe('5 seconds');
      expect(formatRateLimitTime(59000)).toBe('59 seconds');
    });

    it('should format minutes correctly', () => {
      expect(formatRateLimitTime(60000)).toBe('1 minute');
      expect(formatRateLimitTime(120000)).toBe('2 minutes');
      expect(formatRateLimitTime(300000)).toBe('5 minutes');
    });

    it('should round up to next second/minute', () => {
      expect(formatRateLimitTime(1500)).toBe('2 seconds');
      expect(formatRateLimitTime(65000)).toBe('2 minutes');
    });

    it('should handle edge cases', () => {
      expect(formatRateLimitTime(0)).toBe('0 seconds');
      expect(formatRateLimitTime(500)).toBe('1 second');
    });
  });
});
