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
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import type { CompiledCircuit } from '@noir-lang/types';
import { CircuitType, VouchError, VouchErrorCode } from './types';

// === Debug Mode ===
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(...args: unknown[]): void {
  if (DEBUG) {
    console.log('[Vouch]', ...args);
  }
}

// === Constants ===

// Cache TTL in milliseconds (1 hour)
// Balances memory usage vs initialization cost
const CACHE_TTL = 60 * 60 * 1000;

// WASM initialization timeout (30 seconds)
// Prevents hanging indefinitely if WASM fails to load
const WASM_INIT_TIMEOUT = 30 * 1000;

// === Circuit Cache ===
// Cache loaded circuits to avoid reloading on every proof generation
// This is critical for performance as WASM initialization is expensive

interface CachedCircuit {
  circuit: CompiledCircuit;
  api: Barretenberg;
  backend: UltraHonkBackend;
  noir: Noir;
  loadedAt: number;
}

const circuitCache = new Map<CircuitType, CachedCircuit>();

// Track if we're currently loading to prevent race conditions
const loadingPromises = new Map<CircuitType, Promise<{ noir: Noir; backend: UltraHonkBackend }>>();

// === Shared Barretenberg API ===
// Single API instance shared across all circuits to avoid multiple WASM initializations
let sharedApi: Barretenberg | null = null;
let sharedApiPromise: Promise<Barretenberg> | null = null;

/**
 * Get or create the shared Barretenberg API instance
 * This is the expensive WASM initialization - we only want to do it once
 */
async function getSharedApi(): Promise<Barretenberg> {
  // Return existing API if available
  if (sharedApi) {
    return sharedApi;
  }

  // Return existing promise if initialization is in progress
  if (sharedApiPromise) {
    return sharedApiPromise;
  }

  // Start initialization
  debugLog('Initializing shared Barretenberg API...');

  const backendLogger = DEBUG
    ? (msg: string) => console.log('[bb.js]', msg)
    : undefined;

  sharedApiPromise = Barretenberg.new({
    threads: 1,
    logger: backendLogger,
  });

  try {
    sharedApi = await sharedApiPromise;
    debugLog('Shared Barretenberg API initialized');
    return sharedApi;
  } catch (error) {
    sharedApiPromise = null;
    throw error;
  }
}

// === Utilities ===

