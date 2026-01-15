#!/bin/bash
# Vouch Protocol - Local Testing Script
# This script sets up and tests the full verification flow locally

set -e

echo "=============================================="
echo "Vouch Protocol - Local Test Setup"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} $1 found"
        return 0
    else
        echo -e "  ${RED}✗${NC} $1 not found"
        return 1
    fi
}

check_command "node" || { echo "Please install Node.js >= 20"; exit 1; }
check_command "pnpm" || { echo "Please install pnpm >= 9"; exit 1; }
check_command "solana" || { echo "Please install Solana CLI"; exit 1; }
check_command "anchor" || echo "Anchor CLI not found (optional for local validator)"

# Check if using local validator or devnet
echo -e "\n${YELLOW}Solana Configuration:${NC}"
SOLANA_URL=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "  RPC URL: $SOLANA_URL"

if [[ "$SOLANA_URL" == *"localhost"* ]] || [[ "$SOLANA_URL" == *"127.0.0.1"* ]]; then
    echo -e "  ${YELLOW}Using local validator${NC}"
    USE_LOCAL=true
else
    echo -e "  ${GREEN}Using devnet/mainnet${NC}"
    USE_LOCAL=false
fi

# Step 1: Install dependencies
echo -e "\n${YELLOW}Step 1: Installing dependencies...${NC}"
cd "$(dirname "$0")/.."
pnpm install

# Step 2: Build the Anchor program (if local)
if [ "$USE_LOCAL" = true ]; then
    echo -e "\n${YELLOW}Step 2: Building Anchor program...${NC}"
    if command -v anchor &> /dev/null; then
        anchor build 2>/dev/null || echo "Anchor build skipped (version mismatch)"
    else
        echo "Skipping Anchor build (CLI not installed)"
    fi
fi

# Step 3: Set up verifier keypair
echo -e "\n${YELLOW}Step 3: Setting up verifier keypair...${NC}"
VERIFIER_DIR="apps/verifier"
if [ ! -f "$VERIFIER_DIR/.env" ]; then
    cp "$VERIFIER_DIR/.env.example" "$VERIFIER_DIR/.env"
    echo "Created $VERIFIER_DIR/.env from example"
fi

# Step 4: Check circuit files
echo -e "\n${YELLOW}Step 4: Checking circuit files...${NC}"
CIRCUITS_DIR="apps/web/public/circuits"
if [ -f "$CIRCUITS_DIR/dev_reputation.json" ] && [ -f "$CIRCUITS_DIR/whale_trading.json" ]; then
    echo -e "  ${GREEN}✓${NC} Circuit files found"
else
    echo -e "  ${RED}✗${NC} Circuit files missing. Run: pnpm circuits:compile"
    exit 1
fi

echo -e "\n${GREEN}=============================================="
echo "Setup complete! Ready to test."
echo "==============================================${NC}"

echo -e "\n${YELLOW}To run the full test:${NC}"
echo ""
echo "  Terminal 1 (Verifier Service):"
echo "    pnpm dev:verifier"
echo ""
echo "  Terminal 2 (Web App):"
echo "    pnpm dev"
echo ""
echo "  Terminal 3 (Test the API):"
echo "    # Health check"
echo "    curl http://localhost:3001/health"
echo ""
echo "    # Get verifier public key"
echo "    curl http://localhost:3001/verifier"
echo ""

echo -e "\n${YELLOW}Or run the automated API test:${NC}"
echo "    pnpm test:verifier"
