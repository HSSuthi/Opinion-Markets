# Opinion Markets - Repository Structure & Organization

**Last Updated**: February 2026
**Status**: Production-Ready for Security Audit
**Target Deployment**: Solana Mainnet

---

## Executive Summary

This repository contains a complete decentralized opinion market platform built on Solana with the following components:

- **Smart Contract** (Rust/Anchor): Opinion market state machine with Chainlink VRF integration
- **REST API** (Node.js/Express): Market operations and query interface
- **Frontend** (React/Next.js): User-facing market interface with multi-wallet support
- **Oracle Service** (Node.js): Sentiment analysis via Claude API + multi-sig settlement coordination
- **Monitoring Stack** (Prometheus/Grafana): Production metrics and alerting
- **Deployment Automation**: Devnet, testnet, and mainnet deployment scripts

---

## Directory Structure

```
Opinion-Markets/
├── programs/
│   └── opinion-market/                 # Core smart contract (Rust/Anchor)
│       ├── src/
│       │   ├── lib.rs                 # Main program logic
│       │   ├── state.rs               # Account state structures
│       │   ├── instructions/          # Instruction handlers
│       │   └── errors.rs              # Custom error codes
│       ├── tests/                     # Integration tests
│       └── Cargo.toml
│
├── api/                                # REST API server
│   ├── src/
│   │   ├── server.ts                  # Express.js application
│   │   ├── routes/                    # API endpoints
│   │   └── middleware/                # Authentication, logging
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                           # React/Next.js application
│   ├── src/
│   │   ├── pages/                     # Next.js pages
│   │   ├── components/                # React components
│   │   ├── hooks/                     # Custom React hooks
│   │   └── lib/                       # Utility functions
│   ├── public/                        # Static assets
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
│
├── oracle/                             # Oracle service
│   ├── src/
│   │   ├── index.ts                   # Main service entry
│   │   ├── sentiment/                 # Claude API integration
│   │   ├── settlement/                # Settlement coordination
│   │   └── monitoring/                # Service health checks
│   ├── package.json
│   └── tsconfig.json
│
├── monitoring/                         # Prometheus + AlertManager
│   ├── prometheus/
│   │   ├── prometheus.yml             # Scrape configuration
│   │   └── opinion-markets-rules.yml  # Alert rules (30+ rules)
│   └── alertmanager/
│       └── alertmanager.yml           # Alert routing
│
├── scripts/                            # Deployment & maintenance
│   ├── deploy-devnet.sh               # Local devnet deployment
│   ├── deploy-testnet.sh              # Solana testnet deployment
│   ├── deploy-mainnet.sh              # Mainnet deployment (requires confirmation)
│   ├── setup-devnet.ts                # Devnet initialization
│   ├── validate-testnet.ts            # Testnet verification (400 lines)
│   ├── load-test.ts                   # Performance baseline (350 lines)
│   └── setup-monitoring.sh            # Monitoring stack deployment
│
├── .github/workflows/                 # GitHub Actions CI/CD
│   ├── test.yml                       # Automated testing (FIXED)
│   └── deploy.yml                     # Deployment pipeline
│
├── migrations/                         # Database migrations
├── Dockerfile                          # Multi-stage smart contract build
├── docker-compose.yml                 # Local development environment
├── Anchor.toml                        # Anchor framework config
├── Cargo.toml                         # Root workspace config
├── package.json                       # Workspace root
└── Documentation files:
    ├── README.md                      # Quick start guide
    ├── SECURITY_AUDIT_SCOPE.md        # 14KB security audit requirements
    ├── PHASE_1_IMPLEMENTATION.md      # VRF & multi-sig (Phase 1)
    ├── PHASE_2_IMPLEMENTATION.md      # CI/CD & Docker (Phase 2)
    ├── PHASE_3_IMPLEMENTATION.md      # Monitoring & oracle (Phase 3)
    ├── ORACLE_OPERATOR_RUNBOOK.md     # Oracle operational procedures
    ├── PRODUCTION_GUIDE.md            # Production deployment guide
    ├── REPOSITORY_STRUCTURE.md        # This file
    ├── PRODUCTION_DEPLOYMENT_CHECKLIST.md # Verification checklist
    └── TESTING_GUIDE.md               # Testing procedures
```