/**
 * Wrap a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message if timeout occurs
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new VouchError(errorMessage, VouchErrorCode.CIRCUIT_LOAD_FAILED));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

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
    debugLog(`Using cached ${circuitType} circuit`);
    return { noir: cached.noir, backend: cached.backend };
  }

  // Check if we're already loading this circuit (prevents race conditions)
  const existingPromise = loadingPromises.get(circuitType);
  if (existingPromise) {
    debugLog(`Waiting for existing ${circuitType} load...`);
    return existingPromise;
  }

  // Create loading promise for deduplication with timeout
  const loadPromise = withTimeout(
    doLoadCircuit(circuitType),
    WASM_INIT_TIMEOUT,
    `WASM initialization timed out after ${WASM_INIT_TIMEOUT / 1000}s`
  );
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
  debugLog(` Loading ${circuitType} circuit...`);

  try {
    // Check SharedArrayBuffer availability (required for WASM multithreading)
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    debugLog(` SharedArrayBuffer available: ${hasSharedArrayBuffer}`);

    if (!hasSharedArrayBuffer) {
      throw new VouchError(
        'SharedArrayBuffer not available. This is required for ZK proof generation. ' +
        'Please ensure you are using a modern browser and the site has proper COOP/COEP headers.',
        VouchErrorCode.CIRCUIT_LOAD_FAILED
      );
    }

    // Fetch compiled circuit from public directory
    const circuitUrl = `/circuits/${circuitType}.json`;
    debugLog(` Fetching circuit from: ${circuitUrl}`);

    let response: Response;
    try {
      response = await fetch(circuitUrl);
    } catch (fetchError) {
      // Network-level errors (CORS, offline, blocked, etc.)
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
      console.error('[Vouch] Circuit fetch network error:', fetchError);
      throw new VouchError(
        `Network error fetching circuit: ${errorMsg}. Check browser console for details.`,
        VouchErrorCode.CIRCUIT_LOAD_FAILED,
        fetchError
      );
    }

    if (!response.ok) {
      throw new VouchError(
        `Failed to fetch circuit: ${response.status} ${response.statusText}`,
        VouchErrorCode.CIRCUIT_LOAD_FAILED
      );
    }

    debugLog(` Circuit fetched successfully, parsing JSON...`);
    const circuit = (await response.json()) as CompiledCircuit;

    // Validate circuit structure
    if (!circuit.bytecode || !circuit.abi) {
      throw new VouchError(
        'Invalid circuit format: missing bytecode or abi',
        VouchErrorCode.CIRCUIT_LOAD_FAILED
      );
    }

    debugLog(` Circuit JSON valid, bytecode length: ${circuit.bytecode.length}`);
    debugLog(` Getting shared Barretenberg API...`);

    // Get or create the shared Barretenberg API (WASM is only loaded once)
    let api: Barretenberg;
    try {
      api = await getSharedApi();
    } catch (apiError) {
      const errorMsg = apiError instanceof Error ? apiError.message : 'Unknown API error';
      console.error('[Vouch] Barretenberg API initialization error:', apiError);
      throw new VouchError(
        `Failed to initialize Barretenberg WASM: ${errorMsg}`,
        VouchErrorCode.CIRCUIT_LOAD_FAILED,
        apiError
      );
    }

    debugLog(` Initializing UltraHonk backend...`);

    // Initialize UltraHonk backend from @aztec/bb.js
    const backend = new UltraHonkBackend(circuit.bytecode, api);

    // Initialize Noir (takes full circuit for ABI parsing)
    const noir = new Noir(circuit);

    // Note: We no longer destroy the API here because it's shared across circuits
    // The shared API is preserved to avoid costly re-initialization

    // Cache for reuse
    circuitCache.set(circuitType, {
      circuit,
      api,
      backend,
      noir,
      loadedAt: Date.now(),
    });

    debugLog(` ${circuitType} circuit loaded successfully`);
    return { noir, backend };
  } catch (error) {
    // Re-throw VouchError as-is
    if (error instanceof VouchError) {
      throw error;
    }

    // Wrap other errors with more context
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[Vouch] Circuit load failed (${errorName}):`, error);

    throw new VouchError(
      `Failed to load circuit: ${errorMsg}`,
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
  debugLog('Preloading circuits...');

  const circuits: CircuitType[] = ['dev_reputation', 'whale_trading'];

  await Promise.all(
    circuits.map(async (circuitType) => {
      try {
        await loadCircuit(circuitType);
      } catch (error) {
        if (DEBUG) console.warn(`[Vouch] Failed to preload ${circuitType}:`, error);
        // Don't throw - preloading is best-effort
      }
    })
  );

  debugLog('Circuits preloaded');
}

/**
 * Clear the circuit cache
 * Useful for testing or when circuits are updated
 * Note: This does not destroy the shared Barretenberg API - use destroySharedApi() for that
 */
export async function clearCircuitCache(): Promise<void> {
  circuitCache.clear();
  debugLog('Circuit cache cleared');
}

/**
 * Destroy the shared Barretenberg API
 * Only call this when completely done with proof generation (e.g., unmounting app)
 */
export async function destroySharedApi(): Promise<void> {
  if (sharedApi) {
    try {
      await sharedApi.destroy();
    } catch {
      // Ignore destruction errors
    }
    sharedApi = null;
    sharedApiPromise = null;
    debugLog('Shared Barretenberg API destroyed');
  }
}

/**
 * Check if the shared Barretenberg API is initialized
 */
export function isSharedApiReady(): boolean {
  return sharedApi !== null;
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
