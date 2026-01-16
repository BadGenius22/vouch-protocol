/**
 * Vouch Protocol - Proof Generation Module
 *
 * Exports proof generation hooks and utilities with caching support.
 */

// Main hook for React components
export { useProofWorker, isWorkerSupported, generateProofWithWorker } from './use-proof-worker';
export type { UseProofWorkerOptions, UseProofWorkerResult } from './use-proof-worker';
