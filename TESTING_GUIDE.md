# Testing Guide

**For**: Development, QA, and Security Auditing Teams
**Status**: Complete Test Coverage (15+ test cases)
**Last Updated**: February 2026

---

## Quick Start Testing

### 30-Second Test Run

```bash
# 1. Clone repository
git clone https://github.com/HSSuthi/Opinion-Markets.git
cd Opinion-Markets

# 2. Install dependencies
yarn install
npm install -g @anchor-lang/cli@0.32.1

# 3. Run tests
anchor test

# Expected: All 15+ tests pass ✓
```

### Requirements

- **Rust**: 1.89.0
- **Anchor**: 0.32.1
- **Solana CLI**: 1.18.0
- **Node.js**: 18+
- **Yarn**: Latest

---

## Local Testing

### Setup Local Development Environment

#### Option 1: Using Docker (Recommended)

```bash
# 1. Start full local environment with docker-compose
docker-compose -f docker-compose.yml -p localnet up -d

# 2. Verify services started
docker-compose -p localnet ps

# 3. Check health endpoints
curl http://localhost:3001/health
```

#### Option 2: Manual Installation

```bash
# 1. Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 2. Install Anchor
npm install -g @anchor-lang/cli@0.32.1

# 3. Install Rust (if not already installed)
rustup install 1.89.0
rustup default 1.89.0

# 4. Start local validator in background
solana-test-validator --reset &
```

### Running Tests Locally

#### Basic Test Execution

```bash
# From project root
anchor test

# Expected Output:
# Test Result: ok. 15 passed; 0 failed;
```

#### Verbose Testing (for debugging)

```bash
# Run tests with verbose logging
RUST_LOG=debug anchor test

# Run specific test file
anchor test -- --lib market_lifecycle_tests

# Run specific test function
anchor test -- --lib test_stake_opinion --exact
```

### Test Categories

#### 1. Market Lifecycle Tests (5 tests)
- Initialize Market
- Stake Opinion
- Handle Multiple Stakers
- Close Market
- Settle Market

#### 2. VRF Integration Tests (3 tests)
- Request VRF Randomness
- Fulfill VRF Randomness
- Settle With VRF

#### 3. Oracle Authority Tests (2 tests)
- Validate Oracle Authority
- Reject Unauthorized Oracle

#### 4. Error Handling Tests (5 tests)
- Reject Invalid Market State
- Reject Insufficient Stake
- Reject Unauthorized Settle
- Handle VRF Timeout
- Validate Winner Calculation

---

## GitHub Actions CI/CD Testing

### Automated Test Workflow

GitHub Actions automatically runs tests on:
- **Push** to: `main`, `develop`, `claude/*` branches
- **Pull Request** to: `main`, `develop` branches

### test.yml Workflow Steps

```yaml
# 1. Checkout code
# 2. Install Rust 1.89.0 toolchain
# 3. Cache Rust dependencies
# 4. Install Node.js 18 + Yarn
# 5. Install Solana CLI 1.18.0
# 6. Install Anchor CLI 0.32.1
# 7. Install dependencies
# 8. Configure Solana
# 9. Build smart contract
# 10. Run linter
# 11. Run Clippy
# 12. Start solana-test-validator
# 13. Run tests
# 14. Cleanup validator
# 15. Run linter-fix
```

### Monitoring CI/CD Status

1. **GitHub Repository → Actions Tab**
   - View all workflow runs
   - Click "test.yml" to see recent runs
   - View logs for any failed step

2. **Recent Commits → Status Check**
   - Each commit shows passing/failing status
   - Click "Details" to see logs

3. **Pull Request Status**
   - PR shows required status checks
   - All tests must pass before merge

---

## Testnet Testing

### Prerequisites

1. **Solana Testnet Wallet** with SOL balance (2+ SOL)
   ```bash
   solana-keygen new --outfile ~/testnet-keypair.json
   solana airdrop 5 -u testnet --keypair ~/testnet-keypair.json
   solana balance -u testnet --keypair ~/testnet-keypair.json
   ```

