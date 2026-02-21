# Oracle Operator Runbook

**Version:** 1.0
**Date:** 2026-02-21
**Audience:** Oracle Authority Signers (Squads V3 Multi-Sig Members)

---

## Overview

This runbook provides step-by-step procedures for oracle operators managing the Opinion-Markets multi-sig authority on Solana mainnet.

**Key Points:**
- Oracle authority is a **3-of-5 multi-sig** (Squads V3)
- No single signer can initiate oracle operations
- All operations require **threshold approval** (≥3 signers)
- Multi-sig transactions are **time-locked** (5-10 second delay) for safety

---

## Role & Responsibilities

### As an Oracle Signer, You Must:

1. **Maintain Key Security**
   - Store signer key on hardware wallet (Ledger/Trezor)
   - Keep encrypted backup on airgapped device
   - Never share private key or seed phrase
   - Rotate key annually

2. **Monitor Markets**
   - Check dashboard daily for markets nearing expiry
   - Identify which markets require sentiment analysis
   - Coordinate with team on analysis schedule

3. **Approve Transactions**
   - Log in to Squads V3 dashboard
   - Review proposed transactions carefully
   - Approve/reject based on validation criteria
   - Sign with hardware wallet when authorized

4. **Respond to Emergencies**
   - Available for urgent market settlements
   - Monitor Slack/Discord for alerts
   - Commit to response time: <1 hour

---

## Multi-Sig Setup (Reference)

### Signer Configuration

```
Squad Name:          Opinion-Markets Oracle
Network:             Solana Mainnet
Threshold:           3-of-5 (minimum 3 signatures required)
Timelock:            5 seconds (safety delay after approval)

Signers:
1. Alice (Engineering Lead)     - Core team
2. Bob (Operations Lead)         - Core team
3. Charlie (Security Lead)       - Core team
4. Diana (Business Dev)          - Business team
5. Eve (External Advisor)        - Security partner
```

### Key Management

| Signer | Wallet Type | Storage | Backup |
|--------|-------------|---------|--------|
| Alice | Ledger Nano S Plus | Physical safe | Encrypted USB (airgapped) |
| Bob | Trezor Model T | Personal safe | Encrypted USB (airgapped) |
| Charlie | Ledger Nano X | Company safe | Encrypted USB (airgapped) |
| Diana | Ledger Nano S | Office safe | Encrypted USB (office) |
| Eve | Trezor One | Personal safe | Encrypted USB (airgapped) |

---

## Sentiment Analysis Workflow

### Step 1: Monitor Market Expiry

**When to Start:** Market approaches `closes_at` timestamp

**Check:**
```bash
# On API or dashboard
GET /markets/{market_id}

# Look for:
- closes_at: timestamp (when market closes)
- closes_in: 2 hours, 30 minutes (relative time)
- state: "Active" (open for staking)
```

**Action:** Notify oracle team when <4 hours remaining

---

### Step 2: Prepare for Settlement

**After market expires (unix_timestamp > market.closes_at):**

1. **Close Market** (Permissionless)
   ```bash
   # Anyone can call this; market becomes "Closed"
   solana send-transaction \
     --url mainnet-beta \
     --keypair deployer.json \
     <close_market_instruction>
   ```
   - Market state: `Active` → `Closed`
   - Ready for sentiment analysis

2. **Collect Opinions** (Async)
   - Retrieve all `Opinion` accounts for market
   - Download from IPFS (stored in `ipfs_cid`)
   - Compile list of all staker opinions

**Example Opinion Data:**
```json
{
  "market_id": "ai_safety_2026",
  "statement": "Will AI be more advanced than humans by 2030?",
  "opinions": [
    {
      "staker": "Addr1...",
      "stake_amount": "$10.00",
      "opinion": "No, AI needs more breakthroughs in reasoning..."
    },
    {
      "staker": "Addr2...",
      "stake_amount": "$5.00",
      "opinion": "Likely yes, given current acceleration..."
    }
  ]
}
```

