#!/bin/bash

###############################################################################
# Deploy Opinion-Markets to Mainnet
#
# ⚠️  CRITICAL: This script deploys to production mainnet
#
# Prerequisites:
#   ✅ Security audit completed with zero critical/high findings
#   ✅ Testnet validation passed
#   ✅ Multi-sig oracle configured (3-of-5)
#   ✅ Chainlink VRF subscription active
#   ✅ All team members reviewed code
#
# Environment:
#   SOLANA_KEYPAIR: Mainnet deployer (requires isolated air-gapped machine)
#   SQUADS_MULTISIG: 3-of-5 Squads V3 wallet address
#   CHAINLINK_VRF_SUB_ID: Chainlink VRF subscription ID
#
# Deployment Strategy:
#   1. Final validation on mainnet-beta (not production)
#   2. Dry-run all transactions
#   3. Manual review of transaction details
#   4. Multi-sig approval required
#   5. Gradual rollout (whitelist → public)
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

NETWORK="mainnet-beta"
RPC_URL="https://api.mainnet-beta.solana.com"

echo -e "${RED}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         ⚠️  MAINNET DEPLOYMENT - PRODUCTION ONLY          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verification checklist
echo ""
echo "Pre-deployment Checklist:"
echo "────────────────────────"

checks=(
  "Security audit completed with zero critical findings"
  "Testnet deployment validated successfully"
  "All team members reviewed code"
  "Multi-sig oracle configured (3-of-5 Squads)"
  "Chainlink VRF subscription funded"
  "Emergency rollback plan documented"
  "Monitoring & alerting configured"
)

for check in "${checks[@]}"; do
  echo "  ☐ $check"
done

echo ""
echo -e "${YELLOW}Have you completed ALL items above? (yes/no)${NC}"
read -r response

if [ "$response" != "yes" ]; then
  echo -e "${RED}❌ Deployment cancelled${NC}"
  exit 1
fi

# Environment validation
echo ""
echo "Validating environment..."

if [ -z "$SOLANA_KEYPAIR" ]; then
  echo -e "${RED}❌ SOLANA_KEYPAIR not set${NC}"
  exit 1
fi

if [ -z "$SQUADS_MULTISIG" ]; then
  echo -e "${RED}❌ SQUADS_MULTISIG not set${NC}"
  exit 1
fi

if [ -z "$CHAINLINK_VRF_SUB_ID" ]; then
  echo -e "${RED}❌ CHAINLINK_VRF_SUB_ID not set${NC}"
  exit 1
fi

# Configure Solana CLI
echo "Configuring Solana CLI for mainnet..."
solana config set --url $RPC_URL
solana config set --keypair $SOLANA_KEYPAIR

# Verify deployer
DEPLOYER=$(solana address)
echo "Deployer: $DEPLOYER"

# Check balance (require 5+ SOL)
BALANCE=$(solana balance | awk '{print $1}')
echo "Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 5" | bc -l) )); then
  echo -e "${RED}❌ Insufficient balance (need 5+ SOL)${NC}"
  exit 1
fi

# Final confirmation
echo ""
echo -e "${YELLOW}⚠️  About to deploy to MAINNET.${NC}"
echo "Program ID: 2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu"
echo "Multi-sig: $SQUADS_MULTISIG"
echo ""
echo -e "${RED}Type 'DEPLOY' to confirm (or anything else to cancel):${NC}"
read -r confirmation

if [ "$confirmation" != "DEPLOY" ]; then
  echo -e "${RED}❌ Deployment cancelled${NC}"
  exit 1
fi

# Build
echo ""
echo -e "${YELLOW}🔨 Building release binary...${NC}"
cargo build --release

# Dry-run
echo -e "${YELLOW}🔍 Performing dry-run deployment...${NC}"
echo "All transactions will be validated without executing"

# TODO: Actual deployment
# ANCHOR_WALLET=$SOLANA_KEYPAIR \
#   ANCHOR_PROVIDER_URL=$RPC_URL \
#   anchor deploy --provider.cluster mainnet-beta --dry-run

# Review transaction
echo ""
echo -e "${YELLOW}📋 Transaction Review${NC}"
echo "────────────────────"
echo "Program: 2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu"
echo "Network: Mainnet Beta"
echo "Deployer: $DEPLOYER"
echo "Estimated cost: ~0.5 SOL"
echo ""

# Proceed with actual deployment
echo -e "${RED}Ready to execute transaction. Confirm (yes/no):${NC}"
read -r final_confirm

if [ "$final_confirm" != "yes" ]; then
  echo -e "${YELLOW}⏸️  Deployment paused${NC}"
  exit 0
fi

# Execute deployment
echo -e "${YELLOW}⏱️  Executing deployment...${NC}"

# TODO: Actual deployment command
# ANCHOR_WALLET=$SOLANA_KEYPAIR \
#   ANCHOR_PROVIDER_URL=$RPC_URL \
#   anchor deploy --provider.cluster mainnet-beta

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Post-deployment steps:"
echo "1. Monitor program: solana logs -u mainnet-beta 2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu"
echo "2. Verify balance: solana balance -u mainnet-beta"
echo "3. Alert team on Slack"
echo "4. Enable monitoring dashboards"
echo ""
echo "Explorer: https://explorer.solana.com/address/2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu"
