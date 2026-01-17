/**
 * Vouch Protocol - Privacy Utilities Tests
 * Tests for shared utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Privacy Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger with all methods', async () => {
      const { createLogger } = await import('../lib/privacy-utils');

      const logger = createLogger('TestPrefix');

      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('secureZero', () => {
    it('should zero out a Uint8Array', async () => {
      const { secureZero } = await import('../lib/privacy-utils');

      const buffer = new Uint8Array([1, 2, 3, 4, 5]);
      secureZero(buffer);

      expect(buffer.every(b => b === 0)).toBe(true);
    });

    it('should handle empty arrays', async () => {
      const { secureZero } = await import('../lib/privacy-utils');

      const buffer = new Uint8Array([]);
      expect(() => secureZero(buffer)).not.toThrow();
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const { withRetry } = await import('../lib/privacy-utils');

      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const { withRetry } = await import('../lib/privacy-utils');

      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const { withRetry } = await import('../lib/privacy-utils');

      const fn = vi.fn().mockRejectedValue(new Error('timeout'));

      await expect(
        withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })
      ).rejects.toThrow('timeout');

      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      const { withRetry } = await import('../lib/privacy-utils');

      const fn = vi.fn().mockRejectedValue(new Error('invalid input'));

      await expect(
        withRetry(fn, { maxRetries: 3, baseDelayMs: 10 })
      ).rejects.toThrow('invalid input');

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('sleep', () => {
    it('should resolve after delay', async () => {
      const { sleep } = await import('../lib/privacy-utils');

      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('should reject when aborted', async () => {
      const { sleep } = await import('../lib/privacy-utils');

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10);

      await expect(sleep(1000, controller.signal)).rejects.toThrow('aborted');
    });
  });

  describe('createTimeoutSignal', () => {
    it('should abort after timeout', async () => {
      const { createTimeoutSignal } = await import('../lib/privacy-utils');

      const signal = createTimeoutSignal(50);
      expect(signal.aborted).toBe(false);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(signal.aborted).toBe(true);
    });
  });

  describe('withTimeout', () => {
    it('should complete before timeout', async () => {
      const { withTimeout } = await import('../lib/privacy-utils');

      const result = await withTimeout(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'success';
        },
        1000
      );

      expect(result).toBe('success');
    });

    it('should throw on timeout', async () => {
      const { withTimeout } = await import('../lib/privacy-utils');

      await expect(
        withTimeout(
          async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return 'success';
          },
          50
        )
      ).rejects.toThrow('timed out');
    });
  });

  describe('isValidSolanaAddress', () => {
    it('should validate correct addresses', async () => {
      const { isValidSolanaAddress } = await import('../lib/privacy-utils');

      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true);
      expect(isValidSolanaAddress('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe(true);
    });

    it('should reject invalid addresses', async () => {
      const { isValidSolanaAddress } = await import('../lib/privacy-utils');

      expect(isValidSolanaAddress('')).toBe(false);
      expect(isValidSolanaAddress('short')).toBe(false);
      expect(isValidSolanaAddress('invalid-with-dashes')).toBe(false);
      expect(isValidSolanaAddress('0OIl')).toBe(false); // Invalid base58 chars
    });
  });

  describe('isValidAmount', () => {
    it('should validate positive amounts', async () => {
      const { isValidAmount } = await import('../lib/privacy-utils');

      expect(isValidAmount(0.001)).toBe(true);
      expect(isValidAmount(1)).toBe(true);
      expect(isValidAmount(100000)).toBe(true);
    });

    it('should reject invalid amounts', async () => {
      const { isValidAmount } = await import('../lib/privacy-utils');

      expect(isValidAmount(0)).toBe(false);
      expect(isValidAmount(-1)).toBe(false);
      expect(isValidAmount(NaN)).toBe(false);
      expect(isValidAmount(Infinity)).toBe(false);
      expect(isValidAmount(2000000)).toBe(false); // Exceeds max
    });
  });

  describe('assert', () => {
    it('should not throw for true conditions', async () => {
      const { assert } = await import('../lib/privacy-utils');

      expect(() => assert(true, 'Should not throw')).not.toThrow();
    });

    it('should throw for false conditions', async () => {
      const { assert } = await import('../lib/privacy-utils');

      expect(() => assert(false, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('createResettableSingleton', () => {
    it('should create and cache instance', async () => {
      const { createResettableSingleton } = await import('../lib/privacy-utils');

      let callCount = 0;
      const singleton = createResettableSingleton(() => {
        callCount++;
        return { value: callCount };
      });

      const first = await singleton.get();
      const second = await singleton.get();

      expect(first).toBe(second);
      expect(callCount).toBe(1);
    });

    it('should reset instance', async () => {
      const { createResettableSingleton } = await import('../lib/privacy-utils');

      let callCount = 0;
      const singleton = createResettableSingleton(() => {
        callCount++;
        return { value: callCount };
      });

      await singleton.get();
      await singleton.reset();
      await singleton.get();

      expect(callCount).toBe(2);
    });

    it('should track initialization state', async () => {
      const { createResettableSingleton } = await import('../lib/privacy-utils');

      const singleton = createResettableSingleton(() => ({ value: 1 }));

      expect(singleton.isInitialized()).toBe(false);
      await singleton.get();
      expect(singleton.isInitialized()).toBe(true);
      await singleton.reset();
      expect(singleton.isInitialized()).toBe(false);
    });
  });
});