---

### Step 3: Perform Sentiment Analysis

**Who:** Oracle service (runs LLM analysis)

**Process:**
1. Send compiled opinions to Claude/GPT-4 API
2. Request sentiment analysis: 0-100 score
3. Calculate confidence: 0 (low) / 1 (medium) / 2 (high)
4. Generate summary hash (SHA-256 of analysis)

**Example Output:**
```json
{
  "sentiment_score": 72,
  "confidence": 2,
  "summary_hash": "0x3f4a2b1c...",
  "reasoning": "Majority believe yes (70%+), with moderate confidence..."
}
```

---

### Step 4: Record Sentiment (Multi-Sig Transaction)

**Caller:** Oracle service / automation (or manual if needed)

**Transaction:**
```solana
program.methods.recordSentiment(
  sentiment_score: 72,
  confidence: 2,
  summary_hash: [0x3f, 0x4a, 0x2b, 0x1c, ...]
)
.accounts({
  oracle_authority: squads_multisig_address,  // 3-of-5 multi-sig
  config: config_pda,
  market: market_pda,
})
```

**In Squads V3 Dashboard:**

1. Navigate to: **Squads** → **Opinion-Markets Oracle**
2. Click: **Create Transaction**
3. **Paste IDL:** Opinion Market program IDL
4. **Select Instruction:** `recordSentiment`
5. **Fill Parameters:**
   - `sentiment_score`: 72
   - `confidence`: 2
   - `summary_hash`: [hash bytes]
6. **Select Signers:** Account = oracle_authority
7. **Submit:** Creates pending transaction

**Approval Process:**

1. **Notification:** All 5 signers receive notification
2. **Review:** Signers log in and review transaction
3. **Voting:**
   - ✅ Approve (signer 1, 2, 3...)
   - ❌ Reject (if issues found)
4. **Threshold:** Once 3-of-5 approve → **Execute**
   - Squads broadcasts to blockchain
   - Market state: `Closed` → `Scored`

**Timeline:**
- Manual approval: 15-30 minutes (during business hours)
- Automated approval: <1 minute (if fully configured)

---

### Step 5: Request VRF Randomness

**Caller:** Oracle service (after `recordSentiment` succeeds)

**Transaction:**
```solana
program.methods.requestVrfRandomness()
.accounts({
  oracle_authority: squads_multisig_address,
  config: config_pda,
  market: market_pda,
  vrf_request: vrf_request_pda,
  system_program: system_program,
})
```

**In Squads V3:**

1. **Create Transaction** (same process)
2. **Select Instruction:** `requestVrfRandomness`
3. **No Parameters** (instruction is parameter-less)
4. **Submit & Approve** (3-of-5 threshold)

**What Happens:**
- `VrfRequest` account created
- Chainlink VRF contract called (CPI)
- Market state: `Scored` → `AwaitingRandomness`
- Request ID generated

**Timeline:**
- Execution: Immediate (multi-sig approved)
- VRF Callback: 10-30 seconds (Chainlink network)

---

### Step 6: Wait for VRF Callback

**Chainlink VRF Fulfillment (Automated)**

- No action required from oracle signers
- Chainlink service calls `fulfillVrfRandomness()`
- Market receives 32-byte random value
- `VrfRequest.randomness` populated
- Ready for lottery settlement

**Monitor:**
```bash
# Check VRF request status
solana account <vrf_request_account_address> \
  --url mainnet-beta

# Look for:
- fulfilled_at: timestamp (when randomness received)
- randomness: [32-byte array]
```

**Typical Wait:** 10-30 seconds

---

### Step 7: Settle Lottery with VRF

**Caller:** Oracle service / automation

