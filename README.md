# Opinion Market Protocol 🎯

A Solana-based opinion market platform where users stake USDC on predictions and receive rewards based on LLM-analyzed sentiment and proportional lottery.

## Quick Start

### Prerequisites
- Rust 1.89.0+
- Anchor 0.32.1+
- Solana CLI (devnet configured)
- Node.js 16+

### Build & Test

```bash
# Install dependencies
npm install

# Build the program
anchor build

# Run all tests
npm test

# Initialize devnet (creates config, USDC mint, funds accounts)
npm run setup
```

## Architecture

### Smart Contract (Solana)
- **Program ID (Devnet):** `2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu`
- **Language:** Rust (Anchor framework)
- **File:** `programs/opinion-market/src/lib.rs` (630 lines)

### State Machine
```
Active → Closed → Scored → Settled
  ↑        ↓        ↓         ↓
  │      (time)  (oracle) (lottery)
  └──────────────────────────────┘
      Market creation (permissionless close)
```

### Accounts

| Account | Purpose | Seeds |
|---------|---------|-------|
| **ProgramConfig** | Global oracle, treasury, USDC mint | `["config"]` |
| **Market** | Market state, total stakes, sentiment | `["market", uuid]` |
| **Opinion** | Individual staker opinion & amount | `["opinion", market, staker]` |
| **Escrow** | Token account holding all stakes | `["escrow", market]` |

### Instructions

| Instruction | Access | Purpose |
|-------------|--------|---------|
| `initialize` | Deployer | One-time setup of config |
| `create_market` | Anyone | Create opinion market ($5 fee) |
| `stake_opinion` | Anyone | Stake $0.50-$10.00 USDC |
| `close_market` | Permissionless | Finalize staking (after expiry) |
| `record_sentiment` | Oracle | Write LLM analysis (0-100 score) |
| `run_lottery` | Oracle | Distribute 90% prize pool to winner |
| `recover_stake` | Staker | Recover stake after 14 days (if unsettled) |

## Fee Structure

- **Market Creation:** $5.00 USDC (one-time, creator → treasury)
- **Protocol Fee:** 10% of total stake (prize pool → treasury)
- **Staker Earnings:** 90% of prize pool (winner receives all, plus their original stake)

## Testing

### Test Coverage
- ✅ 19 test cases
- ✅ Authorization checks (oracle-only operations)
- ✅ Input validation (statement, stakes, durations)
- ✅ State transitions (Active → Closed → Scored → Settled)
- ✅ Error handling (13 error codes)
- ✅ Escape hatch mechanism (recover_stake)
- ⚠️ Full settlement flow (requires BanksClient time-warp)

### Run Tests
```bash
# Full test suite
npm test

# With logging
RUST_LOG=debug npm test

# Specific test
npm test -- --grep "Creates a market"
```

## Security

### Features
- ✅ Safe arithmetic (saturating operations)
- ✅ Proper authorization (oracle gating)
- ✅ Input validation (bounds checking)
- ✅ PDA-based escrow (market controls funds)
- ✅ Event emissions (audit trail)
- ✅ Escape hatch (14-day recovery mechanism)

### Known Limitations
- ⚠️ Winner selection currently off-chain (oracle-dependent)
- ⚠️ Single oracle keypair (single point of failure)

**See [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md) for full security analysis.**

## Development

### Project Structure
```
Opinion-Markets/
├── programs/opinion-market/src/lib.rs  # Smart contract
├── tests/opinion-market.ts              # Integration tests
├── scripts/setup-devnet.ts              # Devnet initialization
├── migrations/deploy.ts                 # Anchor deployment
├── Anchor.toml                          # Anchor configuration
├── Cargo.toml                           # Rust dependencies
├── package.json                         # Node dependencies
└── PRODUCTION_GUIDE.md                  # Production checklist
```

### Making Changes

1. Edit `programs/opinion-market/src/lib.rs`
2. Run `npm test` to verify changes
3. Tests must pass before pushing
4. Update `PRODUCTION_GUIDE.md` if adding instructions/events
5. Commit with clear message: `feat: description` or `fix: description`

### Building a Custom Client

The Anchor IDL is automatically generated and available at:
```
target/idl/opinion_market.json
```

Use Anchor's code generation to build TypeScript clients:
```bash
anchor build
npx @coral-xyz/anchor codegen --idl target/idl/opinion_market.json --out ./generated
```

## Deployment

### Devnet
```bash
npm run setup
```

### Testnet/Mainnet
See **[PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md)** → Deployment Instructions

## Contributing

Found a bug? Want to add a feature?
1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes & test: `npm test`
4. Commit with descriptive message
5. Push & create a PR

## Resources

- **[Anchor Docs](https://docs.rs/anchor-lang/)**
- **[Solana Docs](https://docs.solana.com/)**
- **[SPL Token Program](https://spl.solana.com/token)**
- **[Production Guide](./PRODUCTION_GUIDE.md)**

## License

ISC

## Status

🟡 **70% Production Ready**
- Devnet: Fully functional
- Testnet: Ready for testing
- Mainnet: Requires VRF integration + security audit

See [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md) for full assessment.

---

**Last Updated:** February 21, 2026
**Maintainer:** Opinion Market Team
