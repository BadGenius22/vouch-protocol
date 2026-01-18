/**
 * Debug test for proof generation and public inputs format
 */

import { describe, it, expect } from 'vitest';
import { blake2s } from 'blakejs';

// Mock wallet bytes (32 bytes)
const walletBytes = new Uint8Array(32).fill(1);
// Mock secret (32 bytes)
const secret = new Uint8Array(32).fill(2);

// Compute commitment = blake2s(wallet || secret)
function computeCommitment(wallet: Uint8Array, sec: Uint8Array): Uint8Array {
  const preimage = new Uint8Array(64);
  preimage.set(wallet, 0);
  preimage.set(sec, 32);
  return blake2s(preimage, undefined, 32);
}

// Compute nullifier = blake2s(wallet || domain)
function computeNullifier(wallet: Uint8Array, domain: string): Uint8Array {
  const encoder = new TextEncoder();
  const domainBytes = encoder.encode(domain);
  const preimage = new Uint8Array(64);
  preimage.set(wallet, 0);
  preimage.set(domainBytes, 32);
  return blake2s(preimage, undefined, 32);
}

describe('Public Inputs Format Debug', () => {
  it('should compute commitment correctly', () => {
    const commitment = computeCommitment(walletBytes, secret);
    console.log('Commitment length:', commitment.length);
    console.log('Commitment hex:', Buffer.from(commitment).toString('hex'));
    expect(commitment.length).toBe(32);
  });

  it('should compute nullifier correctly', () => {
    const nullifier = computeNullifier(walletBytes, 'vouch_dev');
    console.log('Nullifier length:', nullifier.length);
    console.log('Nullifier hex:', Buffer.from(nullifier).toString('hex'));
    expect(nullifier.length).toBe(32);
  });

  it('should format public inputs as expected by Anchor', () => {
    const commitment = computeCommitment(walletBytes, secret);
    const nullifier = computeNullifier(walletBytes, 'vouch_dev');
    const minTvl = BigInt(100000);

    // Simulate what NoirJS returns - each field element as hex string with 0x prefix
    // For u8 values, they're stored as field elements (32 bytes each)
    const simulatedPublicInputs: string[] = [];

    // min_tvl as a field element (32 bytes hex with 0x prefix)
    const minTvlHex = '0x' + minTvl.toString(16).padStart(64, '0');
    simulatedPublicInputs.push(minTvlHex);

    // commitment bytes - each u8 as a separate field element
    for (let i = 0; i < 32; i++) {
      simulatedPublicInputs.push('0x' + commitment[i].toString(16).padStart(64, '0'));
    }

    // nullifier bytes - each u8 as a separate field element
    for (let i = 0; i < 32; i++) {
      simulatedPublicInputs.push('0x' + nullifier[i].toString(16).padStart(64, '0'));
    }

    console.log('Total public inputs:', simulatedPublicInputs.length);
    console.log('First input (min_tvl):', simulatedPublicInputs[0]);
    console.log('Second input (commitment[0]):', simulatedPublicInputs[1]);

    expect(simulatedPublicInputs.length).toBe(65); // 1 + 32 + 32
  });

  it('should convert public inputs to bytes for Anchor correctly', () => {
    // Test the conversion logic from verify.ts
    const testInputs = [
      '0x00000000000000000000000000000000000000000000000000000000000186a0', // 100000 as field
      '0x0000000000000000000000000000000000000000000000000000000000000001', // byte 1
      '0x0000000000000000000000000000000000000000000000000000000000000002', // byte 2
    ];

    const publicInputBuffers: Buffer[] = [];
    for (const pi of testInputs) {
      let buf: Buffer;
      if (typeof pi === 'string') {
        if (pi.startsWith('0x')) {
          buf = Buffer.from(pi.slice(2), 'hex');
        } else if (/^[0-9a-fA-F]+$/.test(pi) && pi.length === 64) {
          buf = Buffer.from(pi, 'hex');
        } else if (/^\d+$/.test(pi)) {
          buf = Buffer.alloc(32);
          let val = BigInt(pi);
          for (let i = 31; i >= 0; i--) {
            buf[i] = Number(val & BigInt(0xff));
            val = val >> BigInt(8);
          }
        } else {
          buf = Buffer.from(pi, 'hex');
        }
      } else {
        buf = Buffer.from(String(pi), 'hex');
      }
      publicInputBuffers.push(buf);
      console.log(`Input "${pi.slice(0, 20)}..." -> Buffer length: ${buf.length}`);
    }

    const publicInputsBytes = Buffer.concat(publicInputBuffers);
    console.log('Total bytes:', publicInputsBytes.length);

    // Each field element is 32 bytes
    expect(publicInputsBytes.length).toBe(testInputs.length * 32);
  });
});