---

## Key Components Overview

### 1. Smart Contract (`programs/opinion-market/`)

**Framework**: Anchor 0.32.1 | **Language**: Rust 1.89.0
**Network**: Solana Devnet/Testnet (mainnet-ready)

#### Account Structures
- `ProgramConfig`: Global configuration + oracle authority
- `Market`: Opinion market state machine with VRF integration
- `StakerOpinion`: Individual stake + sentiment opinion
- `VrfRequest`: Chainlink VRF randomness tracking

#### Instructions (15+ implemented)
- `initialize_market()`: Create new market
- `stake_opinion()`: Place opinion stake
- `close_market()`: End staking period
- `record_sentiment()`: Submit LLM analysis (oracle-gated)
- `request_vrf_randomness()`: Initiate Chainlink VRF request
- `fulfill_vrf_randomness()`: Oracle provides randomness callback
- `run_lottery()`: Settle market with randomness
- `settle_market()`: Final settlement with winner payout

#### State Machine
```
Created → Active → Closed → AwaitingRandomness → Settled
                      ↓
                  Cancelled
```

#### Security Features
- Program-derived account (PDA) for markets
- Oracle authority with multi-sig support (Squads V3)
- Chainlink VRF for decentralized randomness
- SPL Token transfers with proper validation
- Proper sysvar constraints (Rent, Clock, etc.)

### 2. REST API (`api/`)

**Framework**: Express.js | **Language**: TypeScript
**Port**: 3001 (configurable)

#### Endpoints
- `GET /health` - Health check
- `GET /markets` - List all markets
- `GET /markets/:id` - Get market details
- `POST /markets` - Create new market
- `POST /stake/:marketId` - Place stake
- `GET /user/portfolio` - User positions
- `GET /transaction/estimate` - Compute unit estimation
- `GET /network/info` - Solana network metrics

#### Features
- Pino structured logging
- Global error handler with proper HTTP status codes
- CORS configuration
- Connection pooling to database
- Redis caching support

### 3. Frontend (`frontend/`)

**Framework**: Next.js 14+ | **Language**: TypeScript/React
**Styling**: Tailwind CSS + shadcn/ui

#### Pages
- `/` - Dashboard with market list
- `/markets/[id]` - Market details + staking interface
- `/portfolio` - User positions + history
- `/admin` - Administrative functions (future)

#### Components
- `WalletButton` - Multi-wallet connection (Phantom, Solflare, Brave)
- `MarketList` - Responsive market grid
- `StakingForm` - Opinion entry + stake amount
- `Chart` - Market history visualization

#### State Management
- Zustand for global state
- SWR for data fetching + caching
- Wallet adapter for Solana integration

### 4. Oracle Service (`oracle/`)

**Runtime**: Node.js | **Language**: TypeScript
**Integration**: Claude API (Anthropic) + Solana RPC

#### Components

##### SentimentAnalyzer
- Analyzes opinion statements using Claude 3.5 Sonnet
- Input: market statement + all staker opinions + amounts
- Output: sentiment score (0-100), confidence (0-2), summary
- Uses prompt engineering for consistent, interpretable results

##### SettlementCoordinator
- Manages multi-sig settlement workflow
- Coordinates with oracle signers (Squads V3 wallet)
- Bull job queue for reliable job processing with retry logic
- Exponential backoff for failed settlement attempts

##### MarketMonitor
- Polls markets every 60 seconds
- Identifies markets ready for settlement
- Triggers sentiment analysis when markets close
- Coordinates VRF requests and settlement execution

#### Configuration
```typescript
ANTHROPIC_API_KEY         // Claude API authentication
SOLANA_RPC_URL           // RPC endpoint
ORACLE_KEYPAIR_PATH      // Multisig oracle keypair
DATABASE_URL             // PostgreSQL connection
REDIS_URL                // Job queue backend
```

### 5. Monitoring Stack (`monitoring/`)

**Components**: Prometheus + Grafana + AlertManager
**Alert Coverage**: 30+ rules across severity levels

