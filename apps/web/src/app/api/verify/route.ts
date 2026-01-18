/**
 * Vouch Protocol - Proof Verification API
 *
 * POST /api/verify
 * Verifies a ZK proof and returns a signed attestation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRequestSchema,
  verifyProof,
  signAttestation,
  initializeVerifier,
  type VerifyResponse,
} from '@/lib/verifier';

// Initialize verifier on cold start
initializeVerifier();

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate request
    const parseResult = verifyRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const response: VerifyResponse = {
        success: false,
        error: `Invalid request: ${parseResult.error.issues.map(i => i.message).join(', ')}`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { proof, publicInputs, proofType, nullifier, commitment } = parseResult.data;

    console.log(`[API/verify] Verifying ${proofType} proof...`);
    console.log(`[API/verify] Nullifier: ${nullifier.slice(0, 16)}...`);
    console.log(`[API/verify] Proof size: ${proof.length} chars`);

    // Verify the proof
    let result;
    try {
      result = await verifyProof(proof, publicInputs, proofType, nullifier, commitment);
    } catch (verifyError) {
      console.error('[API/verify] verifyProof threw:', verifyError);
      const response: VerifyResponse = {
        success: false,
        error: `Proof verification error: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!result.isValid) {
      const response: VerifyResponse = {
        success: false,
        error: 'Proof verification failed - proof is invalid',
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Sign the attestation
    const attestation = signAttestation(result);

    console.log(`[API/verify] Proof verified successfully!`);
    console.log(`[API/verify] Attestation hash: ${attestation.attestationHash.slice(0, 16)}...`);

    const response: VerifyResponse = {
      success: true,
      attestation,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API/verify] Error:', error);

    const response: VerifyResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// Increase timeout for serverless function (proof verification can take time)
export const maxDuration = 60; // 60 seconds (Vercel Pro limit)