**Transaction:**
```solana
program.methods.runLotteryWithVrf(
  winner_pubkey: selected_winner
)
.accounts({
  oracle_authority: squads_multisig_address,
  config: config_pda,
  market: market_pda,
  vrf_request: vrf_request_pda,
  escrow_token_account: escrow_pda,
  winner_token_account: winner_ata,
  treasury_usdc: treasury_ata,
  token_program: token_program,
})
```

**In Squads V3:**

1. **Create Transaction**
2. **Select Instruction:** `runLotteryWithVrf`
3. **Fill Parameters:**
   - `winner_pubkey`: [selected staker address]
4. **Submit & Approve** (3-of-5 threshold)

**Execution Steps:**
1. Validates VRF randomness fulfilled
2. Calculates protocol fee (10% of total stake)
3. Calculates prize pool (90% of total stake)
4. Transfers fee → treasury
5. Transfers prize → winner
6. Market state: `AwaitingRandomness` → `Settled`
7. Emits `LotterySettledEvent`

**Verification:**
```bash
# Check final market state
solana account <market_account_address> --url mainnet-beta

# Verify:
- state: "Settled"
- winner: [winner_pubkey]

# Check winner balance
solana balance <winner_address> --url mainnet-beta
# Should increase by prize amount
```

---

## Approval Checklist

Before approving any multi-sig transaction, verify:

### ✅ Pre-Approval Checks

- [ ] **Transaction Type**: Is this a recognized instruction?
  - ✅ recordSentiment
  - ✅ requestVrfRandomness
  - ✅ runLotteryWithVrf
  - ❌ Other instructions (reject)

- [ ] **Signer Account**: Is `oracle_authority` correct?
  - Must match `config.oracle_authority`
  - Not a personal address
  - Not a deployer address

- [ ] **Market Exists**: Is the market address valid?
  - Check blockchain: `solana account <market_pda>`
  - Verify market state progression
  - Confirm no double-settlements

- [ ] **Parameters Make Sense**:
  - Sentiment score: 0-100 ✅
  - Confidence: 0, 1, or 2 ✅
  - Winner pubkey: Valid Solana address ✅

- [ ] **Timing**: Is the market ready?
  - `recordSentiment`: Market state = "Closed"
  - `requestVrfRandomness`: Market state = "Scored"
  - `runLotteryWithVrf`: Market state = "AwaitingRandomness" + randomness ready

- [ ] **No Malicious Activity**:
  - Winner is legitimate staker (not attacker address)
  - No attempts to steal funds
  - No double-settlements

### ⚠️ Reject If:

- ❌ Signer account is wrong
- ❌ Unknown/unfamiliar market
- ❌ Parameters out of range (score >100, etc)
- ❌ Market in wrong state (e.g., trying to record sentiment twice)
- ❌ Suspicious winner address (never interacted with market)
- ❌ Any red flag activity

---

## Voting & Approval

### How to Approve Transaction

**In Squads V3 Dashboard:**

1. **Log In**
   - Visit: https://app.squads.so
   - Connect wallet with signer key
   - Select Squad: "Opinion-Markets Oracle"

2. **Find Pending Transaction**
   - Navigate: **Transactions** → **Pending**
   - Review transaction details
   - Perform pre-approval checks (above)

3. **Approve**
   - Click: **Approve**
   - Hardware wallet prompts for signature
   - Confirm on device (press buttons)
   - Transaction signed

4. **Monitor Status**
   - Repeat for other signers
   - Once 3-of-5 approved → **Ready to Execute**
   - Click: **Execute**
   - Transaction broadcasts to blockchain

**Timeline:**
- Approval: 2 minutes (per signer)
- Total (3 signers): ~6 minutes
- Blockchain confirmation: 5-10 seconds

### How to Reject Transaction

If issues found during review:

1. **Click: Reject**
2. **Provide Reason** (optional but recommended):
   - "Winner not in market"
   - "Sentiment score invalid"
   - "Market already settled"