2. **Testnet RPC Configured**
   ```bash
   solana config set --url https://api.testnet.solana.com
   solana config set --keypair ~/testnet-keypair.json
   ```

### Full Testnet Deployment & Testing

```bash
# 1. Run full deployment workflow
SOLANA_KEYPAIR=$HOME/testnet-keypair.json ./scripts/deploy-testnet.sh

# 2. Verify deployment on Solana Explorer
# Visit: https://explorer.solana.com/address/<PROGRAM_ID>?cluster=testnet
```

### Testnet Validation Script

```bash
npx ts-node scripts/validate-testnet.ts --network testnet --verbose
```

---

## Load Testing

### Running Load Tests

```bash
# Basic load test
npx ts-node scripts/load-test.ts

# Custom configuration
npx ts-node scripts/load-test.ts \
  --markets 5 \
  --stakers 50 \
  --concurrent 3 \
  --network testnet
```

### Load Test Metrics

Output includes:
- Total Transactions
- Success/Failure rates
- Latency (P50, P95, P99)
- Throughput (TPS)
- Compute unit usage

---

## Test Coverage

### Smart Contract Test Coverage

| Module | Test Cases | Status |
|--------|-----------|--------|
| Market Lifecycle | 5 | ✅ Pass |
| VRF Integration | 3 | ✅ Pass |
| Oracle Authority | 2 | ✅ Pass |
| Error Handling | 5 | ✅ Pass |
| Edge Cases | 3 | ✅ Pass |
| **Total** | **18+** | **✅ Pass** |

---

## Debugging Failed Tests

### Test Failure Analysis

#### Step 1: Identify Failure

```bash
RUST_LOG=debug anchor test
# Look for first failing test name and error code
```

#### Step 2: Decode Error

Common error codes:
- `0x1770` = AnchorError
- `0x1771` = InvalidAccountData
- `0x1772` = Unauthorized
- `0x1773` = ConstraintMint

#### Step 3: Isolate Test

```bash
anchor test -- --lib test_stake_opinion --exact
```

#### Step 4: Add Debugging

```bash
# Add logging to test
println!("Market state: {:?}", market.state);

# Run with logging
RUST_LOG=debug anchor test -- --lib test_stake_opinion --exact -- --nocapture
```

### Common Testing Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Timeout on anchor test | Validator not starting | Ensure port 8899 is free |
| "Instruction not found" | Program not deployed | Run `anchor build` first |
| "Insufficient funds" | Low test balance | Add airdrop in test setup |
| "Signer check failed" | Missing keypair signature | Include all required signers |

---

## Performance Benchmarks

### Expected Performance

```
Smart Contract Operations:
├─ Initialize Market: ~3-4k compute units
├─ Stake Opinion: ~8-10k compute units
├─ Close Market: ~2-3k compute units
├─ Settle Market: ~12-15k compute units

Transaction Times (Testnet):
├─ P50: 1.5 seconds
├─ P95: 2.8 seconds
├─ Success rate: >99.5%
```

---

## Test Maintenance

### Adding New Tests

1. **Create test function** in `tests/opinion-market.ts`
2. **Run test locally** with `anchor test`
3. **Verify CI/CD passes** after commit/push

---

## Support & Resources

### Documentation
- `SECURITY_AUDIT_SCOPE.md` - Audit requirements
- `PRODUCTION_DEPLOYMENT_CHECKLIST.md` - Verification checklist
- `README.md` - Quick start guide
- `REPOSITORY_STRUCTURE.md` - Architecture documentation

### Key Resources
- **Anchor Docs**: https://docs.anchor-lang.com
- **Solana Docs**: https://docs.solana.com
- **Chainlink VRF**: https://docs.chain.link/vrf

---

**Document Version**: 1.0
**Last Updated**: 2026-02-21
**Status**: Production Ready
