/**
 * Vouch Protocol - ZK Proof Verification (Serverless)
 *
 * Uses Barretenberg (UltraHonk) to verify Noir proofs in Next.js API routes.
 * Adapted for serverless environment - loads circuits via fetch.
 */

import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import type { CompiledCircuit } from '@noir-lang/types';
import type { ProofType, VerificationResult } from './types';

// Cache backends to avoid reinitialization (persists across warm invocations)
const apiCache = new Map<ProofType, Barretenberg>();
const backendCache = new Map<ProofType, UltraHonkBackend>();
const noirCache = new Map<ProofType, Noir>();

// Circuit status tracking
const circuitStatus = {
  developer: false,
  whale: false,
};

/**
 * Get the base URL for loading circuits
 */
function getBaseUrl(): string {
  // In serverless, we need the full URL
  const vercelUrl = process.env.VERCEL_URL;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (baseUrl) {
    return baseUrl;
  }

  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  // Local development
  return 'http://localhost:3000';
}

/**
 * Load a compiled circuit from the public directory
 */
async function loadCircuitArtifact(proofType: ProofType): Promise<CompiledCircuit> {
  const circuitName = proofType === 'developer' ? 'dev_reputation' : 'whale_trading';
  const baseUrl = getBaseUrl();
  const circuitUrl = `${baseUrl}/circuits/${circuitName}.json`;

  console.log(`[Verifier] Loading circuit from: ${circuitUrl}`);

  const response = await fetch(circuitUrl);

  if (!response.ok) {
    throw new Error(`Failed to load circuit: ${response.status} ${response.statusText}`);
  }

  const circuit = await response.json() as CompiledCircuit;
  return circuit;
}

/**
 * Get or create a backend for a proof type
 */
async function getBackend(proofType: ProofType): Promise<{ noir: Noir; backend: UltraHonkBackend }> {
  // Check cache (persists across warm invocations)
  const cachedBackend = backendCache.get(proofType);
  const cachedNoir = noirCache.get(proofType);

  if (cachedBackend && cachedNoir) {
    console.log(`[Verifier] Using cached ${proofType} backend`);
    return { noir: cachedNoir, backend: cachedBackend };
  }

  // Load circuit
  console.log(`[Verifier] Loading ${proofType} circuit...`);
  const circuit = await loadCircuitArtifact(proofType);

  // Initialize Barretenberg API first
  const api = await Barretenberg.new({ threads: 1 });

  // Initialize Noir and backend
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, api);

  // Cache for reuse
  apiCache.set(proofType, api);
  noirCache.set(proofType, noir);
  backendCache.set(proofType, backend);
  circuitStatus[proofType] = true;

  console.log(`[Verifier] ${proofType} circuit loaded successfully`);
  return { noir, backend };
}

/**
 * Verify a ZK proof using Barretenberg UltraHonk
 *
 * @param proofHex - The proof as a hex string
 * @param publicInputsHex - Array of public inputs as hex strings
 * @param proofType - Type of proof (developer or whale)
 * @param nullifier - Nullifier hash (for result)
 * @param commitment - Commitment hash (for result)
 * @returns Verification result
 */
export async function verifyProof(
  proofHex: string,
  publicInputsHex: string[],
  proofType: ProofType,
  nullifier: string,
  commitment: string
): Promise<VerificationResult> {
  try {
    // Get backend
    const { backend } = await getBackend(proofType);

    // Convert hex proof to Uint8Array
    const proofBytes = hexToBytes(proofHex);

    // Verify the proof
    console.log(`[Verifier] Verifying ${proofType} proof (${proofBytes.length} bytes)...`);

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
      verifiedAt: Date.now(),
    };
  }
}

/**
 * Get circuit loading status
 */
export function getCircuitStatus(): { developer: boolean; whale: boolean } {
  return { ...circuitStatus };
}

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
