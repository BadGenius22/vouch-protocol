/**
 * Vouch Protocol - Circuit Loading and Management
 * Handles loading compiled Noir circuits and initializing the UltraHonk backend
 *
 * Best Practices:
 * - Circuits are cached for 1 hour to avoid repeated WASM initialization
 * - Backend instances are properly destroyed when cache expires
 * - All operations are async to avoid blocking the main thread
 * - Dynamic imports used for SSR compatibility in Next.js
 *
 * @see https://noir-lang.org/docs/tutorials/noirjs_app/
 * @see https://github.com/AztecProtocol/barretenberg/blob/master/ts/README.md
 */

import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import type { CompiledCircuit } from '@noir-lang/types';
import { CircuitType, VouchError, VouchErrorCode } from './types';

// === Circuit Cache ===
// Cache loaded circuits to avoid reloading on every proof generation
// This is critical for performance as WASM initialization is expensive

interface CachedCircuit {
  circuit: CompiledCircuit;
  backend: UltraHonkBackend;
  noir: Noir;
  loadedAt: number;
}

const circuitCache = new Map<CircuitType, CachedCircuit>();

// Cache TTL in milliseconds (1 hour)
// Balances memory usage vs initialization cost
const CACHE_TTL = 60 * 60 * 1000;

// Track if we're currently loading to prevent race conditions
const loadingPromises = new Map<CircuitType, Promise<{ noir: Noir; backend: UltraHonkBackend }>>();

// === Public API ===

/**
 * Load and initialize a Noir circuit with UltraHonk backend
 * Uses deduplication to prevent multiple concurrent loads of the same circuit
 *
 * @param circuitType - The type of circuit to load
 * @returns Initialized Noir instance and backend
 */
export async function loadCircuit(circuitType: CircuitType): Promise<{
  noir: Noir;
  backend: UltraHonkBackend;
}> {
  // Check cache first
  const cached = circuitCache.get(circuitType);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
    console.log(`[Vouch] Using cached ${circuitType} circuit`);
    return { noir: cached.noir, backend: cached.backend };
  }

  // Check if we're already loading this circuit (prevents race conditions)
  const existingPromise = loadingPromises.get(circuitType);
  if (existingPromise) {
    console.log(`[Vouch] Waiting for existing ${circuitType} load...`);
    return existingPromise;
  }

  // Create loading promise for deduplication
  const loadPromise = doLoadCircuit(circuitType);
  loadingPromises.set(circuitType, loadPromise);

  try {
    return await loadPromise;
  } finally {
    loadingPromises.delete(circuitType);
  }
}

/**
 * Internal function that performs the actual circuit loading
 */
async function doLoadCircuit(circuitType: CircuitType): Promise<{
  noir: Noir;
  backend: UltraHonkBackend;
}> {
  console.log(`[Vouch] Loading ${circuitType} circuit...`);

  try {
    // Fetch compiled circuit from public directory
    const circuitUrl = `/circuits/${circuitType}.json`;
    const response = await fetch(circuitUrl);

    if (!response.ok) {
      throw new VouchError(
        `Failed to fetch circuit: ${response.status} ${response.statusText}`,
        VouchErrorCode.CIRCUIT_LOAD_FAILED
      );
    }

    const circuit = (await response.json()) as CompiledCircuit;

    // Validate circuit structure
    if (!circuit.bytecode || !circuit.abi) {
      throw new VouchError(
        'Invalid circuit format: missing bytecode or abi',
        VouchErrorCode.CIRCUIT_LOAD_FAILED
      );
    }

    console.log(`[Vouch] Initializing UltraHonk backend...`);

    // Initialize UltraHonk backend from @aztec/bb.js (this loads WASM)
    // Uses SharedArrayBuffer for multithreading if COOP/COEP headers are set
    // UltraHonkBackend takes the bytecode directly, not the full circuit
    const backend = new UltraHonkBackend(circuit.bytecode);

    // Initialize Noir (takes full circuit for ABI parsing)
    const noir = new Noir(circuit);

    // Destroy old cached backend to free WASM memory
    const oldCached = circuitCache.get(circuitType);
    if (oldCached) {
      try {
        await oldCached.backend.destroy();
      } catch {
        // Ignore destruction errors
      }
    }

    // Cache for reuse
    circuitCache.set(circuitType, {
      circuit,
      backend,
      noir,
      loadedAt: Date.now(),
    });

    console.log(`[Vouch] ${circuitType} circuit loaded successfully`);
    return { noir, backend };
  } catch (error) {
    // Re-throw VouchError as-is
    if (error instanceof VouchError) {
      throw error;
    }

    // Wrap other errors
    throw new VouchError(
      `Failed to load circuit: ${error instanceof Error ? error.message : 'Unknown error'}`,
      VouchErrorCode.CIRCUIT_LOAD_FAILED,
      error
    );
  }
}

/**
 * Preload circuits to warm up the cache
 * Call this early in the app lifecycle for better UX
 */
export async function preloadCircuits(): Promise<void> {
  console.log('[Vouch] Preloading circuits...');

  const circuits: CircuitType[] = ['dev_reputation', 'whale_trading'];

  await Promise.all(
    circuits.map(async (circuitType) => {
      try {
        await loadCircuit(circuitType);
      } catch (error) {
        console.warn(`[Vouch] Failed to preload ${circuitType}:`, error);
        // Don't throw - preloading is best-effort
      }
    })
  );

  console.log('[Vouch] Circuits preloaded');
}

/**
 * Clear the circuit cache
 * Useful for testing or when circuits are updated
 */
export async function clearCircuitCache(): Promise<void> {
  // Properly destroy backends to free WASM resources
  const entries = Array.from(circuitCache.values());
  for (const cached of entries) {
    try {
      await cached.backend.destroy();
    } catch {
      // Ignore errors during cleanup
    }
  }
  circuitCache.clear();
  console.log('[Vouch] Circuit cache cleared');
}

/**
 * Check if a circuit is cached
 */
export function isCircuitCached(circuitType: CircuitType): boolean {
  const cached = circuitCache.get(circuitType);
  return cached !== undefined && Date.now() - cached.loadedAt < CACHE_TTL;
}

/**
 * Get circuit info for debugging
 */
export function getCircuitInfo(circuitType: CircuitType): {
  cached: boolean;
  loadedAt?: number;
  abi?: unknown;
} | null {
  const cached = circuitCache.get(circuitType);
  if (!cached) {
    return { cached: false };
  }

  return {
    cached: true,
    loadedAt: cached.loadedAt,
    abi: cached.circuit.abi,
  };
}
