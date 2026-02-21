# Opinion Markets 🎯

**Decentralized Prediction Markets with LLM-Powered Sentiment Analysis**

A full-stack prediction market platform where users stake opinions on statements, and AI sentiment analysis determines outcomes. Built on Solana with Next.js frontend, Express API, and PostgreSQL database.

**Status**: Phase 3 Complete - Ready for Testing & Deployment ✅

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

## 🏗️ Full-Stack Architecture

This is a complete full-stack application with three main components:

### 1. Frontend (Next.js React App)
- **Location**: `/frontend`
- **Port**: 3000 (dev), Vercel (prod)
- **Features**:
  - Feed with infinite scroll
  - Market detail pages
  - Multi-step create market flow
  - Multi-step stake opinion flow
  - Shareable cards for Twitter
  - User profile & portfolio
  - Sentiment dial visualization
  - Responsive design (mobile-first)

### 2. REST API (Express + TypeORM)
- **Location**: `/api`
- **Port**: 3001
- **Database**: PostgreSQL
- **Features**:
  - Markets CRUD with pagination/filtering
  - User portfolio tracking
  - Sentiment history
  - Topic search
  - Proper error handling & validation

### 3. Smart Contract (Solana)
- **Location**: `/programs/opinion-market`
- **Language**: Rust (Anchor)
- **Features**:
  - create_market instruction ($5 fee)
  - stake_opinion instruction ($0.50-$10)
  - close_market (permissionless)
  - record_sentiment (oracle)
  - run_lottery_with_vrf (Chainlink integration)

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

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
vercel --prod
```

### API (Docker)
```bash
docker-compose up -d
```

### Full Local Stack
```bash
# 1. Terminal 1: Database & Redis
docker-compose up -d

# 2. Terminal 2: Frontend
cd frontend && npm run dev

# 3. Terminal 3: API
cd api && npm run dev

# Now accessible at:
# Frontend: http://localhost:3000
# API: http://localhost:3001
```

## 📊 Database

**PostgreSQL 15+** with TypeORM

### Tables
- **markets** - Opinion markets
- **opinions** - Staked opinions with amounts
- **positions** - User positions for tracking
- **user_portfolio** - Cached portfolio stats

See `api/src/entities/` for full schema.

## 🧪 Testing

### Frontend Testing
```bash
cd frontend
npm run lint       # ESLint
npm run type-check # TypeScript
npm run build      # Build test
```

### API Testing
```bash
cd api
npm test          # Jest tests
npm run lint      # ESLint
npm run type-check# TypeScript
```

### Manual Testing Checklist
- [ ] Feed page loads with markets
- [ ] Infinite scroll pagination works
- [ ] Market detail shows sentiment dial
- [ ] Stake flow multi-step works
- [ ] Create market works
- [ ] User profile shows stats
- [ ] API endpoints return correct data
- [ ] Mobile responsive on all pages

## 🔐 Security

### Implemented ✅
- Input validation on all forms/endpoints
- TypeORM parameterized queries (SQL injection protection)
- Wallet signing for transactions
- Database constraints
- CORS properly configured
- Secure password handling

### Todo ⏳
- [ ] Rate limiting on API
- [ ] Signature verification
- [ ] Real Solana transaction validation
- [ ] Security audit

## 📚 Documentation

- `README.md` (this file) - Overview & setup
- `FRONTEND_BUILD_SUMMARY.md` - Frontend architecture
- `SPEC_IMPLEMENTATION_CROSS_REFERENCE.md` - Feature compliance
- `.env.example` - Configuration template

## 🤝 Contributing

1. Create feature branch
2. Make changes with tests
3. Ensure linting passes
4. Create PR with description

## Status

✅ **Phase 3 Complete - Ready for Testing**

- ✅ Smart Contract: Fully functional
- ✅ Frontend: All pages built
- ✅ API: All endpoints implemented
- ✅ Database: Schema with proper indexing
- ⏳ Real transactions: In development
- ⏳ Security audit: Scheduled
- ⏳ Mainnet: After audit

## Next Steps

1. **Test locally** using Quick Start guide
2. **Run test suite** to verify everything works
3. **Deploy to staging** for integration testing
4. **Security audit** before mainnet
5. **Deploy to production**

---

**Built with ❤️ for Decentralized Prediction Markets**
**Status**: Beta - Ready for Testing
**Last Updated**: February 21, 2026
**Branch**: `claude/review-codebase-deployment-rIkjA`
