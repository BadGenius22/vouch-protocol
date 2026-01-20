/**
 * Vouch Protocol - Proof Utilities Tests
 * Tests for proof serialization and utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  serializeProofResult,
  deserializeProofResult,
  getProofSize,
} from '../lib/proof';
import { VouchError } from '../lib/types';
import type { ProofResult, SerializedProofResult } from '../lib/types';

describe('proof utilities', () => {
  let mockNow: number;

  beforeEach(() => {
    mockNow = 1704067200000;
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProofSize', () => {
    it('should return correct proof size', () => {
      const proof = new Uint8Array(1024);
      expect(getProofSize(proof)).toBe(1024);
    });

    it('should return 0 for empty proof', () => {
      const proof = new Uint8Array(0);
      expect(getProofSize(proof)).toBe(0);
    });

    it('should handle various sizes', () => {
      expect(getProofSize(new Uint8Array(100))).toBe(100);
      expect(getProofSize(new Uint8Array(4096))).toBe(4096);
      expect(getProofSize(new Uint8Array(1))).toBe(1);
    });
  });

  describe('serializeProofResult', () => {
    it('should serialize proof result correctly', () => {
      const proofResult: ProofResult = {
        proof: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
        publicInputs: ['input1', 'input2'],
        nullifier: 'nullifier123',
        commitment: 'commitment456',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };

      const serialized = serializeProofResult(proofResult);

      expect(serialized.proof).toBe('deadbeef');
      expect(serialized.publicInputs).toEqual(['input1', 'input2']);
      expect(serialized.nullifier).toBe('nullifier123');
      expect(serialized.commitment).toBe('commitment456');
      expect(serialized.generatedAt).toBe(mockNow);
      expect(serialized.expiresAt).toBe(mockNow + 300000);
    });

    it('should handle empty proof', () => {
      const proofResult: ProofResult = {
        proof: new Uint8Array(0),
        publicInputs: [],
        nullifier: '',
        commitment: '',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };

      const serialized = serializeProofResult(proofResult);

      expect(serialized.proof).toBe('');
      expect(serialized.publicInputs).toEqual([]);
    });

    it('should preserve byte order in hex conversion', () => {
      const proofResult: ProofResult = {
        proof: new Uint8Array([0x00, 0x01, 0x0f, 0x10, 0xff]),
        publicInputs: [],
        nullifier: '',
        commitment: '',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };

      const serialized = serializeProofResult(proofResult);

      expect(serialized.proof).toBe('00010f10ff');
    });

    it('should pad single digit hex values', () => {
      const proofResult: ProofResult = {
        proof: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
        publicInputs: [],
        nullifier: '',
        commitment: '',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };

      const serialized = serializeProofResult(proofResult);

      expect(serialized.proof).toBe('000102030405060708090a0b0c0d0e0f');
    });
  });

  describe('deserializeProofResult', () => {
    it('should deserialize proof result correctly', () => {
      const serialized: SerializedProofResult = {
        proof: 'deadbeef',
        publicInputs: ['input1', 'input2'],
        nullifier: 'nullifier123',
        commitment: 'commitment456',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };

      const result = deserializeProofResult(serialized);

      expect(result.proof).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
      expect(result.publicInputs).toEqual(['input1', 'input2']);
      expect(result.nullifier).toBe('nullifier123');
      expect(result.commitment).toBe('commitment456');
      expect(result.generatedAt).toBe(mockNow);
      expect(result.expiresAt).toBe(mockNow + 300000);
    });

    it('should throw for null input', () => {
      expect(() => deserializeProofResult(null as unknown as SerializedProofResult)).toThrow(VouchError);
    });

    it('should throw for undefined input', () => {
      expect(() => deserializeProofResult(undefined as unknown as SerializedProofResult)).toThrow(VouchError);
    });

    it('should throw for invalid proof field', () => {
      const invalid = {
        proof: 123, // Not a string
        publicInputs: [],
        nullifier: '',
        commitment: '',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };
      expect(() => deserializeProofResult(invalid as unknown as SerializedProofResult)).toThrow(VouchError);
    });

    it('should throw for non-hex proof string', () => {
      const invalid: SerializedProofResult = {
        proof: 'ghijkl', // Not valid hex
        publicInputs: [],
        nullifier: '',
        commitment: '',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };
      expect(() => deserializeProofResult(invalid)).toThrow(VouchError);
    });

    it('should throw for missing TTL fields', () => {
      const invalid = {
        proof: 'deadbeef',
        publicInputs: [],
        nullifier: '',
        commitment: '',
        // Missing generatedAt and expiresAt
      };
      expect(() => deserializeProofResult(invalid as unknown as SerializedProofResult)).toThrow(VouchError);
    });

    it('should handle empty proof', () => {
      const serialized: SerializedProofResult = {
        proof: '',
        publicInputs: [],
        nullifier: '',
        commitment: '',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };

      const result = deserializeProofResult(serialized);

      expect(result.proof).toEqual(new Uint8Array(0));
    });

    it('should preserve byte values through round-trip', () => {
      const originalProof = new Uint8Array([0, 127, 128, 255]);
      const proofResult: ProofResult = {
        proof: originalProof,
        publicInputs: ['test'],
        nullifier: 'abc',
        commitment: 'def',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };

      const serialized = serializeProofResult(proofResult);
      const deserialized = deserializeProofResult(serialized);

      expect(deserialized.proof).toEqual(originalProof);
    });
  });

  describe('serialization round-trip', () => {
    it('should maintain data integrity through serialize/deserialize cycle', () => {
      const original: ProofResult = {
        proof: new Uint8Array(Array.from({ length: 100 }, (_, i) => i)),
        publicInputs: ['input1', 'input2', 'input3'],
        nullifier: 'abcdef1234567890',
        commitment: 'fedcba0987654321',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };

      const serialized = serializeProofResult(original);
      const deserialized = deserializeProofResult(serialized);

      expect(deserialized.proof).toEqual(original.proof);
      expect(deserialized.publicInputs).toEqual(original.publicInputs);
      expect(deserialized.nullifier).toBe(original.nullifier);
      expect(deserialized.commitment).toBe(original.commitment);
      expect(deserialized.epoch).toBe(original.epoch);
      expect(deserialized.dataHash).toBe(original.dataHash);
      expect(deserialized.generatedAt).toBe(original.generatedAt);
      expect(deserialized.expiresAt).toBe(original.expiresAt);
    });

    it('should handle maximum size proof', () => {
      const largeProof = new Uint8Array(4096);
      for (let i = 0; i < largeProof.length; i++) {
        largeProof[i] = i % 256;
      }

      const original: ProofResult = {
        proof: largeProof,
        publicInputs: [],
        nullifier: '',
        commitment: '',
        epoch: '20000',
        dataHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        generatedAt: mockNow,
        expiresAt: mockNow + 300000,
      };

      const serialized = serializeProofResult(original);
      const deserialized = deserializeProofResult(serialized);

      expect(deserialized.proof).toEqual(original.proof);
      expect(deserialized.proof.length).toBe(4096);
    });
  });
});
