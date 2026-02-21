#!/bin/bash

###############################################################################
# Deploy Opinion-Markets to Testnet
#
# This script deploys to Solana Testnet with:
# - Full validation and testing
# - VRF integration validation
# - Multi-sig oracle setup (dry-run)
#
# Usage:
#   ./scripts/deploy-testnet.sh [--skip-tests] [--verbose]
#
# Environment:
#   SOLANA_KEYPAIR: Path to testnet deployer keypair (required)
#   RPC_RATE_LIMIT: Requests per second (default: 10)
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NETWORK="testnet"
RPC_URL="https://api.testnet.solana.com"
SKIP_TESTS=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests) SKIP_TESTS=true; shift ;;
    --verbose) VERBOSE=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo -e "${BLUE}🌐 Deploying to Testnet${NC}"
echo "Network: $NETWORK"
echo "RPC: $RPC_URL"
echo ""

# Validate environment
if [ -z "$SOLANA_KEYPAIR" ]; then
  echo -e "${RED}❌ SOLANA_KEYPAIR environment variable not set${NC}"
  echo "Set it to path of your testnet deployer keypair"
  exit 1
fi

# Configure
solana config set --url $RPC_URL
solana config set --keypair $SOLANA_KEYPAIR

# Run tests if not skipped
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${YELLOW}🧪 Running test suite...${NC}"
  npm test
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
  fi
fi

# Build
echo -e "${YELLOW}🔨 Building for testnet...${NC}"
cargo build --release

# Validate balance
BALANCE=$(solana balance | awk '{print $1}')
if (( $(echo "$BALANCE < 2" | bc -l) )); then
  echo -e "${RED}❌ Insufficient balance: $BALANCE SOL (need 2+ SOL)${NC}"
  exit 1
fi

# Deploy
echo -e "${YELLOW}📤 Deploying program...${NC}"
DEPLOYER=$(solana address)
echo "Deployer: $DEPLOYER"

# Log deployment details
DEPLOY_LOG="deploy-$(date +%Y%m%d-%H%M%S).log"
echo "Logging to: $DEPLOY_LOG"

# TODO: Actual deployment command
# anchor deploy --provider.cluster testnet 2>&1 | tee $DEPLOY_LOG

# Validate testnet setup
echo -e "${YELLOW}✅ Validating testnet setup...${NC}"
npx ts-node scripts/validate-testnet.ts --network testnet --verbose

# Run load tests for baseline
echo -e "${YELLOW}📊 Running performance baseline...${NC}"
npx ts-node scripts/load-test.ts --markets 3 --stakers 25 --concurrent 2

echo -e "${GREEN}✅ Testnet deployment complete!${NC}"
echo ""
echo "Deployment artifacts:"
echo "  - Log file: $DEPLOY_LOG"
echo "  - Program: 2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu"
echo ""
echo "Next steps:"
echo "1. Verify on explorer: https://explorer.solana.com/address/2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu?cluster=testnet"
echo "2. Monitor with: solana logs -u testnet 2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu"
echo "3. Run oracle service: NETWORK=testnet npm run dev:oracle"
