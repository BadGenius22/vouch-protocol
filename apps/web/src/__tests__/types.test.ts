/**
 * Vouch Protocol - Types Tests
 * Tests for error handling and constants
 */

import { describe, it, expect } from 'vitest';
import {
  VouchError,
  VouchErrorCode,
  CIRCUIT_CONSTANTS,
  SECURITY_CONSTANTS,
} from '../lib/types';

describe('VouchError', () => {
  it('should create error with message and code', () => {
    const error = new VouchError('Test error', VouchErrorCode.PROOF_GENERATION_FAILED);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(VouchError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(VouchErrorCode.PROOF_GENERATION_FAILED);
    expect(error.name).toBe('VouchError');
  });

  it('should include cause when provided', () => {
    const cause = new Error('Original error');
    const error = new VouchError('Wrapped error', VouchErrorCode.NETWORK_ERROR, cause);

    expect(error.cause).toBe(cause);
  });

  it('should work without cause', () => {
    const error = new VouchError('Simple error', VouchErrorCode.WALLET_NOT_CONNECTED);

    expect(error.cause).toBeUndefined();
  });

  it('should be throwable and catchable', () => {
    expect(() => {
      throw new VouchError('Thrown error', VouchErrorCode.CIRCUIT_LOAD_FAILED);
    }).toThrow(VouchError);
  });

  it('should preserve stack trace', () => {
    const error = new VouchError('Stack trace test', VouchErrorCode.VERIFICATION_FAILED);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('VouchError');
  });
});

describe('VouchErrorCode', () => {
  it('should have all expected error codes', () => {
    expect(VouchErrorCode.CIRCUIT_LOAD_FAILED).toBeDefined();
    expect(VouchErrorCode.PROOF_GENERATION_FAILED).toBeDefined();
    expect(VouchErrorCode.VERIFICATION_FAILED).toBeDefined();
    expect(VouchErrorCode.WALLET_NOT_CONNECTED).toBeDefined();
    expect(VouchErrorCode.INSUFFICIENT_DATA).toBeDefined();
    expect(VouchErrorCode.THRESHOLD_NOT_MET).toBeDefined();
    expect(VouchErrorCode.NETWORK_ERROR).toBeDefined();
    expect(VouchErrorCode.TRANSACTION_FAILED).toBeDefined();
    expect(VouchErrorCode.PROOF_EXPIRED).toBeDefined();
    expect(VouchErrorCode.PROOF_TOO_LARGE).toBeDefined();
    expect(VouchErrorCode.INVALID_PROOF_FORMAT).toBeDefined();
  });

  it('should have unique values', () => {
    const codes = Object.values(VouchErrorCode);
    const uniqueCodes = new Set(codes);
    expect(codes.length).toBe(uniqueCodes.size);
  });
});

describe('CIRCUIT_CONSTANTS', () => {
  it('should have correct max programs', () => {
    expect(CIRCUIT_CONSTANTS.MAX_PROGRAMS).toBe(5);
    expect(typeof CIRCUIT_CONSTANTS.MAX_PROGRAMS).toBe('number');
  });

  it('should have correct max trades', () => {
    expect(CIRCUIT_CONSTANTS.MAX_TRADES).toBe(20);
    expect(typeof CIRCUIT_CONSTANTS.MAX_TRADES).toBe('number');
  });

  it('should have domain separators', () => {
    expect(CIRCUIT_CONSTANTS.DOMAIN_SEPARATOR_DEV).toBe('vouch_dev');
    expect(CIRCUIT_CONSTANTS.DOMAIN_SEPARATOR_WHALE).toBe('vouch_whale');
  });
});

describe('SECURITY_CONSTANTS', () => {
  it('should have default proof TTL', () => {
    expect(SECURITY_CONSTANTS.DEFAULT_PROOF_TTL_MS).toBe(5 * 60 * 1000); // 5 minutes
  });

  it('should have max proof TTL', () => {
    expect(SECURITY_CONSTANTS.MAX_PROOF_TTL_MS).toBe(30 * 60 * 1000); // 30 minutes
  });

  it('should have min proof TTL', () => {
    expect(SECURITY_CONSTANTS.MIN_PROOF_TTL_MS).toBe(60 * 1000); // 1 minute
  });

  it('should have max proof size', () => {
    expect(SECURITY_CONSTANTS.MAX_PROOF_SIZE_BYTES).toBe(4096);
  });

  it('should have max public inputs size', () => {
    expect(SECURITY_CONSTANTS.MAX_PUBLIC_INPUTS_SIZE_BYTES).toBe(1024);
  });

  it('should enforce TTL ordering', () => {
    expect(SECURITY_CONSTANTS.MIN_PROOF_TTL_MS).toBeLessThan(SECURITY_CONSTANTS.DEFAULT_PROOF_TTL_MS);
    expect(SECURITY_CONSTANTS.DEFAULT_PROOF_TTL_MS).toBeLessThan(SECURITY_CONSTANTS.MAX_PROOF_TTL_MS);
  });
});