3. **All Signers See Rejection**
   - If majority rejects → Transaction cancelled
   - Proposer must investigate issue

---

## Emergency Procedures

### Scenario 1: Hung Market (No Settlement After 14 Days)

**Situation:** Market closed but never settled (VRF failed, etc.)

**Recovery:**
1. Stakers can recover stakes via `recover_stake()` (escape hatch)
   - 14-day waiting period enforced
   - Permissionless instruction
   - No oracle approval needed
2. No action required from oracle signers

---

### Scenario 2: Incorrect Sentiment Recorded

**Situation:** Sentiment score wrong (typo, wrong market, etc.)

**Current:** No update instruction exists
- Cannot change recorded sentiment
- Market proceeds with incorrect sentiment
- Consider this for future upgrade

**Prevention:**
- **Double-check before approving:** Verify sentiment matches analysis
- **Have team review:** Don't approve alone in Squads

---

### Scenario 3: VRF Callback Stuck

**Situation:** Chainlink VRF doesn't callback within 5 minutes

**Diagnosis:**
```bash
# Check VRF request account
solana account <vrf_request_pda> --url mainnet-beta

# If randomness is null after 5 minutes:
# - Chainlink network issue (rare)
# - Check Chainlink status: https://status.chain.link
```

**Resolution:**
1. **Wait**: Chainlink usually catches up
2. **Check Status**: Monitor Chainlink dashboard
3. **Escalate**: If >30 minutes, contact Chainlink support
4. **Fallback**: Use original `run_lottery()` with oracle-selected winner
   - Not ideal (less decentralized)
   - But prevents market stuck indefinitely

---

### Scenario 4: Lost Signer Key

**Situation:** One signer's hardware wallet destroyed/lost

**Immediate:**
- Notify oracle team immediately
- Do NOT panic; 3-of-5 still functional
- Locked out signer cannot block transactions (only 2 rejections possible)

**Recovery (Within 1 Week):**
1. **Signer Replacement Proposal** (in Squads)
   - Create new transaction: "Replace Signer 4"
   - Vote to remove lost signer
   - Vote to add new signer
   - Requires 3-of-5 approval

2. **New Signer Onboarding**
   - Generate new keypair on hardware wallet
   - Add to Squads as new signer
   - Back up signer key (encrypted)

3. **Verify**: Test new signer on dummy transaction

---

### Scenario 5: Signer Compromise (Key Leak)

**Situation:** One signer's private key exposed (accidental)

**Immediate:**
1. **Do NOT use that key again**
2. **Notify Oracle Team** in private channel
3. **Isolate Hardware Wallet**
   - Disconnect from internet
   - Do not use for any transactions

**Within 24 Hours:**
1. **Emergency Signer Replacement**
   - Create Squads transaction to replace signer
   - Vote on replacement immediately
   - Remove compromised signer
2. **New Signer Setup** (same as above)
3. **Audit:**
   - Check blockchain for unauthorized transactions
   - If found, halt all operations

---

## Troubleshooting

### Issue: "Unauthorized" Error on Approval

**Cause:** Signer account doesn't match `config.oracle_authority`

**Fix:**
1. Check Squads Squad address
2. Verify it matches deployed program config
3. If wrong address: Create NEW transaction with correct signer
4. Delete malformed transaction

### Issue: Transaction Stuck (Timeout)

**Cause:** Network congestion or Solana issues

**Fix:**
1. Wait 30 seconds
2. Refresh Squads dashboard
3. Check https://status.solana.com
4. If persistent: Try again in 10 minutes
5. Contact ops team if >1 hour

### Issue: Hardware Wallet Not Connecting

**Cause:** USB connection, driver, or firmware issue

