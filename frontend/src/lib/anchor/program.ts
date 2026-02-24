/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Opinion Markets — On-Chain Program Reference
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Program ID: Read from NEXT_PUBLIC_PROGRAM_ID env var
 * Deployed on: Solana devnet (targeting mainnet-beta)
 * Framework: Anchor 0.32.x
 *
 * ── INSTRUCTIONS ────────────────────────────────────────────────────────────
 *
 * 1. initialize(oracle_authority, treasury)
 *    - Called once by deployer to set up ProgramConfig
 *    - Sets oracle_authority, treasury pubkey, and USDC mint
 *    - Accounts: deployer (signer, mut), config (PDA: ["config"]),
 *                usdc_mint, system_program
 *
 * 2. create_market(statement, duration_secs, uuid)
 *    - Creates a new opinion market. Costs $5 USDC paid to treasury.
 *    - Validates: statement non-empty & <= 280 chars,
 *                duration in {86400, 259200, 604800, 1209600}
 *    - Transfers CREATE_FEE (5_000_000 micro-USDC) from creator to treasury
 *    - PDA seeds: market = ["market", uuid], escrow = ["escrow", market.key()]
 *    - Accounts: creator (signer, mut), config (PDA), market (init, PDA),
 *                escrow_token_account (init, PDA), creator_usdc (mut),
 *                treasury_usdc (mut), usdc_mint, token_program, system_program, rent
 *
 * 3. stake_opinion(stake_amount, text_hash, ipfs_cid, prediction)
 *    - Stake $0.50–$10.00 USDC on a market with an opinion text + prediction
 *    - Validates: amount in [500_000, 10_000_000], ipfs_cid <= 64, prediction 0–100
 *    - Requires market Active and not expired
 *    - Transfers stake from staker to escrow
 *    - PDA seeds: opinion = ["opinion", market.key(), staker.key()]
 *    - Author's own stake counts as initial backing_total for Layer 1
 *    - Accounts: staker (signer, mut), config (PDA), market (mut, PDA),
 *                escrow_token_account (mut, PDA), opinion (init, PDA),
 *                staker_usdc (mut), token_program, system_program
 *
 * 4. react_to_opinion(reaction_type, stake_amount)
 *    - Back (agree) or Slash (disagree) another user's opinion
 *    - Layer 1 of Triple-Check scoring
 *    - Validates: amount in [500_000, 10_000_000], market Active, not own opinion
 *    - One reaction per (reactor, opinion) enforced by PDA
 *    - PDA seeds: reaction = ["reaction", opinion.key(), reactor.key()]
 *    - Accounts: reactor (signer, mut), config (PDA), market (mut, PDA),
 *                opinion (mut), reaction (init, PDA), escrow_token_account (mut, PDA),
 *                reactor_usdc (mut), token_program, system_program
 *
 * 5. close_market()
 *    - Permissionless — anyone can call after market.closes_at has passed
 *    - Transitions market from Active -> Closed
 *    - Accounts: caller (unchecked), market (mut, PDA)
 *
 * 6. record_sentiment(score, confidence, summary_hash)
 *    - Oracle-only: records market-level AI sentiment score
 *    - Validates: score 0–100, confidence 0–2 (low/medium/high)
 *    - Transitions market from Closed -> Scored
 *    - Accounts: oracle_authority (signer), config (PDA), market (mut, PDA)
 *
 * 7. record_ai_score(ai_score)
 *    - Oracle-only: records AI quality score for a single opinion (Layer 3)
 *    - Called once per opinion before settle_opinion
 *    - Validates: ai_score 0–100, market must be Scored
 *    - Accounts: oracle_authority (signer), config (PDA), market, opinion (mut)
 *
 * 8. settle_opinion(crowd_score, weight_score, consensus_score)
 *    - Oracle-only: applies Triple-Check formula to one opinion
 *    - S = (W * 50 + C * 30 + A * 20) / 100
 *    - Stores crowd_score on market (idempotent), weight + consensus on opinion
 *    - Computes combined_score from all three layers
 *    - Accounts: oracle_authority (signer), config (PDA), market (mut, PDA),
 *                opinion (mut)
 *
 * 9. finalize_settlement()
 *    - Oracle-only: called once after all opinions settled
 *    - Deducts 10% protocol fee, sends fee to treasury
 *    - Sets distributable_pool, transitions Scored -> Settled
 *    - Market PDA signs the escrow transfer
 *    - Accounts: oracle_authority (signer), config (PDA), market (mut, PDA),
 *                escrow_token_account (mut, PDA), treasury_usdc (mut), token_program
 *
 * 10. claim_payout(total_combined_score)
 *     - Staker claims proportional payout after settlement
 *     - payout = (combined_score / total_combined_score) * distributable_pool
 *     - Marks opinion as paid, sets winner on market if first claim
 *     - Market PDA signs the escrow transfer
 *     - Accounts: staker (signer, mut), config (PDA), market (mut, PDA),
 *                 escrow_token_account (mut, PDA), opinion (mut), staker_usdc (mut),
 *                 token_program
 *
 * 11. run_lottery(winner_pubkey)  [LEGACY — deprecated]
 *     - Single-winner distribution path kept for backward compatibility
 *     - New markets should use settle_opinion + claim_payout
 *     - Oracle-only
 *
 * 12. recover_stake()
 *     - Staker recovers stake if market abandoned (14+ days after close)
 *     - Market must not be Settled
 *     - Accounts: staker (signer, mut), config (PDA), market (PDA),
 *                 escrow_token_account (mut, PDA), opinion (PDA), staker_usdc (mut),
 *                 token_program
 *
 * ── VRF / LEGACY FLAG ──────────────────────────────────────────────────────
 *
 * The following are LEGACY artifacts from the Chainlink VRF integration that
 * has been replaced by multi-LLM consensus scoring:
 *
 * - MarketState::AwaitingRandomness — kept as enum variant for backward compat,
 *   never entered by current instructions
 * - VrfRequest account struct — no instruction creates these anymore
 * - VrfRandomnessRequestedEvent / VrfRandomnessFulfilledEvent — dead events
 * - run_lottery instruction — deprecated, use settle_opinion + claim_payout
 *
 * Before mainnet: Consider removing these dead variants in a program upgrade
 * to reduce account sizes and eliminate confusion. The AwaitingRandomness state
 * must be kept if any existing devnet markets are in that state (check first).
 *
 * ── ERROR CODES ────────────────────────────────────────────────────────────
 *
 * 6000 StatementEmpty         — Statement cannot be empty
 * 6001 StatementTooLong       — Statement exceeds 280 characters
 * 6002 InvalidDuration        — Duration must be 24h, 3d, 7d, or 14d
 * 6003 StakeTooSmall          — Stake amount must be at least $0.50 USDC
 * 6004 StakeTooLarge          — Stake amount cannot exceed $10.00 USDC
 * 6005 CidTooLong             — IPFS CID too long
 * 6006 MarketNotActive        — Market is not in Active state
 * 6007 MarketExpired          — Market has already expired
 * 6008 MarketNotExpired       — Market has not yet expired
 * 6009 MarketNotClosed        — Market is not in Closed state
 * 6010 MarketNotScored        — Market is not in Scored state
 * 6011 InvalidScore           — Score must be between 0 and 100
 * 6012 InvalidConfidence      — Confidence must be 0 (low), 1 (medium), or 2 (high)
 * 6013 InvalidPrediction      — Prediction must be between 0 and 100
 * 6014 Unauthorized           — Only the oracle may call this
 * 6015 MintMismatch           — USDC mint mismatch
 * 6016 TreasuryMismatch       — Treasury pubkey mismatch
 * 6017 EmptyPrizePool         — Prize pool is zero
 * 6018 MarketNotAwaitingRandomness — (legacy)
 * 6019 RandomnessNotReady     — (legacy)
 * 6020 CannotReactToOwnOpinion — Cannot react to your own opinion
 * 6021 MarketNotAwaitingSettlement — Market not settled
 * 6022 AlreadyPaid            — Payout has already been claimed
 * 6023 ZeroTotalScore         — Total combined score is zero
 * 6024 Overflow               — Arithmetic overflow
 *
 * ── CONSTANTS ──────────────────────────────────────────────────────────────
 *
 * CREATE_FEE:          5_000_000  ($5.00 USDC)
 * MIN_STAKE:             500_000  ($0.50 USDC)
 * MAX_STAKE:          10_000_000  ($10.00 USDC)
 * PROTOCOL_FEE_BPS:        1_000  (10%)
 * MAX_STATEMENT_LEN:         280  characters
 * MAX_IPFS_CID_LEN:           64  bytes
 * WEIGHT_MULTIPLIER:          50  (Layer 1: 50%)
 * CONSENSUS_MULTIPLIER:       30  (Layer 2: 30%)
 * AI_MULTIPLIER:              20  (Layer 3: 20%)
 * DURATION_24H:           86_400  seconds
 * DURATION_3D:           259_200  seconds
 * DURATION_7D:           604_800  seconds
 * DURATION_14D:        1_209_600  seconds
 * RECOVERY_PERIOD:    1_209_600  seconds (14 days)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { PublicKey } from '@solana/web3.js';