#### Prometheus Configuration
```yaml
scrape_targets:
  - api:3001                      # REST API metrics
  - solana-validator:8900         # Validator metrics
  - node-exporter:9100            # System metrics
  - postgres:5432                 # Database metrics
  - redis:6379                    # Cache metrics
  - contract-monitor:8080         # Smart contract metrics
```

#### Alert Rules (30+ total)

**Critical Severity**:
- APIServerDown - API unreachable
- OracleServiceDown - Sentiment analysis unavailable
- DatabaseConnectionPoolExhausted - DB connection limit reached
- SolanaSlotLagging - Validator falling behind network

**High Severity**:
- HighErrorRate - >10% API errors
- HighLatency - >2s response time
- TransactionFailures - >5% failed transactions
- VRFTimeouts - Randomness requests timing out

**Medium Severity**:
- DiskSpace - <10% free
- MemoryUsage - >85% utilized
- CPUUsage - >80% utilized

#### Alert Routing
- **Critical** → PagerDuty (immediate page)
- **High** → Slack (team-dev channel)
- **Oracle Alerts** → #oracle-operations
- **Contract Alerts** → #contract-monitoring
- **API Alerts** → #api-monitoring

---

## GitHub Actions CI/CD

### test.yml - Automated Testing (FIXED)
**Trigger**: Push to `main`, `develop`, `claude/*` branches; PR to main/develop

**Key Fixes Applied**:
- ✅ Uses Yarn instead of npm (matches Anchor.toml package_manager)
- ✅ Installs Solana CLI 1.18.0 (required for solana-test-validator)
- ✅ Installs Anchor CLI 0.32.1 (matches project version)
- ✅ Starts solana-test-validator before tests (critical for anchor test)
- ✅ Proper validator cleanup after tests (no zombie processes)
- ✅ Binary size check works on both Linux and macOS

**Jobs** (Parallel execution):
1. **test** - Run full test suite (45min timeout)
2. **clippy** - Rust linting (15min timeout)
3. **security-audit** - Cargo audit (10min timeout)
4. **build-verification** - Binary build test (15min timeout)

### deploy.yml - Deployment Pipeline
**Trigger**: Manual (workflow_dispatch)

**Parameters**:
- network: devnet | testnet | mainnet
- skip_tests: boolean
- dry_run: boolean (mainnet only)

**Jobs**:
1. **validate** - Pre-deployment checks
2. **tests** - Run full test suite
3. **deploy** - Execute deployment (network-specific)
4. **verify** - Post-deployment validation

---

## Branch Strategy

### Main Branches
- **`main`** - Production-ready code
  - Protected: requires passing CI/CD
  - Pull requests required from feature/fix branches
  - Merge strategy: squash or fast-forward
  - Latest: b93b92f (includes Phase 1-3 implementation)

- **`develop`** (future) - Integration branch
  - Pre-release testing
  - Daily development integration point
  - Optional for this project; currently using PR-based workflow

### Feature Branches
- **`claude/*`** - Claude Code AI development branches
  - Temporary branches for implementation features
  - Automatically tested by CI/CD
  - Merged via PR after review/approval
  - Deleted after merge

- **`codex/*`** - Codex-generated fixes (deprecated)
  - Legacy branches from previous implementation phases
  - Can be archived/deleted safely

### Branch Protection Rules (Recommended)
For `main` branch, configure:
```
✓ Require pull request reviews before merging (1 reviewer)
✓ Require status checks to pass (test.yml, deploy.yml)
✓ Require branches to be up to date before merging
✓ Dismiss stale pull request approvals
✓ Require code owners to review (optional)
```

---

## Development Workflow

### Local Setup
```bash
# 1. Clone repository
git clone https://github.com/HSSuthi/Opinion-Markets.git
cd Opinion-Markets

# 2. Install dependencies
yarn install
npm install -g @anchor-lang/cli@0.32.1
npm install -g @solana/cli@1.18.0

# 3. Build smart contract
anchor build

# 4. Run tests locally
anchor test

# 5. Start local devnet environment
docker-compose -f docker-compose.yml -p localnet up
```

