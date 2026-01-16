/**
 * Vouch Protocol - Proof Caching
 *
 * Caches generated proofs in IndexedDB to avoid regenerating proofs
 * when users return to the page or refresh.
 *
 * Cache Key: hash(walletPubkey + proofType + threshold)
 * - Unique per wallet/proof type combination
 * - Invalidated when threshold changes
 *
 * Security:
 * - Proofs are stored locally only (never sent to server for caching)
 * - TTL ensures proofs don't become stale
 * - User can manually clear cache
 */

import type { ProofResult, SerializedProofResult } from './types';
import { serializeProofResult, deserializeProofResult } from './proof';

// === Constants ===

const DB_NAME = 'vouch-proof-cache';
const DB_VERSION = 1;
const STORE_NAME = 'proofs';

// Default cache TTL: 24 hours (proofs have their own TTL too)
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// === Types ===

interface CachedProof {
  key: string;
  proof: SerializedProofResult;
  cachedAt: number;
  proofType: 'developer' | 'whale';
  walletPrefix: string; // First 8 chars for debugging
}

// === IndexedDB Helpers ===

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Get or create the IndexedDB database
 */
function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open proof cache database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('proofType', 'proofType', { unique: false });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Generate a cache key for a proof
 */
async function generateCacheKey(
  walletPubkey: string,
  proofType: 'developer' | 'whale',
  threshold: number
): Promise<string> {
  const data = `${walletPubkey}:${proofType}:${threshold}`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  // Create a new ArrayBuffer to satisfy TypeScript's strict type checking
  const buffer = new ArrayBuffer(encoded.length);
  new Uint8Array(buffer).set(encoded);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// === Public API ===

/**
 * Get a cached proof if available and not expired
 */
export async function getCachedProof(
  walletPubkey: string,
  proofType: 'developer' | 'whale',
  threshold: number
): Promise<ProofResult | null> {
  try {
    const db = await getDatabase();
    const key = await generateCacheKey(walletPubkey, proofType, threshold);

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => resolve(null);

      request.onsuccess = () => {
        const cached = request.result as CachedProof | undefined;

        if (!cached) {
          resolve(null);
          return;
        }

        // Check cache TTL
        const now = Date.now();
        if (now - cached.cachedAt > DEFAULT_CACHE_TTL_MS) {
          // Cache expired, delete it
          deleteCachedProof(walletPubkey, proofType, threshold).catch(() => {});
          resolve(null);
          return;
        }

        // Check proof TTL
        if (cached.proof.expiresAt && now > cached.proof.expiresAt) {
          // Proof expired, delete it
          deleteCachedProof(walletPubkey, proofType, threshold).catch(() => {});
          resolve(null);
          return;
        }

        // Return deserialized proof
        try {
          const proofResult = deserializeProofResult(cached.proof);
          console.log('[Vouch] Using cached proof');
          resolve(proofResult);
        } catch {
          resolve(null);
        }
      };
    });
  } catch {
    return null;
  }
}

/**
 * Cache a generated proof
 */
export async function cacheProof(
  walletPubkey: string,
  proofType: 'developer' | 'whale',
  threshold: number,
  proofResult: ProofResult
): Promise<void> {
  try {
    const db = await getDatabase();
    const key = await generateCacheKey(walletPubkey, proofType, threshold);

    const cached: CachedProof = {
      key,
      proof: serializeProofResult(proofResult),
      cachedAt: Date.now(),
      proofType,
      walletPrefix: walletPubkey.slice(0, 8),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cached);

      request.onerror = () => reject(new Error('Failed to cache proof'));
      request.onsuccess = () => {
        console.log('[Vouch] Proof cached');
        resolve();
      };
    });
  } catch (error) {
    console.warn('[Vouch] Failed to cache proof:', error);
  }
}

/**
 * Delete a cached proof
 */
export async function deleteCachedProof(
  walletPubkey: string,
  proofType: 'developer' | 'whale',
  threshold: number
): Promise<void> {
  try {
    const db = await getDatabase();
    const key = await generateCacheKey(walletPubkey, proofType, threshold);

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(key);
      resolve();
    });
  } catch {
    // Ignore errors
  }
}

/**
 * Clear all cached proofs
 */
export async function clearProofCache(): Promise<void> {
  try {
    const db = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(new Error('Failed to clear proof cache'));
      request.onsuccess = () => {
        console.log('[Vouch] Proof cache cleared');
        resolve();
      };
    });
  } catch (error) {
    console.warn('[Vouch] Failed to clear proof cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  count: number;
  oldestAt: number | null;
  newestAt: number | null;
}> {
  try {
    const db = await getDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();
      const allRequest = store.getAll();

      let count = 0;
      let oldestAt: number | null = null;
      let newestAt: number | null = null;

      countRequest.onsuccess = () => {
        count = countRequest.result;
      };

      allRequest.onsuccess = () => {
        const items = allRequest.result as CachedProof[];
        if (items.length > 0) {
          const times = items.map((i) => i.cachedAt);
          oldestAt = Math.min(...times);
          newestAt = Math.max(...times);
        }
      };

      transaction.oncomplete = () => {
        resolve({ count, oldestAt, newestAt });
      };

      transaction.onerror = () => {
        resolve({ count: 0, oldestAt: null, newestAt: null });
      };
    });
  } catch {
    return { count: 0, oldestAt: null, newestAt: null };
  }
}

/**
 * Clean up expired proofs
 */
export async function cleanupExpiredProofs(): Promise<number> {
  try {
    const db = await getDatabase();
    const now = Date.now();

    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      let deletedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const cached = cursor.value as CachedProof;

          // Check if expired (cache TTL or proof TTL)
          const cacheExpired = now - cached.cachedAt > DEFAULT_CACHE_TTL_MS;
          const proofExpired = cached.proof.expiresAt && now > cached.proof.expiresAt;

          if (cacheExpired || proofExpired) {
            cursor.delete();
            deletedCount++;
          }

          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        if (deletedCount > 0) {
          console.log(`[Vouch] Cleaned up ${deletedCount} expired proofs`);
        }
        resolve(deletedCount);
      };

      transaction.onerror = () => {
        resolve(0);
      };
    });
  } catch {
    return 0;
  }
}