import { type Idl } from '@coral-xyz/anchor';
import { getNetworkConfig } from './config';

// Re-export the program ID as a PublicKey derived from env
export function getProgramId(): PublicKey {
  return new PublicKey(getNetworkConfig().programId);
}

// On-chain constants mirrored for the frontend
export const PROGRAM_CONSTANTS = {
  CREATE_FEE: 5_000_000,
  MIN_STAKE: 500_000,
  MAX_STAKE: 10_000_000,
  PROTOCOL_FEE_BPS: 1_000,
  MAX_STATEMENT_LEN: 280,
  MAX_IPFS_CID_LEN: 64,
  WEIGHT_MULTIPLIER: 50,
  CONSENSUS_MULTIPLIER: 30,
  AI_MULTIPLIER: 20,
  DURATION_24H: 86_400,
  DURATION_3D: 259_200,
  DURATION_7D: 604_800,
  DURATION_14D: 1_209_600,
  RECOVERY_PERIOD: 1_209_600,
} as const;

export const VALID_DURATIONS = [
  PROGRAM_CONSTANTS.DURATION_24H,
  PROGRAM_CONSTANTS.DURATION_3D,
  PROGRAM_CONSTANTS.DURATION_7D,
  PROGRAM_CONSTANTS.DURATION_14D,
] as const;

