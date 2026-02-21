#!/bin/bash
set -e

echo "🚀 Deploying Opinion Market Protocol to Testnet"
echo "================================================"

# Step 1: Check prerequisites
echo "✓ Checking prerequisites..."
command -v anchor >/dev/null 2>&1 || { echo "❌ Anchor CLI not found. Install: https://book.anchor-lang.com/getting-started/installation.html"; exit 1; }
command -v solana >/dev/null 2>&1 || { echo "❌ Solana CLI not found. Install: https://docs.solana.com/cli/install-solana-cli-tools"; exit 1; }

# Step 2: Verify wallet
echo "✓ Checking Solana wallet..."
WALLET=${ANCHOR_WALLET:-~/.config/solana/id.json}
if [ ! -f "$WALLET" ]; then
    echo "❌ Wallet not found at $WALLET"
    echo "   Generate new wallet: solana-keygen new -o ~/.config/solana/id.json"
    exit 1
fi

PUBKEY=$(solana address -k "$WALLET")
echo "   Using wallet: $PUBKEY"

# Step 3: Set cluster to testnet
echo "✓ Setting Solana cluster to testnet..."
solana config set --url https://api.testnet.solana.com

# Step 4: Check wallet balance
echo "✓ Checking wallet balance (need ~2 SOL for deployment)..."
BALANCE=$(solana balance -k "$WALLET" | awk '{print $1}')
echo "   Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "⚠️  Low balance. Request testnet SOL:"
    echo "   solana airdrop 2 $PUBKEY -k $WALLET"
    exit 1
fi

# Step 5: Build program
echo "✓ Building program..."
anchor build --provider.cluster testnet

# Step 6: Get deployed program ID
PROGRAM_ID=$(solana address -k target/deploy/opinion_market-keypair.json)
echo "✓ Program ID: $PROGRAM_ID"

# Step 7: Deploy
echo "✓ Deploying to testnet..."
anchor deploy --provider.cluster testnet

# Step 8: Update Anchor.toml with actual program ID
echo "✓ Updating Anchor.toml with Program ID..."
sed -i "s/opinion_market = \".*\"/opinion_market = \"$PROGRAM_ID\"/g" Anchor.toml

# Step 9: Build IDL
echo "✓ Building IDL..."
anchor build --provider.cluster testnet

# Step 10: Run tests
echo "✓ Running tests against testnet deployment..."
ANCHOR_WALLET="$WALLET" anchor test --provider.cluster testnet --skip-local-validator

echo ""
echo "✅ Deployment Complete!"
echo "================================================"
echo "Program ID: $PROGRAM_ID"
echo "Cluster:   testnet"
echo "Wallet:    $PUBKEY"
echo ""
echo "Next steps:"
echo "1. Update your frontend with Program ID: $PROGRAM_ID"
echo "2. Review PRODUCTION_GUIDE.md for configuration"
echo "3. Initialize ProgramConfig (see PRODUCTION_GUIDE.md)"
echo ""