### Feature Development
```bash
# 1. Create feature branch
git checkout -b feature/your-feature

# 2. Make changes & commit
git add .
git commit -m "Implement your feature"

# 3. Push & open PR
git push origin feature/your-feature
# Open PR on GitHub → describe changes → request review

# 4. Address review comments & merge
# After approval, squash merge to main

# 5. Delete feature branch
git branch -d feature/your-feature
```

### CI/CD Test Results
All commits to `main` and `claude/*` branches automatically run:
1. Rust compilation check
2. 15+ integration tests
3. Linting (rustfmt + Prettier)
4. Clippy strict analysis
5. Cargo security audit
6. Binary size verification

Test results visible at: GitHub Actions tab → workflow run

---

## Testing Strategy

### Unit Tests
- **Location**: `programs/opinion-market/tests/opinion-market.ts`
- **Framework**: Anchor test framework
- **Coverage**: 15+ test cases covering:
  - Market lifecycle (create → stake → close → settle)
  - VRF integration (request → fulfill → randomness)
  - Multi-sig oracle authority validation
  - Error conditions and edge cases
  - Token transfer validation

### Integration Tests
- **Location**: `scripts/validate-testnet.ts` (400 lines)
- **Scope**: Full market lifecycle on testnet
- **Validation**:
  - Account setup and USDC token creation
  - Market creation with proper constraints
  - Multi-staker opinion placement
  - Sentiment analysis integration
  - VRF randomness request/fulfillment
  - Market settlement with winner determination
  - Payout calculation and transfer

### Load Tests
- **Location**: `scripts/load-test.ts` (350 lines)
- **Configuration**: `--markets N --stakers M --concurrent C`
- **Measurements**:
  - Transaction throughput
  - Compute unit usage
  - Success/failure rates
  - Response latencies

### Performance Baseline
Testnet load test with:
- 3 markets
- 25 stakers per market
- 2 concurrent operations
- Results logged to stdout + metrics store

---

## Deployment Procedures

### Devnet (Local Development)
```bash
./scripts/deploy-devnet.sh
# Steps:
# 1. Verify wallet exists (~/.config/solana/id.json)
# 2. Configure Solana CLI to devnet
# 3. Airdrop SOL if balance < 1
# 4. Build smart contract
# 5. Deploy to local/devnet
# 6. Run initialization script
# 7. Generate .env.devnet
```

### Testnet (Public Testing)
```bash
SOLANA_KEYPAIR=/path/to/testnet/keypair ./scripts/deploy-testnet.sh
# Options: --skip-tests, --verbose
# Steps:
# 1. Validate SOLANA_KEYPAIR env var
# 2. Run full test suite
# 3. Build smart contract
# 4. Verify wallet balance (2+ SOL required)
# 5. Deploy to Solana testnet
# 6. Run validation tests
# 7. Execute load test baseline
# 8. Log all artifacts
```

### Mainnet (Production)
```bash
SOLANA_KEYPAIR=/path/to/mainnet/keypair ./scripts/deploy-mainnet.sh
# Safety features:
# - Pre-deployment checklist (9 items)
# - Requires explicit "DEPLOY" confirmation
# - Requires final "yes" confirmation
# - Dry-run support
# - Multi-sig oracle signature collection
# - Requires 5+ SOL for deployment + fees
```

---

## Security Considerations

### Smart Contract Security
- **Audit Scope**: 14KB comprehensive document (SECURITY_AUDIT_SCOPE.md)
- **Key Risk Areas**:
  1. Account validation and signer checks
  2. Arithmetic overflow/underflow
  3. Reentrancy in VRF callback
  4. Random number quality (Chainlink VRF)
  5. Oracle authority bypass vulnerabilities
  6. SPL token transfer validation
  7. Deadline enforcement for market operations
  8. PDA derivation and bump seed validation

### Recommended Audit Firms
- Trail of Bits (premium Solana expertise)
- Neodyme (Solana-focused)
- Open Zeppelin (general blockchain security)

