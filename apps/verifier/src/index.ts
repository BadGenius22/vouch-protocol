/**
 * Vouch Protocol - ZK Verification Service
 *
 * Express server that verifies Noir/UltraHonk proofs and returns signed attestations.
 * These attestations can be submitted to the Solana program for on-chain recording.
 *
 * Endpoints:
 * - POST /verify - Verify a proof and get signed attestation
 * - GET /health - Health check and circuit status
 * - GET /verifier - Get verifier public key
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { verifyProof, preloadCircuits, getCircuitStatus, cleanup } from './verify.js';
import { signAttestation, initializeVerifier, getVerifierPublicKey } from './sign.js';
import { verifyRequestSchema } from './types.js';
import type { VerifyResponse, HealthResponse } from './types.js';

// === Configuration ===

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const VERSION = '0.1.0';

// === Express App ===

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' })); // Proofs can be large
app.use(cors({
  origin: CORS_ORIGIN.split(','),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// === Endpoints ===

/**
 * POST /verify
 * Verify a ZK proof and return a signed attestation
 */
app.post('/verify', async (req, res) => {
  try {
    // Validate request body
    const parseResult = verifyRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const response: VerifyResponse = {
        success: false,
        error: `Invalid request: ${parseResult.error.issues.map(i => i.message).join(', ')}`,
      };
      return res.status(400).json(response);
    }

    const { proof, publicInputs, proofType, nullifier, commitment } = parseResult.data;

    console.log(`[Verifier] Verifying ${proofType} proof...`);
    console.log(`[Verifier] Nullifier: ${nullifier.slice(0, 16)}...`);
    console.log(`[Verifier] Proof size: ${proof.length} chars`);

    // Verify the proof
    const result = await verifyProof(proof, publicInputs, proofType, nullifier, commitment);

    if (!result.isValid) {
      const response: VerifyResponse = {
        success: false,
        error: 'Proof verification failed',
      };
      return res.status(400).json(response);
    }

    // Sign the attestation
    const attestation = signAttestation(result);

    console.log(`[Verifier] Proof verified successfully!`);
    console.log(`[Verifier] Attestation hash: ${attestation.attestationHash.slice(0, 16)}...`);

    const response: VerifyResponse = {
      success: true,
      attestation,
    };

    return res.json(response);
  } catch (error) {
    console.error('[Verifier] Error:', error);

    const response: VerifyResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    };

    return res.status(500).json(response);
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  const circuitsLoaded = getCircuitStatus();

  const response: HealthResponse = {
    status: circuitsLoaded.developer || circuitsLoaded.whale ? 'ok' : 'error',
    version: VERSION,
    verifier: getVerifierPublicKey(),
    circuitsLoaded,
  };

  res.json(response);
});

/**
 * GET /verifier
 * Get the verifier's public key (for registration in Anchor program)
 */
app.get('/verifier', (_req, res) => {
  res.json({
    publicKey: getVerifierPublicKey(),
    message: 'Register this public key in the Anchor program to authorize attestations',
  });
});

// === Server Startup ===

async function startServer(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Vouch Protocol - ZK Verification Service');
  console.log('='.repeat(60));

  // Initialize verifier keypair
  initializeVerifier();

  // Preload circuits
  await preloadCircuits();

  // Start server
  const server = app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`CORS enabled for: ${CORS_ORIGIN}`);
    console.log(`Verifier: ${getVerifierPublicKey()}`);
    console.log('='.repeat(60));
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Verifier] Shutting down...');
    await cleanup();
    server.close(() => {
      console.log('[Verifier] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the server
startServer().catch((error) => {
  console.error('[Verifier] Failed to start:', error);
  process.exit(1);
});
