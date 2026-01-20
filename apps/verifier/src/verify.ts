/**
 * Vouch Protocol - ZK Proof Verification
 *
 * Uses Barretenberg (UltraHonk) to verify Noir proofs server-side.
 * This provides cryptographic verification that was previously a placeholder.
 */

import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import type { CompiledCircuit } from '@noir-lang/types';
import * as fs from 'fs';
import * as path from 'path';
import type { ProofType, VerificationResult } from './types.js';

// === Constants ===

const CIRCUITS_DIR = process.env.CIRCUITS_DIR || path.join(__dirname, '../../web/public/circuits');

// Shared Barretenberg API (expensive WASM initialization - do once)
let sharedApi: Barretenberg | null = null;
let sharedApiPromise: Promise<Barretenberg> | null = null;

// Cache backends to avoid reinitialization
const backendCache = new Map<ProofType, UltraHonkBackend>();
const noirCache = new Map<ProofType, Noir>();

// === Shared API ===

/**
 * Get or create the shared Barretenberg API instance
 */
async function getSharedApi(): Promise<Barretenberg> {
  if (sharedApi) {
    return sharedApi;
  }

  if (sharedApiPromise) {
    return sharedApiPromise;
  }

  console.log('[Verifier] Initializing Barretenberg API...');
  sharedApiPromise = Barretenberg.new({ threads: 1 });

  try {
    sharedApi = await sharedApiPromise;
    console.log('[Verifier] Barretenberg API initialized');
    return sharedApi;
  } catch (error) {
    sharedApiPromise = null;
    throw error;
  }
}

// === Circuit Loading ===

/**
 * Load a compiled circuit from the circuits directory
 */
async function loadCircuitArtifact(proofType: ProofType): Promise<CompiledCircuit> {
  const circuitPath = path.join(CIRCUITS_DIR, `${proofType === 'developer' ? 'dev_reputation' : 'whale_trading'}.json`);

  if (!fs.existsSync(circuitPath)) {
    throw new Error(`Circuit not found: ${circuitPath}`);
  }

  const circuitJson = fs.readFileSync(circuitPath, 'utf-8');
  return JSON.parse(circuitJson) as CompiledCircuit;
}

/**
 * Get or create a backend for a proof type
 */
async function getBackend(proofType: ProofType): Promise<{ noir: Noir; backend: UltraHonkBackend }> {
  // Check cache
  const cachedBackend = backendCache.get(proofType);
  const cachedNoir = noirCache.get(proofType);

  if (cachedBackend && cachedNoir) {
    return { noir: cachedNoir, backend: cachedBackend };
  }

  // Load circuit
  console.log(`[Verifier] Loading ${proofType} circuit...`);
  const circuit = await loadCircuitArtifact(proofType);

  // Get shared Barretenberg API
  const api = await getSharedApi();

  // Initialize Noir and backend
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, api);

  // Cache for reuse
  noirCache.set(proofType, noir);
  backendCache.set(proofType, backend);

  console.log(`[Verifier] ${proofType} circuit loaded successfully`);
  return { noir, backend };
}

// === Proof Verification ===

/**
 * Verify a ZK proof using Barretenberg UltraHonk
 *
 * @param proofHex - The proof as a hex string
 * @param publicInputsHex - Array of public inputs as hex strings
 * @param proofType - Type of proof (developer or whale)
 * @param nullifier - Nullifier hash (for result)
 * @param commitment - Commitment hash (for result)
 * @param epoch - Epoch number for temporal binding (prevents replay attacks)
 * @param dataHash - Hash of private data (ensures data integrity)
 * @returns Verification result
 */
export async function verifyProof(
  proofHex: string,
  publicInputsHex: string[],
  proofType: ProofType,
  nullifier: string,
  commitment: string,
  epoch: string,
  dataHash: string
): Promise<VerificationResult> {
  try {
    // Get backend
    const { backend } = await getBackend(proofType);

    // Convert hex proof to Uint8Array
    const proofBytes = hexToBytes(proofHex);

    // Verify the proof
    console.log(`[Verifier] Verifying ${proofType} proof (${proofBytes.length} bytes)...`);
    console.log(`[Verifier] Epoch: ${epoch}`);

    const isValid = await backend.verifyProof({
      proof: proofBytes,
      publicInputs: publicInputsHex,
    });

    console.log(`[Verifier] Proof verification result: ${isValid ? 'VALID' : 'INVALID'}`);

    return {
      isValid,
      proofType,
      nullifier,
      commitment,
      epoch,
      dataHash,
      verifiedAt: Date.now(),
    };
  } catch (error) {
    console.error('[Verifier] Verification error:', error);

    // Return invalid result on error
    return {
      isValid: false,
      proofType,
      nullifier,
      commitment,
      epoch,
      dataHash,
      verifiedAt: Date.now(),
    };
  }
}

/**
 * Preload all circuits at startup
 */
export async function preloadCircuits(): Promise<void> {
  console.log('[Verifier] Preloading circuits...');

  try {
    await getBackend('developer');
    console.log('[Verifier] Developer circuit loaded');
  } catch (error) {
    console.error('[Verifier] Failed to load developer circuit:', error);
  }

  try {
    await getBackend('whale');
    console.log('[Verifier] Whale circuit loaded');
  } catch (error) {
    console.error('[Verifier] Failed to load whale circuit:', error);
  }
}

/**
 * Check if circuits are loaded
 */
export function getCircuitStatus(): { developer: boolean; whale: boolean } {
  return {
    developer: backendCache.has('developer'),
    whale: backendCache.has('whale'),
  };
}

/**
 * Clean up backends on shutdown
 */
export async function cleanup(): Promise<void> {
  console.log('[Verifier] Cleaning up...');

  // Clear caches
  backendCache.clear();
  noirCache.clear();

  // Destroy shared Barretenberg API
  if (sharedApi) {
    try {
      await sharedApi.destroy();
      console.log('[Verifier] Barretenberg API destroyed');
    } catch (error) {
      console.error('[Verifier] Error destroying Barretenberg API:', error);
    }
    sharedApi = null;
    sharedApiPromise = null;
  }
}

// === Utilities ===

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
