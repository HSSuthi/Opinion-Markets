# Opinion-Markets: Security Audit Scope

## Program Overview

**Program Name:** Opinion Market
**Language:** Rust (Anchor Framework 0.32.1)
**Network:** Solana
**Program ID (Devnet):** `2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu`
**Codebase:** [Opinion-Markets](https://github.com/HSSuthi/Opinion-Markets)
**Mainnet Timeline:** Post-audit deployment

---

## Executive Summary

Opinion-Markets is a decentralized opinion prediction market platform on Solana. Users create binary opinion statements, stake USDC on possible outcomes, and winners are determined by oracle-provided sentiment analysis using LLM technology. The smart contract manages market creation, stake collection, sentiment recording, and prize distribution.

**Current Status:** 70% production-ready (devnet deployment complete, mainnet blockers: security audit + Chainlink VRF)

---

## Scope of Audit

### In-Scope Components

#### 1. Smart Contract Core (`programs/opinion-market/src/lib.rs` - 750 lines)

**Arithmetic Safety**
- Fee calculations (line 370-380): CREATE_FEE ($5 USDC), MIN/MAX stake ($0.50-$10), PROTOCOL_FEE_BPS (10%)
- Prize pool computation: `total_stake - protocol_fee`
- Saturating arithmetic usage in staker counter and total stake tracking (line 331-332)
- Verify no overflow/underflow in fee calculations with edge cases (e.g., single $0.50 stake)

**Token Transfer Safety**
- USDC token transfers via SPL Token CPI (line 245-253, 304-313, 437-446, 449-458, 504-513)
- Escrow token account authority model (market PDA as authority)
- Prize distribution logic with signer seeds (line 433-434)

**Authorization & Access Control**
- Single oracle keypair constraint in `record_sentiment()` (line 654) and `run_lottery()` (line 671)
- Creator validation in market creation (line 259)
- Staker validation in opinion creation (line 630)
- Permissionless `close_market()` (line 641)
- Escape hatch recovery (line 484-486: requires 14-day post-close window)

**State Machine Enforcement**
- Market state transitions: Active → Closed → Scored → Settled (line 67-72)
- Validation on state transitions (lines 300-301, 352-353, 380, 415)
- Prevent double-settling or out-of-order operations

**PDA Security**
- Market PDA seed: `[b"market", uuid.as_ref()]` (line 554)
- Escrow PDA seed: `[b"escrow", market.key().as_ref()]` (line 565)
- Opinion PDA seed: `[b"opinion", market.key().as_ref(), staker.key().as_ref()]` (line 621)
- Config PDA seed: `[b"config"]` (line 532)
- Verify deterministic PDA derivation and uniqueness

**Input Validation**
- Statement length: max 280 chars (line 15, 238)
- IPFS CID length: max 64 chars (line 16, 295)
- Duration validation: must be one of 4 preset values (line 240-241)
- Score range: 0-100 (line 376)
- Confidence range: 0-2 (line 377)
- Stake amount bounds: $0.50-$10 (line 293-294)

**Account Validation**
- Mint validation on all token operations (line 573, 586, 629, 703)
- Treasury ownership verification (line 582, 704)
- Token account ownership checks (line 575, 630, 743-744)
- Escrow account authority validation (line 564)
- Winner token account validation (line 410-411)

#### 2. Account Data Structures

**ProgramConfig** (line 125-139)
- `oracle: Pubkey` — single oracle keypair (security concern for mainnet)
- `treasury: Pubkey` — protocol fee receiver
- `usdc_mint: Pubkey` — USDC token address
- Space allocation: 8 + 32 + 32 + 32 + 1 = 105 bytes
- Verify PDA uniqueness and immutability of config once deployed

**Market** (line 142-181)
- UUID provides per-creator market uniqueness
- State enum guards against invalid transitions
- Prize distribution requires valid `winner` selection
- Space: 8 + 32 + 16 + 4+280 + 8 + 8 + 1 + 4 + 8 + 1 + 1 + 32 + 1+32 + 1 = 477 bytes
- Verify no integer overflow in space calculations

**Opinion** (line 184-208)
- Stake accountability via text_hash (SHA-256)
- IPFS CID for off-chain opinion storage
- Space: 8 + 32 + 32 + 8 + 32 + 4+64 + 8 + 1 = 189 bytes

#### 3. Events

**MarketCreatedEvent** (line 76-84)
- Emitted when market created (line 275-281)
- Verify event ordering and consistency

**OpinionStakedEvent** (line 87-94)
- Emitted when opinion staked (line 336-342)
- Critical for off-chain indexing

**MarketClosedEvent** (line 97-103)
- Emitted when market transitions to Closed (line 359-364)

**SentimentRecordedEvent** (line 106-112)
- Emitted when oracle records sentiment (line 389-394)

**LotterySettledEvent** (line 115-121)
- Emitted when prize distributed (line 466-471)

#### 4. Error Codes (13 errors)

Verify proper error usage and prevent unintended error code reuse/collisions.

---

### Out-of-Scope Components

- **Oracle Service:** Separate Node.js/Python service; not part of this audit (pending Phase 3.2)
- **Chainlink VRF Integration:** Will be added post-audit; can be audited in follow-up (Phase 1.2)
- **Multi-Sig Oracle Authority:** Will be added post-audit; can be audited in follow-up (Phase 1.3)
- **Frontend:** HTML/CSS/JavaScript prototype; no security implications for contract
- **API Server:** REST API will be audited separately if added (Phase 2.4)
- **Monitoring & Logging:** Infrastructure not in scope

---

## Key Risk Areas (Priority Order)

### 🔴 Critical (Must Pass)

1. **Arithmetic Safety in Fee Calculations**
   - File: `lib.rs:370-424`
   - Risk: Overflow/underflow in protocol_fee and prize_pool computation
   - Test cases:
     - Single $0.50 stake (MIN_STAKE)
     - Maximum $10,000,000 total stake (multiple stakers)
     - Edge case: 1 micro-USDC stake
   - Mitigation: Uses `checked_mul`, `checked_div`, `.unwrap()` — verify no panic paths

2. **Oracle Authority Validation**
   - File: `lib.rs:654, 671`
   - Risk: Single oracle keypair is centralized; oracle can select arbitrary winner
   - Current: Devnet only; mainnet will require Chainlink VRF (Phase 1.2) + multi-sig (Phase 1.3)
   - Note: Not a critical vulnerability for current scope, but critical path for mainnet

3. **Prize Distribution Logic**
   - File: `lib.rs:399-474`
   - Risk: Winner validation, double-settlement, fund loss
   - Verify:
     - `run_lottery()` can only be called once per market (state == Scored guard)
     - Prize calculation cannot result in lost funds (protocol_fee + prize_pool == total_stake)
     - Escrow token account correctly has market as authority

4. **PDA Seed Validation**
   - File: `lib.rs:554, 565, 621, 532`
   - Risk: Account substitution, unauthorized access
   - Verify:
     - Correct seed derivation in all contexts
     - PDA collision impossibility
     - Bump seed usage is correct

### 🟡 High (Should Pass)

5. **Token Transfer Authorization**
   - File: `lib.rs:245-313, 437-458, 504-513`
   - Risk: Unauthorized fund movement
   - Verify:
     - CPI context authority correct for all transfers
     - Mint constraints on all token accounts
     - Escrow account correctly locks funds until settlement or recovery

6. **State Machine Integrity**
   - File: `lib.rs:67-72, 300-301, 352-353, 380, 415`
   - Risk: Market stuck in invalid state or invalid transitions
   - Verify:
     - No way to skip Closed → Scored → Settled transitions
     - Permissionless close_market() cannot be exploited
     - Escape hatch recovery (14-day window) cannot be triggered prematurely

7. **Input Validation Completeness**
   - File: `lib.rs:237-242, 293-295, 376-377`
   - Risk: Invalid states persisted on-chain
   - Verify:
     - All require!() conditions are correct
     - No way to create market with invalid duration, statement, or stake bounds
     - IPFS CID validation prevents DOS via oversized strings

### 🟢 Medium (Nice-to-Have)

8. **Escape Hatch Safety**
   - File: `lib.rs:476-517`
   - Risk: Unintended fund recovery
   - Verify:
     - 14-day window correctly enforced
     - Only stakers can recover their own stake
     - Cannot recover from Settled markets

---

## Testing Requirements

### Unit Test Coverage (Target: >95%)

Should include:
- Happy path: Create market → stake → close → sentiment → settle
- Authorization failures: Non-oracle cannot call record_sentiment/run_lottery
- Invalid inputs: Bad statement length, stake amounts, durations
- State machine: Verify no out-of-order transitions
- Edge cases: Single staker, maximum stakes, minimum stakes, zero fees
- Escape hatch: Verify 14-day window and recovery logic

### Integration Test Scenarios

Should include:
- Multi-staker market: 10+ stakers with varying stake amounts
- Prize accuracy: Verify winner receives (total_stake - protocol_fee)
- Event verification: Confirm all events emitted in correct order
- Concurrent markets: Multiple markets settling simultaneously

---

## Recommended Audit Firms

Based on Solana ecosystem expertise:
- **Trail of Bits** — Deep Rust/Anchor expertise
- **Neodyme** — Solana-specific security leader
- **Open Zeppelin** — Established smart contract auditors
- **Soteria** — Solana-focused security provider

---

## Audit Deliverables

1. **Security Report:** Executive summary + detailed findings
2. **Risk Classification:** Critical/High/Medium/Low for each finding
3. **Proof of Concept:** Exploit code for critical/high findings
4. **Remediation Recommendations:** Fix suggestions for each finding
5. **Re-audit:** Follow-up review after fixes applied

---

## Timeline & Budget Estimate

- **Audit Duration:** 1-2 weeks (depends on firm)
- **Cost Estimate:** $10k-$25k (varies by firm)
- **Remediation Time:** 1 week (estimated)
- **Re-audit:** 2-3 days

---

## Next Steps for Maintainer

1. **Select Audit Firm** (Week 1)
   - Get proposals from 2-3 firms above
   - Compare cost, timeline, expertise

2. **Finalize Scope** (Week 1)
   - Share this document with selected firm
   - Agree on timeline and deliverables

3. **Prepare Code for Audit** (Week 1)
   - Ensure `lib.rs` is clean (no TODO comments except mainnet ones)
   - Add code documentation/comments for complex logic
   - Run `cargo audit` to identify dependency vulnerabilities
   - Set up audit repository access

4. **Implement Fixes** (Week 2-3)
   - Address all critical/high findings
   - Document fixes with commit messages
   - Create detailed remediation document

5. **Re-audit & Approval** (Week 4)
   - Final review by firm
   - Sign off on mainnet readiness

---

## Mainnet Launch Blockers

This audit **unblocks:**
- Smart contract deployment to Solana Mainnet
- Beta launch with controlled user access

This audit **does not** unblock:
- **Chainlink VRF Integration** (Phase 1.2) — Requires separate review
- **Multi-Sig Oracle Authority** (Phase 1.3) — Requires separate review
- **Public launch** — Requires all three Phase 1 items complete

---

## Appendix: Code Statistics

- **Total Lines:** 750
- **Comments:** ~60 lines (8%)
- **Executable Code:** 690 lines
- **Test Coverage:** 80% (19 test cases in `tests/opinion-market.ts`)
- **Dependencies:** 4 (anchor_lang, anchor_spl, spl-token, solana-program)
- **Rust Edition:** 2021
- **MSRV:** 1.89.0 (from `rust-toolchain.toml`)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-21
**Status:** Ready for audit engagement
