/**
 * Vouch Protocol - Proof Generation Web Worker
 *
 * Offloads heavy ZK proof generation to a separate thread to avoid blocking the UI.
 * This significantly improves user experience during proof generation.
 *
 * Benefits:
 * - UI remains responsive during proof generation
 * - Progress updates can be sent to main thread
 * - Errors are properly propagated
 */

import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import type { CompiledCircuit } from '@noir-lang/types';
import type { InputMap } from '@noir-lang/noirc_abi';

// === Types ===

export type WorkerMessageType =
  | 'generate'
  | 'progress'
  | 'success'
  | 'error'
  | 'ready';

export interface WorkerMessage {
  type: WorkerMessageType;
  payload?: unknown;
}

export interface GeneratePayload {
  circuitType: 'dev_reputation' | 'whale_trading';
  circuitInputs: InputMap;
  baseUrl: string; // Base URL for fetching circuits
}

export interface ProgressPayload {
  progress: number;
  message: string;
}

export interface SuccessPayload {
  proof: number[]; // Uint8Array serialized as number[]
  publicInputs: string[];
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

// === Worker State ===

const circuitCache = new Map<string, { noir: Noir; backend: UltraHonkBackend; api: Barretenberg }>();

// === Helper Functions ===

function postProgress(progress: number, message: string) {
  self.postMessage({
    type: 'progress',
    payload: { progress, message } as ProgressPayload,
  });
}

async function loadCircuit(circuitType: string, baseUrl: string): Promise<{ noir: Noir; backend: UltraHonkBackend }> {
  // Check cache
  const cached = circuitCache.get(circuitType);
  if (cached) {
    return { noir: cached.noir, backend: cached.backend };
  }

  postProgress(10, 'Loading circuit...');

  // Use base URL passed from main thread
  const circuitUrl = `${baseUrl}/circuits/${circuitType}.json`;

  let circuit: CompiledCircuit;
  try {
    const response = await fetch(circuitUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    circuit = (await response.json()) as CompiledCircuit;
  } catch (err) {
    throw new Error(`Failed to fetch circuit from ${circuitUrl}: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  postProgress(20, 'Initializing WASM backend...');

  // Initialize Barretenberg API first, then backend and noir
  let api: Barretenberg;
  let backend: UltraHonkBackend;
  let noir: Noir;
  try {
    api = await Barretenberg.new({ threads: 1 });
    backend = new UltraHonkBackend(circuit.bytecode, api);
    noir = new Noir(circuit);
  } catch (err) {
    throw new Error(`Failed to initialize WASM backend: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Cache for reuse
  circuitCache.set(circuitType, { noir, backend, api });

  return { noir, backend };
}

// === Main Worker Logic ===

async function generateProof(payload: GeneratePayload): Promise<SuccessPayload> {
  const { circuitType, circuitInputs, baseUrl } = payload;

  // Load circuit
  const { noir, backend } = await loadCircuit(circuitType, baseUrl);

  // Execute circuit
  postProgress(40, 'Executing circuit...');
  let witness;
  try {
    const result = await noir.execute(circuitInputs);
    witness = result.witness;
  } catch (err) {
    throw new Error(`Circuit execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Generate proof
  postProgress(60, 'Generating ZK proof...');
  let proofData;
  try {
    proofData = await backend.generateProof(witness);
  } catch (err) {
    throw new Error(`Proof generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  postProgress(100, 'Proof generated!');

  return {
    proof: Array.from(proofData.proof),
    publicInputs: proofData.publicInputs,
  };
}

// === Message Handler ===

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'generate':
      try {
        const result = await generateProof(payload as GeneratePayload);
        self.postMessage({ type: 'success', payload: result });
      } catch (error) {
        const errorPayload: ErrorPayload = {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'PROOF_GENERATION_FAILED',
        };
        self.postMessage({ type: 'error', payload: errorPayload });
      }
      break;

    default:
      self.postMessage({
        type: 'error',
        payload: { message: `Unknown message type: ${type}` },
      });
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