// Error code -> human-readable message map
// Anchor error codes start at 6000 for custom errors
export const PROGRAM_ERROR_MESSAGES: Record<number, string> = {
  6000: 'Statement cannot be empty',
  6001: 'Statement exceeds 280 characters',
  6002: 'Duration must be 24h, 3d, 7d, or 14d',
  6003: 'Stake amount must be at least $0.50 USDC',
  6004: 'Stake amount cannot exceed $10.00 USDC',
  6005: 'IPFS CID too long',
  6006: 'Market is not active',
  6007: 'Market has already expired',
  6008: 'Market has not expired yet',
  6009: 'Market is not closed',
  6010: 'Market is not in scored state',
  6011: 'Score must be between 0 and 100',
  6012: 'Confidence must be 0 (low), 1 (medium), or 2 (high)',
  6013: 'Prediction must be between 0 and 100',
  6014: 'Unauthorized — only the oracle may call this',
  6015: 'USDC mint mismatch — check your USDC token account',
  6016: 'Treasury address mismatch',
  6017: 'Prize pool is empty — no stakes to distribute',
  6018: 'Market is not awaiting randomness (legacy)',
  6019: 'VRF randomness not ready (legacy)',
  6020: 'You cannot react to your own opinion',
  6021: 'Market has not been settled yet',
  6022: 'Payout has already been claimed',
  6023: 'Total combined score is zero — cannot distribute',
  6024: 'Arithmetic overflow',
};

/**
 * The IDL for the Opinion Markets Anchor program.
 *
 * This is the minimal IDL required for the Anchor client to construct
 * instructions. It matches the deployed program at the program ID in env.
 */
