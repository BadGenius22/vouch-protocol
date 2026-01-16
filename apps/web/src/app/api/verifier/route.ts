/**
 * Vouch Protocol - Verifier Info API
 *
 * GET /api/verifier
 * Returns the verifier's public key for registration in Anchor program
 */

import { NextResponse } from 'next/server';
import { getVerifierPublicKey, getCircuitStatus, initializeVerifier } from '@/lib/verifier';

// Initialize verifier on cold start
initializeVerifier();

export async function GET() {
  const publicKey = getVerifierPublicKey();
  const circuitsLoaded = getCircuitStatus();

  return NextResponse.json({
    publicKey,
    circuitsLoaded,
    message: 'Register this public key in the Anchor program to authorize attestations',
  });
}