**Fix:**
1. Try different USB cable
2. Restart hardware wallet (power cycle)
3. Ensure latest firmware on wallet
4. Try on different computer
5. Ask teammate to sign instead (3-of-5 doesn't require you)

### Issue: Can't Find Pending Transaction in Squads

**Cause:** Scroll/pagination issue

**Fix:**
1. Refresh page (F5)
2. Check **Transactions** → **Pending** tab
3. Filter by market address
4. Check **Executed** tab (if already approved)
5. Ask ops team for transaction link

---

## Security Best Practices

### DO ✅

- ✅ **Store key securely** on hardware wallet
- ✅ **Keep backup key** on encrypted, airgapped device
- ✅ **Review before signing** (read all transaction details)
- ✅ **Sign with hardware wallet** (not software wallet)
- ✅ **Respond promptly** to urgent requests
- ✅ **Report compromises** immediately
- ✅ **Use VPN/secure internet** when approving
- ✅ **Rotate keys annually**

### DON'T ❌

- ❌ **Share private key** or seed phrase (ever)
- ❌ **Sign unknown transactions** without review
- ❌ **Use software wallet** for signing (security risk)
- ❌ **Approve on public WiFi** (security risk)
- ❌ **Reuse passwords** across platforms
- ❌ **Store backup key** on internet-connected device
- ❌ **Blame other signers** for rejections
- ❌ **Rush approvals** (take 2 minutes to review)

---

## Communication

### Slack Channels

- `#oracle-operations` - Daily updates
- `#oracle-urgent` - Emergency alerts (1 hour response time)
- `#oracle-security` - Security incidents

### On-Call Schedule

```
Week 1:  Alice + Bob
Week 2:  Charlie + Diana
Week 3:  Eve + Alice
Week 4:  Bob + Charlie
(Rotates monthly)
```

**On-Call Duties:**
- Monitor Slack for alerts
- Respond to urgent requests <1 hour
- Be available for emergency settlements

### Escalation

```
Tier 1:  Any oracle signer (45 min response)
Tier 2:  Operations lead (30 min response)
Tier 3:  CEO (15 min response)
Tier 4:  Pause all operations (decision by 3-of-5 vote)
```

---

## Checklists

### Daily Checklist

- [ ] Check for new pending transactions
- [ ] Approve if valid (use pre-approval checklist)
- [ ] Monitor #oracle-urgent for alerts
- [ ] Verify settled markets (if possible)

### Weekly Checklist

- [ ] Review transaction history
- [ ] Check signer key status (still secure)
- [ ] Verify no unauthorized activity
- [ ] Attend oracle sync meeting

### Monthly Checklist

- [ ] Rotate on-call schedule
- [ ] Review security practices
- [ ] Audit Squads transaction log
- [ ] Backup signer key (encrypted)
- [ ] Verify Chainlink VRF subscription funded

### Quarterly Checklist

- [ ] Security audit of keys
- [ ] Update contact information
- [ ] Plan annual signer rotation
- [ ] Review access logs

---

## References

### Documentation
- Smart Contract: `programs/opinion-market/src/lib.rs`
- Implementation Details: `PHASE_1_IMPLEMENTATION.md`
- Security Audit: `SECURITY_AUDIT_SCOPE.md`

### External Links
- Squads V3: https://squads.so
- Chainlink VRF: https://chain.link/vrf
- Solana Status: https://status.solana.com
- Chainlink Status: https://status.chain.link

### Useful Commands

```bash
# Check market state
solana account <market_pda> --url mainnet-beta --output json | jq '.data | @base64d'

# Check VRF request status
solana account <vrf_request_pda> --url mainnet-beta

# Check oracle authority
solana account <config_pda> --url mainnet-beta | grep oracle_authority

# Verify multi-sig address
squads show-wallet <squad_address>
```

---

## Support

**Need Help?**
- Post in `#oracle-operations` on Slack
- Direct message ops lead
- Email: ops@opinion-markets.xyz
- Emergency: Call number in team contacts (shared privately)

---

**Document Version:** 1.0
**Last Updated:** 2026-02-21
**Next Review:** 2026-03-21
