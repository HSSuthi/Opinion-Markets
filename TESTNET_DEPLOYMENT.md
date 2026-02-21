# Testnet Deployment Guide

## Quick Start (Automated)

```bash
# Make script executable
chmod +x deploy-testnet.sh

# Run deployment
./deploy-testnet.sh
```

The script will:
1. ✅ Check prerequisites (Anchor, Solana CLI)
2. ✅ Verify wallet has 2+ SOL
3. ✅ Build the program
4. ✅ Deploy to Testnet
5. ✅ Update Anchor.toml with Program ID
6. ✅ Run all tests

---

## Manual Deployment (Step-by-Step)

### Prerequisites
- Solana CLI: https://docs.solana.com/cli/install-solana-cli-tools
- Anchor CLI: https://book.anchor-lang.com/getting-started/installation.html
- Node.js 18+
- 2+ SOL in testnet wallet

### Step 1: Setup Wallet & Cluster

```bash
# Create wallet (if new)
solana-keygen new -o ~/.config/solana/id.json

# Set testnet as active cluster
solana config set --url https://api.testnet.solana.com

# Verify configuration
solana config get

# Get your public key
solana address

# Request testnet SOL (if needed)
solana airdrop 2 <YOUR_PUBLIC_KEY>
```

### Step 2: Build Program

```bash
# Install dependencies
yarn install

# Build program
anchor build --provider.cluster testnet

# Get Program ID
solana address -k target/deploy/opinion_market-keypair.json
```

Copy the Program ID - you'll need it in the next step.

### Step 3: Update Anchor Configuration

Edit `Anchor.toml` and update:

```toml
[programs.testnet]
opinion_market = "YOUR_PROGRAM_ID_HERE"  # <-- Paste your Program ID

[provider]
cluster = "testnet"
wallet = "~/.config/solana/id.json"
```

### Step 4: Deploy to Testnet

```bash
ANCHOR_WALLET=~/.config/solana/id.json anchor deploy --provider.cluster testnet
```

**Expected output:**
```
Deploying cluster: https://api.testnet.solana.com
Upgrade authority: ...
Deploying program "opinion_market"...
Program path: /path/to/target/deploy/opinion_market.so...
Program ID: YOUR_PROGRAM_ID

Deploy success
```

### Step 5: Verify Deployment

```bash
# Check program exists
solana program show YOUR_PROGRAM_ID -k ~/.config/solana/id.json

# Build IDL
anchor build --provider.cluster testnet

# View IDL
cat target/idl/opinion_market.json
```

### Step 6: Run Tests

```bash
ANCHOR_WALLET=~/.config/solana/id.json anchor test --provider.cluster testnet --skip-local-validator
```

All 17 tests should pass ✅

---

## Testnet Cluster Endpoints

**Primary:**
- `https://api.testnet.solana.com` (official)

**Backups (if primary is slow):**
- `https://testnet.rpcpool.com`
- `https://rpc.testnet.solana.com`

Switch via:
```bash
solana config set --url <NEW_RPC_URL>
```

---

## After Deployment: Initialize ProgramConfig

The program requires initialization before use. See PRODUCTION_GUIDE.md "6. ProgramConfig Initialization" for:

1. Create config account
2. Set USDC mint address (testnet: `EPjFWaJffxUqstCWgiiQv83A8M7VqDL7LYrap6ffvmU`)
3. Set oracle wallet
4. Set treasury wallet

```bash
# Example initialization command (run from Oracle service)
npx anchor idl init-if-needed YOUR_PROGRAM_ID -f target/idl/opinion_market.json
```

---

## Testnet Configuration

### USDC Testnet Mint
```
EPjFWaJffxUqstCWgiiQv83A8M7VqDL7LYrap6ffvmU
```

### Get Testnet USDC (for testing)

Option 1: Use a faucet
```bash
# GitHub: https://github.com/solana-labs/solana-program-library/tree/master/token/js/examples
```

Option 2: Use an airdrop service
```bash
# Squads Protocol: https://squads.so/
# Solana Faucet: https://solana.tools/
```

Option 3: Create token from SPL-Token CLI
```bash
spl-token create-token --decimals 6
spl-token create-account <USDC_MINT>
spl-token mint <USDC_MINT> 1000000 <YOUR_TOKEN_ACCOUNT>
```

---

## Monitoring & Debugging

### View Transaction Details

```bash
# After running a transaction
solana confirm <TRANSACTION_SIGNATURE> -v

# View latest program transactions
solana program show YOUR_PROGRAM_ID -v
```

### Check Program Data

```bash
# View all accounts for your program
solana account <ACCOUNT_ADDRESS> -k ~/.config/solana/id.json

# View program authority
solana program show YOUR_PROGRAM_ID | grep "Owner"
```

### Enable Detailed Logging

```bash
# View program logs
RUST_LOG=debug anchor test --provider.cluster testnet
```

### Common Issues

**Issue: Insufficient balance**
```bash
solana airdrop 2 $(solana address)
```

**Issue: RPC timeout**
```bash
# Switch to backup RPC
solana config set --url https://testnet.rpcpool.com
```

**Issue: Program verification fails**
```bash
# Rebuild and redeploy
rm -rf target/
anchor build --provider.cluster testnet
ANCHOR_WALLET=~/.config/solana/id.json anchor deploy --provider.cluster testnet
```

---

## Next Steps

1. ✅ **Deployment Complete** - Your program is live on testnet
2. 📝 **Initialize Config** - See PRODUCTION_GUIDE.md section 6
3. 🤖 **Deploy Oracle Service** - Separate TypeScript service for settlement
4. 🎯 **Test End-to-End** - Create market → stake → settle
5. 📊 **Setup Monitoring** - Configure alerts for errors

---

## Rollback Instructions

If something goes wrong:

```bash
# Redeploy previous version (if you have it)
ANCHOR_WALLET=~/.config/solana/id.json anchor deploy --provider.cluster testnet

# Or use program upgrade authority
solana program set-upgrade-authority YOUR_PROGRAM_ID --new-upgrade-authority <NEW_AUTHORITY>
```

---

## Questions?

- **Anchor Docs:** https://book.anchor-lang.com/
- **Solana Docs:** https://docs.solana.com/
- **Solana CLI Reference:** https://docs.solana.com/cli/
- **Testnet Status:** https://status.solana.com/