export const IDL: Idl = {
  version: '0.1.0',
  name: 'opinion_market',
  address: getNetworkConfig().programId,
  metadata: {
    name: 'opinion_market',
    version: '0.1.0',
    spec: '0.1.0',
  },
  instructions: [
    {
      name: 'initialize',
      discriminator: [],
      accounts: [
        { name: 'deployer', isMut: true, isSigner: true },
        { name: 'config', isMut: true, isSigner: false },
        { name: 'usdcMint', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'oracleAuthority', type: 'publicKey' },
        { name: 'treasury', type: 'publicKey' },
      ],
    },
    {
      name: 'createMarket',
      discriminator: [],
      accounts: [
        { name: 'creator', isMut: true, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: true, isSigner: false },
        { name: 'escrowTokenAccount', isMut: true, isSigner: false },
        { name: 'creatorUsdc', isMut: true, isSigner: false },
        { name: 'treasuryUsdc', isMut: true, isSigner: false },
        { name: 'usdcMint', isMut: false, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
        { name: 'rent', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'statement', type: 'string' },
        { name: 'durationSecs', type: 'u64' },
        { name: 'uuid', type: { array: ['u8', 16] } },
      ],
    },
    {
      name: 'stakeOpinion',
      discriminator: [],
      accounts: [
        { name: 'staker', isMut: true, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: true, isSigner: false },
        { name: 'escrowTokenAccount', isMut: true, isSigner: false },
        { name: 'opinion', isMut: true, isSigner: false },
        { name: 'stakerUsdc', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'stakeAmount', type: 'u64' },
        { name: 'textHash', type: { array: ['u8', 32] } },
        { name: 'ipfsCid', type: 'string' },
        { name: 'prediction', type: 'u8' },
      ],
    },
    {
      name: 'reactToOpinion',
      discriminator: [],
      accounts: [
        { name: 'reactor', isMut: true, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: true, isSigner: false },
        { name: 'opinion', isMut: true, isSigner: false },
        { name: 'reaction', isMut: true, isSigner: false },
        { name: 'escrowTokenAccount', isMut: true, isSigner: false },
        { name: 'reactorUsdc', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'reactionType', type: { defined: 'ReactionType' } },
        { name: 'stakeAmount', type: 'u64' },
      ],
    },
    {
      name: 'closeMarket',
      discriminator: [],
      accounts: [
        { name: 'caller', isMut: false, isSigner: false },
        { name: 'market', isMut: true, isSigner: false },
      ],
      args: [],
    },
    {
      name: 'recordSentiment',
      discriminator: [],
      accounts: [
        { name: 'oracleAuthority', isMut: false, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: true, isSigner: false },
      ],
      args: [
        { name: 'score', type: 'u8' },
        { name: 'confidence', type: 'u8' },
        { name: 'summaryHash', type: { array: ['u8', 32] } },
      ],
    },
    {
      name: 'recordAiScore',
      discriminator: [],
      accounts: [
        { name: 'oracleAuthority', isMut: false, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: false, isSigner: false },
        { name: 'opinion', isMut: true, isSigner: false },
      ],
      args: [{ name: 'aiScore', type: 'u8' }],
    },
    {
      name: 'settleOpinion',
      discriminator: [],
      accounts: [
        { name: 'oracleAuthority', isMut: false, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: true, isSigner: false },
        { name: 'opinion', isMut: true, isSigner: false },
      ],
      args: [
        { name: 'crowdScore', type: 'u8' },
        { name: 'weightScore', type: 'u8' },
        { name: 'consensusScore', type: 'u8' },
      ],
    },
    {
      name: 'finalizeSettlement',
      discriminator: [],
      accounts: [
        { name: 'oracleAuthority', isMut: false, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: true, isSigner: false },
        { name: 'escrowTokenAccount', isMut: true, isSigner: false },
        { name: 'treasuryUsdc', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: 'claimPayout',
      discriminator: [],
      accounts: [
        { name: 'staker', isMut: true, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: true, isSigner: false },
        { name: 'escrowTokenAccount', isMut: true, isSigner: false },
        { name: 'opinion', isMut: true, isSigner: false },
        { name: 'stakerUsdc', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
      ],
      args: [{ name: 'totalCombinedScore', type: 'u64' }],
    },
    {
      name: 'runLottery',
      discriminator: [],
      accounts: [
        { name: 'oracleAuthority', isMut: false, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: true, isSigner: false },
        { name: 'escrowTokenAccount', isMut: true, isSigner: false },
        { name: 'winnerTokenAccount', isMut: true, isSigner: false },
        { name: 'treasuryUsdc', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
      ],
      args: [{ name: 'winnerPubkey', type: 'publicKey' }],
    },
    {
      name: 'recoverStake',
      discriminator: [],
      accounts: [
        { name: 'staker', isMut: true, isSigner: true },
        { name: 'config', isMut: false, isSigner: false },
        { name: 'market', isMut: false, isSigner: false },
        { name: 'escrowTokenAccount', isMut: true, isSigner: false },
        { name: 'opinion', isMut: false, isSigner: false },
        { name: 'stakerUsdc', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    { name: 'ProgramConfig', discriminator: [] },
    { name: 'Market', discriminator: [] },
    { name: 'Opinion', discriminator: [] },
    { name: 'Reaction', discriminator: [] },
    { name: 'VrfRequest', discriminator: [] },
  ],
  types: [
    {
      name: 'MarketState',
      type: {
        kind: 'enum',
        variants: [
          { name: 'Active' },
          { name: 'Closed' },
          { name: 'Scored' },
          { name: 'AwaitingRandomness' },
          { name: 'Settled' },
        ],
      },
    },
    {
      name: 'ReactionType',
      type: {
        kind: 'enum',
        variants: [{ name: 'Back' }, { name: 'Slash' }],
      },
    },
  ],
  errors: [
    { code: 6000, name: 'StatementEmpty', msg: 'Statement cannot be empty' },
    { code: 6001, name: 'StatementTooLong', msg: 'Statement exceeds 280 characters' },
    { code: 6002, name: 'InvalidDuration', msg: 'Duration must be 24h, 3d, 7d, or 14d' },
    { code: 6003, name: 'StakeTooSmall', msg: 'Stake amount must be at least $0.50 USDC' },
    { code: 6004, name: 'StakeTooLarge', msg: 'Stake amount cannot exceed $10.00 USDC' },
    { code: 6005, name: 'CidTooLong', msg: 'IPFS CID too long' },
    { code: 6006, name: 'MarketNotActive', msg: 'Market is not in Active state' },
    { code: 6007, name: 'MarketExpired', msg: 'Market has already expired' },
    { code: 6008, name: 'MarketNotExpired', msg: 'Market has not yet expired' },
    { code: 6009, name: 'MarketNotClosed', msg: 'Market is not in Closed state' },
    { code: 6010, name: 'MarketNotScored', msg: 'Market is not in Scored state' },
    { code: 6011, name: 'InvalidScore', msg: 'Score must be between 0 and 100' },
    { code: 6012, name: 'InvalidConfidence', msg: 'Confidence must be 0–2' },
    { code: 6013, name: 'InvalidPrediction', msg: 'Prediction must be between 0 and 100' },
    { code: 6014, name: 'Unauthorized', msg: 'Only the oracle may call this' },
    { code: 6015, name: 'MintMismatch', msg: 'USDC mint mismatch' },
    { code: 6016, name: 'TreasuryMismatch', msg: 'Treasury pubkey mismatch' },
    { code: 6017, name: 'EmptyPrizePool', msg: 'Prize pool is zero' },
    { code: 6018, name: 'MarketNotAwaitingRandomness', msg: 'Market not awaiting randomness' },
    { code: 6019, name: 'RandomnessNotReady', msg: 'VRF randomness not ready' },
    { code: 6020, name: 'CannotReactToOwnOpinion', msg: 'Cannot react to your own opinion' },
    { code: 6021, name: 'MarketNotAwaitingSettlement', msg: 'Market not settled' },
    { code: 6022, name: 'AlreadyPaid', msg: 'Payout already claimed' },
    { code: 6023, name: 'ZeroTotalScore', msg: 'Total combined score is zero' },
    { code: 6024, name: 'Overflow', msg: 'Arithmetic overflow' },
  ],
};