### Estimated Timeline & Budget
- **Duration**: 1-2 weeks
- **Budget**: $10k - $25k
- **Deliverables**: Detailed audit report + remediation timeline

### API Security
- CORS restricted to approved domains
- Rate limiting per endpoint
- Request validation on all inputs
- SQL injection prevention (ORM usage)
- XSS protection (Next.js framework + DOMPurify)

### Operational Security
- Environment variables for sensitive data
- Private keypairs never in version control
- Secrets managed via GitHub Actions
- Encrypted database connections
- Audit logging for all transactions

---

## Production Readiness Checklist

### Code Quality
- [x] Smart contract compiles without warnings
- [x] All tests passing (15+ integration tests)
- [x] TypeScript strict mode enabled
- [x] ESLint/Prettier configured
- [x] Cargo clippy passes with -D warnings

### Testing
- [x] Unit tests implemented
- [x] Integration tests covering full workflow
- [x] Load testing baseline established
- [x] Local validator tests passing
- [x] CI/CD automated testing on every commit

### Documentation
- [x] SECURITY_AUDIT_SCOPE.md (audit requirements)
- [x] PHASE_1_IMPLEMENTATION.md (VRF, multi-sig)
- [x] PHASE_2_IMPLEMENTATION.md (CI/CD, Docker)
- [x] PHASE_3_IMPLEMENTATION.md (monitoring, oracle)
- [x] ORACLE_OPERATOR_RUNBOOK.md (operational procedures)
- [x] PRODUCTION_GUIDE.md (deployment guide)
- [x] REPOSITORY_STRUCTURE.md (architecture documentation)
- [x] PRODUCTION_DEPLOYMENT_CHECKLIST.md (verification checklist)
- [x] TESTING_GUIDE.md (testing procedures)

### Deployment Infrastructure
- [x] GitHub Actions workflows (test + deploy)
- [x] Docker containerization
- [x] Local development environment (docker-compose)
- [x] Deployment scripts (devnet, testnet, mainnet)
- [x] Monitoring stack (Prometheus + AlertManager)

### Monitoring & Observability
- [x] 30+ alert rules across severity levels
- [x] Prometheus metrics for all components
- [x] Structured logging (Pino) on API/oracle
- [x] Health check endpoints
- [x] Transaction success/failure tracking

### Frontend
- [x] Multi-wallet support (Phantom, Solflare, Brave)
- [x] Responsive design (mobile + desktop)
- [x] Market display and staking interface
- [x] User portfolio/history
- [x] Error handling and loading states

---

## Contact & Support

### For Security Auditing Firm
- **Audit Scope**: See SECURITY_AUDIT_SCOPE.md
- **Testing Environment**: Testnet RPC: https://api.testnet.solana.com
- **Contacts**: See repository GitHub issues / discussions
- **CI/CD Status**: GitHub Actions tab shows all test results

### For Developers
- **Documentation**: See README.md and PHASE_*_IMPLEMENTATION.md
- **Deployment Issues**: See PRODUCTION_GUIDE.md
- **Oracle Operations**: See ORACLE_OPERATOR_RUNBOOK.md
- **Local Development**: `docker-compose up` + `anchor test`
- **Testing Procedures**: See TESTING_GUIDE.md

### For Operations Team
- **Alert Routing**: See monitoring/alertmanager/alertmanager.yml
- **Runbook**: See ORACLE_OPERATOR_RUNBOOK.md
- **Health Checks**: `curl http://api:3001/health`
- **Monitoring**: Access Grafana dashboard (configured in docker-compose)

---

## Version Information

- **Smart Contract**: Anchor 0.32.1, Rust 1.89.0
- **API**: Node.js 18+, Express.js, TypeScript
- **Frontend**: Next.js 14+, React 18+, Tailwind CSS
- **Solana CLI**: 1.18.0
- **PostgreSQL**: 15+
- **Redis**: 7+
- **Prometheus**: 2.40+
- **Docker**: Latest stable

---

## License & Intellectual Property

[Add your license information here - e.g., MIT, Apache 2.0, or custom terms]

---

**Last Verified**: 2026-02-21
**Next Review**: After security audit completion
**Production Status**: READY FOR AUDIT
