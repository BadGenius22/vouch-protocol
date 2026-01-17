#!/bin/bash
# Anchor test script - bypasses IDL generation issue with anchor-syn 0.30.1
# Uses committed test keypairs so everyone can run tests without setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_WALLET="$PROJECT_ROOT/keys/test-wallet.json"
PROGRAM_KEYPAIR="$PROJECT_ROOT/keys/vouch_verifier-keypair.json"

# Build the program
echo "Building program..."
pnpm anchor:build

# Sync IDL (in case it changed)
echo "Syncing IDL..."
node scripts/sync-idl.js

# Kill any existing test validator
pkill -f solana-test-validator 2>/dev/null || true
sleep 2

# Start test validator in background
echo "Starting local validator..."
solana-test-validator --reset --quiet &
VALIDATOR_PID=$!
sleep 5

# Cleanup function
cleanup() {
    echo "Cleaning up..."
    kill $VALIDATOR_PID 2>/dev/null || true
    pkill -f solana-test-validator 2>/dev/null || true
}
trap cleanup EXIT

# Airdrop SOL to test wallet
echo "Airdropping SOL to test wallet..."
solana airdrop 1000 "$TEST_WALLET" --url localhost

# Deploy program using committed program keypair
echo "Deploying program..."
solana program deploy target/deploy/vouch_verifier.so \
    --program-id "$PROGRAM_KEYPAIR" \
    --keypair "$TEST_WALLET" \
    --url localhost

# Run tests using test wallet
echo "Running tests..."
ANCHOR_WALLET="$TEST_WALLET" \
ANCHOR_PROVIDER_URL=http://localhost:8899 \
pnpm exec ts-mocha -p ./tsconfig.anchor.json -t 1000000 tests/**/*.ts

echo "Tests completed!"
