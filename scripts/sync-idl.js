#!/usr/bin/env node
/**
 * Sync IDL from TypeScript to JSON
 *
 * Since anchor build has IDL generation issues with proc-macro2,
 * we maintain the IDL in TypeScript and sync it to JSON when needed.
 */

const fs = require('fs');
const path = require('path');

const TS_IDL_PATH = 'apps/web/src/idl/vouch_verifier.ts';
const JSON_IDL_PATH = 'target/idl/vouch_verifier.json';
const PROGRAM_ID = 'EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD';

// Read TypeScript IDL
const tsContent = fs.readFileSync(TS_IDL_PATH, 'utf8');

// Extract the IDL object
const match = tsContent.match(/export const IDL: VouchVerifier = ({[\s\S]*?});/);
if (!match) {
  console.error('Could not find IDL in TypeScript file');
  process.exit(1);
}

// Parse the IDL
let idl;
try {
  idl = eval('(' + match[1] + ')');
} catch (e) {
  console.error('Could not parse IDL:', e.message);
  process.exit(1);
}

// Add metadata with program address
idl.metadata = {
  address: PROGRAM_ID
};

// Ensure target/idl directory exists
fs.mkdirSync(path.dirname(JSON_IDL_PATH), { recursive: true });

// Write JSON IDL
fs.writeFileSync(JSON_IDL_PATH, JSON.stringify(idl, null, 2));

console.log(`IDL synced to ${JSON_IDL_PATH}`);
console.log(`Program ID: ${PROGRAM_ID}`);
