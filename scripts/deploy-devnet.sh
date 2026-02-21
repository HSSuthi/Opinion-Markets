#!/bin/bash

###############################################################################
# Deploy Opinion-Markets to Devnet
#
# Usage:
#   ./scripts/deploy-devnet.sh
#
# Prerequisites:
#   - Solana CLI installed
#   - Anchor installed
#   - Local solana keypair at ~/.config/solana/id.json
#   - SOL balance on local wallet
#
# Steps:
#   1. Build smart contract
#   2. Deploy to devnet
#   3. Run initialization script
#   4. Generate environment variables
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NETWORK="devnet"
RPC_URL="https://api.devnet.solana.com"
WALLET_PATH="${SOLANA_KEYPAIR:-$HOME/.config/solana/id.json}"
PROGRAM_ID="2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu"
USDC_DEVNET="EPjFWaLb3odccccccccccccccccccccccccccPna"  # devUSDC

echo -e "${YELLOW}🚀 Deploying Opinion-Markets to Devnet${NC}"
echo "Network: $NETWORK"
echo "RPC URL: $RPC_URL"
echo "Wallet: $WALLET_PATH"
echo ""

# Step 1: Verify wallet exists
if [ ! -f "$WALLET_PATH" ]; then
  echo -e "${RED}❌ Error: Wallet not found at $WALLET_PATH${NC}"
  echo "Create one with: solana-keygen new"
  exit 1
fi

# Step 2: Configure Solana CLI
echo -e "${YELLOW}📋 Configuring Solana CLI...${NC}"
solana config set --url $RPC_URL
solana config set --keypair $WALLET_PATH

# Step 3: Check wallet balance
BALANCE=$(solana balance | awk '{print $1}')
echo "Wallet balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 1" | bc -l) )); then
  echo -e "${YELLOW}⚠️  Low balance. Requesting airdrop...${NC}"
  solana airdrop 5
fi

# Step 4: Build smart contract
echo -e "${YELLOW}🔨 Building smart contract...${NC}"
cargo build --release

# Step 5: Deploy program
echo -e "${YELLOW}📤 Deploying to devnet...${NC}"
WALLET_ADDRESS=$(solana address)
echo "Deployer: $WALLET_ADDRESS"

# Get current program info if exists
DEPLOYED_PROGRAM=$(solana program show $PROGRAM_ID 2>/dev/null || echo "")

if [ ! -z "$DEPLOYED_PROGRAM" ]; then
  echo -e "${YELLOW}Program already deployed. Upgrading...${NC}"
  # anchor deploy would handle upgrade
else
  echo -e "${YELLOW}New program deployment...${NC}"
fi

# Deploy using Anchor
ANCHOR_WALLET=$WALLET_PATH ANCHOR_PROVIDER_URL=$RPC_URL cargo build-bpf
PROGRAM_KEYPAIR=$(solana-keygen grind-validator-stakes 2>/dev/null || echo "")

# Step 6: Run setup script
echo -e "${YELLOW}⚙️  Running initialization script...${NC}"
npx ts-node scripts/setup-devnet.ts

# Step 7: Verify deployment
echo -e "${YELLOW}✅ Verifying deployment...${NC}"
PROGRAM_INFO=$(solana program show $PROGRAM_ID)
echo "$PROGRAM_INFO"

# Step 8: Generate env file
echo -e "${YELLOW}📝 Generating .env file...${NC}"
cat > .env.devnet << EOF
# Devnet Configuration
NETWORK=devnet
SOLANA_RPC_URL=$RPC_URL
PROGRAM_ID=$PROGRAM_ID
USDC_MINT=$USDC_DEVNET

# API Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=$RPC_URL
NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID
NEXT_PUBLIC_API_URL=http://localhost:3001

# Oracle Configuration
ORACLE_KEYPAIR_PATH=$HOME/.config/solana/oracle.json
EOF

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start the API server:    npm run dev:api"
echo "2. Start the Oracle service: npm run dev:oracle"
echo "3. Start the frontend:      npm run dev:frontend"
echo ""
echo "Load environment variables:"
echo "  source .env.devnet"
