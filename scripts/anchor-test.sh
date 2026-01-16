#!/bin/bash
# Anchor test script - bypasses IDL generation issue with anchor-syn 0.30.1

set -e

# Build the program
echo "Building program..."
pnpm anchor:build

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

# Airdrop SOL
echo "Airdropping SOL..."
solana airdrop 1000 ~/.config/solana/id.json --url localhost

# Deploy program
echo "Deploying program..."
solana program deploy target/deploy/vouch_verifier.so \
    --program-id target/deploy/vouch_verifier-keypair.json \
    --url localhost

# Run tests
echo "Running tests..."
ANCHOR_WALLET=~/.config/solana/id.json \
ANCHOR_PROVIDER_URL=http://localhost:8899 \
pnpm exec ts-mocha -p ./tsconfig.anchor.json -t 1000000 tests/**/*.ts

echo "Tests completed!"
