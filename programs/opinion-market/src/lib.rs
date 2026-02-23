use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu");

// ── Constants ────────────────────────────────────────────────────────────────
/// $5.00 USDC (6 decimal places)
pub const CREATE_FEE: u64 = 5_000_000;
/// $0.50 USDC
pub const MIN_STAKE: u64 = 500_000;
/// $10.00 USDC
pub const MAX_STAKE: u64 = 10_000_000;
/// 10% protocol fee on prize pool
pub const PROTOCOL_FEE_BPS: u64 = 1_000;
pub const MAX_STATEMENT_LEN: usize = 280;
pub const MAX_IPFS_CID_LEN: usize = 64;

/// Triple-Check scoring formula weights (must sum to 100)
/// S = (W × 0.5) + (C × 0.3) + (A × 0.2)
pub const WEIGHT_MULTIPLIER: u64 = 50;     // 50% — Layer 1: peer backing
pub const CONSENSUS_MULTIPLIER: u64 = 30;  // 30% — Layer 2: crowd alignment
pub const AI_MULTIPLIER: u64 = 20;         // 20% — Layer 3: AI quality

/// Duration options in seconds
pub const DURATION_24H: u64 = 86_400;
pub const DURATION_3D: u64 = 259_200;
pub const DURATION_7D: u64 = 604_800;
pub const DURATION_14D: u64 = 1_209_600;
/// Time after market closes before stakers can recover stakes (14 days)
pub const RECOVERY_PERIOD: i64 = 1_209_600;

// ── Errors ───────────────────────────────────────────────────────────────────
#[error_code]
pub enum OpinionError {
    #[msg("Statement cannot be empty")]
    StatementEmpty,
    #[msg("Statement exceeds 280 characters")]
    StatementTooLong,
    #[msg("Duration must be 24h, 3d, 7d, or 14d")]
    InvalidDuration,
    #[msg("Stake amount must be at least $0.50 USDC")]
    StakeTooSmall,
    #[msg("Stake amount cannot exceed $10.00 USDC")]
    StakeTooLarge,
    #[msg("IPFS CID too long")]
    CidTooLong,
    #[msg("Market is not in Active state")]
    MarketNotActive,
    #[msg("Market has already expired")]
    MarketExpired,
    #[msg("Market has not yet expired")]
    MarketNotExpired,
    #[msg("Market is not in Closed state")]
    MarketNotClosed,
    #[msg("Market is not in Scored state")]
    MarketNotScored,
    #[msg("Score must be between 0 and 100")]
    InvalidScore,
    #[msg("Confidence must be 0 (low), 1 (medium), or 2 (high)")]
    InvalidConfidence,
    #[msg("Prediction must be between 0 and 100")]
    InvalidPrediction,
    #[msg("Unauthorized — only the oracle may call this")]
    Unauthorized,
    #[msg("USDC mint mismatch")]
    MintMismatch,
    #[msg("Treasury pubkey mismatch")]
    TreasuryMismatch,
    #[msg("Prize pool is zero — no stakes to distribute")]
    EmptyPrizePool,
    #[msg("Market is not in AwaitingRandomness state")]
    MarketNotAwaitingRandomness,
    #[msg("VRF randomness has not been provided yet")]
    RandomnessNotReady,
    #[msg("Cannot react to your own opinion")]
    CannotReactToOwnOpinion,
    #[msg("Market is not in Scored state awaiting settlement")]
    MarketNotAwaitingSettlement,
    #[msg("Payout has already been claimed")]
    AlreadyPaid,
    #[msg("Total combined score is zero — cannot distribute")]
    ZeroTotalScore,
    #[msg("Arithmetic overflow")]
    Overflow,
}

// ── State Enums ──────────────────────────────────────────────────────────────
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketState {
    Active,
    Closed,
    Scored,             // Awaiting Triple-Check settlement
    AwaitingRandomness, // Legacy: kept for backward compatibility
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ReactionType {
    Back,   // Agree — adds to backing_total
    Slash,  // Disagree — adds to slashing_total
}

// ── Events ────────────────────────────────────────────────────────────────────

#[event]
pub struct MarketCreatedEvent {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub statement: String,
    pub closes_at: i64,
    pub duration_secs: u64,
}

#[event]
pub struct OpinionStakedEvent {
    pub market: Pubkey,
    pub staker: Pubkey,
    pub stake_amount: u64,
    pub prediction: u8,
    pub ipfs_cid: String,
    pub total_stake_after: u64,
}

#[event]
pub struct ReactionSubmittedEvent {
    pub market: Pubkey,
    pub opinion: Pubkey,
    pub reactor: Pubkey,
    pub reaction_type: ReactionType,
    pub stake_amount: u64,
}

#[event]
pub struct MarketClosedEvent {
    pub market: Pubkey,
    pub closed_at: i64,
    pub total_stakers: u32,
    pub total_stake: u64,
}

#[event]
pub struct SentimentRecordedEvent {
    pub market: Pubkey,
    pub sentiment_score: u8,
    pub confidence: u8,
    pub summary_hash: [u8; 32],
}

#[event]
pub struct AiScoreRecordedEvent {
    pub market: Pubkey,
    pub opinion: Pubkey,
    pub staker: Pubkey,
    pub ai_score: u8,
}

#[event]
pub struct OpinionSettledEvent {
    pub market: Pubkey,
    pub opinion: Pubkey,
    pub staker: Pubkey,
    pub weight_score: u8,
    pub consensus_score: u8,
    pub ai_score: u8,
    pub combined_score: u8,
}

#[event]
pub struct MarketFinalizedEvent {
    pub market: Pubkey,
    pub total_pool: u64,
    pub distributable_pool: u64,
    pub protocol_fee: u64,
    pub crowd_score: u8,
}

#[event]
pub struct PayoutClaimedEvent {
    pub market: Pubkey,
    pub opinion: Pubkey,
    pub staker: Pubkey,
    pub payout_amount: u64,
    pub combined_score: u8,
}

#[event]
pub struct LotterySettledEvent {
    pub market: Pubkey,
    pub winner: Pubkey,
    pub prize_amount: u64,
    pub protocol_fee: u64,
}

#[event]
pub struct VrfRandomnessRequestedEvent {
    pub market: Pubkey,
    pub vrf_request_id: u64,
    pub request_timestamp: i64,
}

#[event]
pub struct VrfRandomnessFulfilledEvent {
    pub market: Pubkey,
    pub vrf_request_id: u64,
    pub randomness: [u8; 32],
}

// ── Account Structs ──────────────────────────────────────────────────────────

/// Global program configuration — initialized once by deployer
#[account]
pub struct ProgramConfig {
    pub oracle_authority: Pubkey,
    pub treasury: Pubkey,
    pub usdc_mint: Pubkey,
    pub bump: u8,
}

impl ProgramConfig {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 1;
}

/// A single opinion market
#[account]
pub struct Market {
    pub creator: Pubkey,
    pub uuid: [u8; 16],
    pub statement: String,
    pub created_at: i64,
    pub closes_at: i64,
    pub state: MarketState,
    pub staker_count: u32,
    /// Total USDC staked in micro-USDC (6 decimals) — includes reactions
    pub total_stake: u64,
    /// Portion available after protocol fee (set at finalize_settlement)
    pub distributable_pool: u64,
    /// Volume-weighted mean of all agreement predictions (set at settlement)
    pub crowd_score: u8,
    /// Market-level AI sentiment score 0–100 (set by record_sentiment)
    pub sentiment_score: u8,
    /// 0 = low, 1 = medium, 2 = high
    pub confidence: u8,
    /// SHA-256 of the LLM summary string
    pub summary_hash: [u8; 32],
    /// Highest-earning staker (set after settlement for display)
    pub winner: Option<Pubkey>,
    pub bump: u8,
}

impl Market {
    pub const SPACE: usize =
        8   // discriminator
        + 32  // creator
        + 16  // uuid
        + 4 + MAX_STATEMENT_LEN // statement String
        + 8   // created_at
        + 8   // closes_at
        + 1   // state enum tag
        + 4   // staker_count
        + 8   // total_stake
        + 8   // distributable_pool
        + 1   // crowd_score
        + 1   // sentiment_score
        + 1   // confidence
        + 32  // summary_hash
        + 1 + 32 // winner: Option<Pubkey>
        + 1;  // bump
}

/// A single staked opinion — extended with Triple-Check scoring fields
#[account]
pub struct Opinion {
    pub market: Pubkey,
    pub staker: Pubkey,
    /// Amount staked in micro-USDC
    pub stake_amount: u64,
    /// SHA-256 of opinion text (integrity proof)
    pub text_hash: [u8; 32],
    /// IPFS CID pointing to full opinion text
    pub ipfs_cid: String,
    pub created_at: i64,

    // ── Layer 2: Crowd Prediction ────────────────────────────────────────────
    /// User's 0–100 agreement prediction submitted with stake
    pub prediction: u8,

    // ── Layer 1: Peer Backing ────────────────────────────────────────────────
    /// Total USDC staked to Back (agree with) this opinion
    pub backing_total: u64,
    /// Total USDC staked to Slash (disagree with) this opinion
    pub slashing_total: u64,

    // ── Triple-Check Scores (set by oracle at settlement) ────────────────────
    /// Layer 1 score: normalized net backing (0–100)
    pub weight_score: u8,
    /// Layer 2 score: closeness to crowd_score (0–100)
    pub consensus_score: u8,
    /// Layer 3 score: AI text quality rating (0–100)
    pub ai_score: u8,
    /// Final composite: W*50 + C*30 + A*20 stored as 0–100 (divide by 100 from 0–10000)
    pub combined_score: u8,

    // ── Payout ───────────────────────────────────────────────────────────────
    pub payout_amount: u64,
    pub paid: bool,

    pub bump: u8,
}

impl Opinion {
    pub const SPACE: usize =
        8   // discriminator
        + 32  // market
        + 32  // staker
        + 8   // stake_amount
        + 32  // text_hash
        + 4 + MAX_IPFS_CID_LEN // ipfs_cid
        + 8   // created_at
        + 1   // prediction
        + 8   // backing_total
        + 8   // slashing_total
        + 1   // weight_score
        + 1   // consensus_score
        + 1   // ai_score
        + 1   // combined_score
        + 8   // payout_amount
        + 1   // paid
        + 1;  // bump
}

/// Tracks a Back or Slash reaction from one user to another's opinion
#[account]
pub struct Reaction {
    pub opinion: Pubkey,
    pub reactor: Pubkey,
    pub reaction_type: ReactionType,
    pub stake_amount: u64,
    pub bump: u8,
}

impl Reaction {
    pub const SPACE: usize = 8 + 32 + 32 + 1 + 8 + 1;
}

/// Tracks a pending Chainlink VRF randomness request (legacy)
#[account]
pub struct VrfRequest {
    pub market: Pubkey,
    pub request_id: u64,
    pub randomness: Option<[u8; 32]>,
    pub requested_at: i64,
    pub fulfilled_at: Option<i64>,
    pub bump: u8,
}

impl VrfRequest {
    pub const SPACE: usize =
        8   // discriminator
        + 32  // market
        + 8   // request_id
        + 1 + 32 // randomness: Option<[u8; 32]>
        + 8   // requested_at
        + 1 + 8 // fulfilled_at: Option<i64>
        + 1;  // bump
}

// ── Program ──────────────────────────────────────────────────────────────────
#[program]
pub mod opinion_market {
    use super::*;

    /// Initialize global config — called once by deployer
    pub fn initialize(
        ctx: Context<InitializeConfig>,
        oracle_authority: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.oracle_authority = oracle_authority;
        config.treasury = treasury;
        config.usdc_mint = ctx.accounts.usdc_mint.key();
        config.bump = ctx.bumps.config;
        msg!("ProgramConfig initialized: oracle_authority={} treasury={}", oracle_authority, treasury);
        Ok(())
    }

    /// Create a new opinion market. Costs $5 USDC paid to treasury.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        statement: String,
        duration_secs: u64,
        uuid: [u8; 16],
    ) -> Result<()> {
        require!(!statement.is_empty(), OpinionError::StatementEmpty);
        require!(statement.len() <= MAX_STATEMENT_LEN, OpinionError::StatementTooLong);
        require!(
            matches!(duration_secs, DURATION_24H | DURATION_3D | DURATION_7D | DURATION_14D),
            OpinionError::InvalidDuration
        );

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.creator_usdc.to_account_info(),
                to: ctx.accounts.treasury_usdc.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, CREATE_FEE)?;

        let clock = Clock::get()?;
        let market_key = ctx.accounts.market.key();
        let statement_for_event = statement.clone();
        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.uuid = uuid;
        market.statement = statement;
        market.created_at = clock.unix_timestamp;
        market.closes_at = clock.unix_timestamp + duration_secs as i64;
        market.state = MarketState::Active;
        market.staker_count = 0;
        market.total_stake = 0;
        market.distributable_pool = 0;
        market.crowd_score = 0;
        market.sentiment_score = 0;
        market.confidence = 0;
        market.summary_hash = [0u8; 32];
        market.winner = None;
        market.bump = ctx.bumps.market;

        emit!(MarketCreatedEvent {
            market: market_key,
            creator: ctx.accounts.creator.key(),
            statement: statement_for_event,
            closes_at: market.closes_at,
            duration_secs,
        });

        Ok(())
    }

    /// Stake a USDC-backed opinion on a market ($0.50–$10).
    /// Now includes a 0–100 agreement prediction for the crowd consensus layer.
    pub fn stake_opinion(
        ctx: Context<StakeOpinion>,
        stake_amount: u64,
        text_hash: [u8; 32],
        ipfs_cid: String,
        prediction: u8,
    ) -> Result<()> {
        require!(stake_amount >= MIN_STAKE, OpinionError::StakeTooSmall);
        require!(stake_amount <= MAX_STAKE, OpinionError::StakeTooLarge);
        require!(ipfs_cid.len() <= MAX_IPFS_CID_LEN, OpinionError::CidTooLong);
        require!(prediction <= 100, OpinionError::InvalidPrediction);

        let clock = Clock::get()?;
        {
            let market = &ctx.accounts.market;
            require!(market.state == MarketState::Active, OpinionError::MarketNotActive);
            require!(clock.unix_timestamp < market.closes_at, OpinionError::MarketExpired);
        }

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.staker_usdc.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.staker.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, stake_amount)?;

        let market_key = ctx.accounts.market.key();
        let staker_key = ctx.accounts.staker.key();
        let ipfs_cid_for_event = ipfs_cid.clone();

        let opinion = &mut ctx.accounts.opinion;
        opinion.market = market_key;
        opinion.staker = staker_key;
        opinion.stake_amount = stake_amount;
        opinion.text_hash = text_hash;
        opinion.ipfs_cid = ipfs_cid.clone();
        opinion.created_at = clock.unix_timestamp;
        opinion.prediction = prediction;
        // Author's own stake counts as initial backing for Layer 1
        opinion.backing_total = stake_amount;
        opinion.slashing_total = 0;
        opinion.weight_score = 0;
        opinion.consensus_score = 0;
        opinion.ai_score = 0;
        opinion.combined_score = 0;
        opinion.payout_amount = 0;
        opinion.paid = false;
        opinion.bump = ctx.bumps.opinion;

        let market = &mut ctx.accounts.market;
        market.total_stake = market.total_stake.saturating_add(stake_amount);
        market.staker_count = market.staker_count.saturating_add(1);
        let total_stake_after = market.total_stake;

        emit!(OpinionStakedEvent {
            market: market_key,
            staker: staker_key,
            stake_amount,
            prediction,
            ipfs_cid: ipfs_cid_for_event,
            total_stake_after,
        });

        Ok(())
    }

    /// Back or Slash another user's opinion — Layer 1 of the Triple-Check.
    /// Reactor's stake goes into the escrow and affects the opinion's weight score.
    pub fn react_to_opinion(
        ctx: Context<ReactToOpinion>,
        reaction_type: ReactionType,
        stake_amount: u64,
    ) -> Result<()> {
        require!(stake_amount >= MIN_STAKE, OpinionError::StakeTooSmall);
        require!(stake_amount <= MAX_STAKE, OpinionError::StakeTooLarge);

        let clock = Clock::get()?;
        {
            let market = &ctx.accounts.market;
            require!(market.state == MarketState::Active, OpinionError::MarketNotActive);
            require!(clock.unix_timestamp < market.closes_at, OpinionError::MarketExpired);
        }

        // Cannot react to your own opinion
        require!(
            ctx.accounts.reactor.key() != ctx.accounts.opinion.staker,
            OpinionError::CannotReactToOwnOpinion
        );

        // Transfer reaction stake into market escrow
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.reactor_usdc.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.reactor.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, stake_amount)?;

        let market_key = ctx.accounts.market.key();
        let opinion_key = ctx.accounts.opinion.key();
        let reactor_key = ctx.accounts.reactor.key();
        let reaction_type_for_event = reaction_type.clone();

        // Update opinion's backing or slashing total
        let opinion = &mut ctx.accounts.opinion;
        match reaction_type {
            ReactionType::Back => {
                opinion.backing_total = opinion.backing_total
                    .checked_add(stake_amount)
                    .ok_or(OpinionError::Overflow)?;
            }
            ReactionType::Slash => {
                opinion.slashing_total = opinion.slashing_total
                    .checked_add(stake_amount)
                    .ok_or(OpinionError::Overflow)?;
            }
        }

        // Store reaction record (one per reactor per opinion — enforced by PDA seeds)
        let reaction = &mut ctx.accounts.reaction;
        reaction.opinion = opinion_key;
        reaction.reactor = reactor_key;
        reaction.reaction_type = reaction_type.clone();
        reaction.stake_amount = stake_amount;
        reaction.bump = ctx.bumps.reaction;

        // Add to market total pool
        let market = &mut ctx.accounts.market;
        market.total_stake = market.total_stake
            .checked_add(stake_amount)
            .ok_or(OpinionError::Overflow)?;

        emit!(ReactionSubmittedEvent {
            market: market_key,
            opinion: opinion_key,
            reactor: reactor_key,
            reaction_type: reaction_type_for_event,
            stake_amount,
        });

        Ok(())
    }

    /// Close a market after its duration expires. Permissionless.
    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        let clock = Clock::get()?;
        let market_key = ctx.accounts.market.key();
        let market = &mut ctx.accounts.market;
        require!(market.state == MarketState::Active, OpinionError::MarketNotActive);
        require!(clock.unix_timestamp >= market.closes_at, OpinionError::MarketNotExpired);
        market.state = MarketState::Closed;
        let staker_count = market.staker_count;
        let total_stake = market.total_stake;

        emit!(MarketClosedEvent {
            market: market_key,
            closed_at: clock.unix_timestamp,
            total_stakers: staker_count,
            total_stake,
        });

        Ok(())
    }

    /// Oracle records the market-level AI sentiment score.
    /// Also transitions the market to Scored (ready for per-opinion settlement).
    pub fn record_sentiment(
        ctx: Context<RecordSentiment>,
        score: u8,
        confidence: u8,
        summary_hash: [u8; 32],
    ) -> Result<()> {
        require!(score <= 100, OpinionError::InvalidScore);
        require!(confidence <= 2, OpinionError::InvalidConfidence);

        let market = &mut ctx.accounts.market;
        require!(market.state == MarketState::Closed, OpinionError::MarketNotClosed);

        market.sentiment_score = score;
        market.confidence = confidence;
        market.summary_hash = summary_hash;
        market.state = MarketState::Scored;

        emit!(SentimentRecordedEvent {
            market: ctx.accounts.market.key(),
            sentiment_score: score,
            confidence,
            summary_hash,
        });

        Ok(())
    }

    /// Oracle records the AI quality score for a single opinion — Layer 3.
    /// Called once per opinion before settle_opinion.
    pub fn record_ai_score(
        ctx: Context<RecordAiScore>,
        ai_score: u8,
    ) -> Result<()> {
        require!(ai_score <= 100, OpinionError::InvalidScore);

        let market = &ctx.accounts.market;
        require!(market.state == MarketState::Scored, OpinionError::MarketNotScored);

        let opinion = &mut ctx.accounts.opinion;
        opinion.ai_score = ai_score;

        emit!(AiScoreRecordedEvent {
            market: ctx.accounts.market.key(),
            opinion: ctx.accounts.opinion.key(),
            staker: opinion.staker,
            ai_score,
        });

        Ok(())
    }

    /// Oracle settles a single opinion by applying the Triple-Check formula.
    /// Called once per opinion after all AI scores are recorded.
    ///
    /// Oracle computes off-chain:
    ///   crowd_score = Σ(prediction_i × amount_i) / Σ(amount_i)
    ///   weight_score_i = max(5, (netBacking_i - minNet) / range × 95 + 5)
    ///   consensus_score_i = max(0, 100 - |prediction_i - crowd_score|)
    ///
    /// On-chain we compute:
    ///   combined_bps = weight*50 + consensus*30 + ai*20  (range 0–10000)
    ///   combined_score = combined_bps / 100              (stored 0–100)
    pub fn settle_opinion(
        ctx: Context<SettleOpinion>,
        crowd_score: u8,
        weight_score: u8,
        consensus_score: u8,
    ) -> Result<()> {
        require!(crowd_score <= 100, OpinionError::InvalidScore);
        require!(weight_score <= 100, OpinionError::InvalidScore);
        require!(consensus_score <= 100, OpinionError::InvalidScore);

        let market = &mut ctx.accounts.market;
        require!(market.state == MarketState::Scored, OpinionError::MarketNotScored);

        // Store crowd_score on market — idempotent, same value every call
        market.crowd_score = crowd_score;

        let opinion = &mut ctx.accounts.opinion;
        opinion.weight_score = weight_score;
        opinion.consensus_score = consensus_score;

        // S = (W × 0.5) + (C × 0.3) + (A × 0.2)
        // Computed as integer basis points (0–10000), then divided by 100
        let combined_bps: u64 =
            (weight_score as u64)
                .checked_mul(WEIGHT_MULTIPLIER)
                .ok_or(OpinionError::Overflow)?
            .checked_add(
                (consensus_score as u64)
                    .checked_mul(CONSENSUS_MULTIPLIER)
                    .ok_or(OpinionError::Overflow)?
            )
            .ok_or(OpinionError::Overflow)?
            .checked_add(
                (opinion.ai_score as u64)
                    .checked_mul(AI_MULTIPLIER)
                    .ok_or(OpinionError::Overflow)?
            )
            .ok_or(OpinionError::Overflow)?;

        opinion.combined_score = (combined_bps / 100) as u8;

        emit!(OpinionSettledEvent {
            market: ctx.accounts.market.key(),
            opinion: ctx.accounts.opinion.key(),
            staker: opinion.staker,
            weight_score,
            consensus_score,
            ai_score: opinion.ai_score,
            combined_score: opinion.combined_score,
        });

        Ok(())
    }

    /// Oracle calls this once after all opinions are settled.
    /// Deducts protocol fee, stores distributable_pool, transitions to Settled.
    /// Also sends protocol fee to treasury.
    pub fn finalize_settlement(ctx: Context<FinalizeSettlement>) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.state == MarketState::Scored, OpinionError::MarketNotScored);
        require!(market.total_stake > 0, OpinionError::EmptyPrizePool);

        let total_stake = market.total_stake;
        let protocol_fee = total_stake
            .checked_mul(PROTOCOL_FEE_BPS)
            .ok_or(OpinionError::Overflow)?
            .checked_div(10_000)
            .ok_or(OpinionError::Overflow)?;
        let distributable_pool = total_stake
            .checked_sub(protocol_fee)
            .ok_or(OpinionError::Overflow)?;

        // Send protocol fee to treasury
        let market_uuid = market.uuid;
        let market_bump = market.bump;
        let seeds: &[&[u8]] = &[b"market", &market_uuid, &[market_bump]];
        let signer_seeds = &[seeds];

        let fee_cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.treasury_usdc.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(fee_cpi, protocol_fee)?;

        let market_key = ctx.accounts.market.key();
        let market = &mut ctx.accounts.market;
        market.distributable_pool = distributable_pool;
        market.state = MarketState::Settled;

        emit!(MarketFinalizedEvent {
            market: market_key,
            total_pool: total_stake,
            distributable_pool,
            protocol_fee,
            crowd_score: market.crowd_score,
        });

        Ok(())
    }

    /// Staker claims their proportional payout after settlement.
    /// payout = (combined_score / total_combined_score) × distributable_pool
    ///
    /// total_combined_score is passed by the oracle (computed off-chain from all opinions).
    pub fn claim_payout(
        ctx: Context<ClaimPayout>,
        total_combined_score: u64,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.state == MarketState::Settled, OpinionError::MarketNotAwaitingSettlement);

        let opinion = &ctx.accounts.opinion;
        require!(!opinion.paid, OpinionError::AlreadyPaid);
        require!(total_combined_score > 0, OpinionError::ZeroTotalScore);

        let distributable_pool = market.distributable_pool;
        let combined_score = opinion.combined_score as u64;

        // payout = combined_score × distributable_pool / total_combined_score
        let payout = combined_score
            .checked_mul(distributable_pool)
            .ok_or(OpinionError::Overflow)?
            .checked_div(total_combined_score)
            .ok_or(OpinionError::Overflow)?;

        let market_uuid = market.uuid;
        let market_bump = market.bump;
        let seeds: &[&[u8]] = &[b"market", &market_uuid, &[market_bump]];
        let signer_seeds = &[seeds];

        let payout_cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.staker_usdc.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(payout_cpi, payout)?;

        let opinion = &mut ctx.accounts.opinion;
        opinion.payout_amount = payout;
        opinion.paid = true;

        // If this is the highest-earning staker, record as market winner for display
        let market = &mut ctx.accounts.market;
        if market.winner.is_none() {
            market.winner = Some(opinion.staker);
        }

        emit!(PayoutClaimedEvent {
            market: ctx.accounts.market.key(),
            opinion: ctx.accounts.opinion.key(),
            staker: opinion.staker,
            payout_amount: payout,
            combined_score: opinion.combined_score,
        });

        Ok(())
    }

    /// Distribute prize pool (legacy single-winner path).
    /// Kept for backward compatibility. New markets should use settle_opinion + claim_payout.
    pub fn run_lottery(ctx: Context<RunLottery>, winner_pubkey: Pubkey) -> Result<()> {
        require!(
            ctx.accounts.winner_token_account.owner == winner_pubkey,
            OpinionError::Unauthorized
        );

        let market = &ctx.accounts.market;
        require!(market.state == MarketState::Scored, OpinionError::MarketNotScored);
        require!(market.total_stake > 0, OpinionError::EmptyPrizePool);

        let total_stake = market.total_stake;
        let protocol_fee = total_stake
            .checked_mul(PROTOCOL_FEE_BPS)
            .unwrap()
            .checked_div(10_000)
            .unwrap();
        let prize_pool = total_stake.checked_sub(protocol_fee).unwrap();

        let market_uuid = market.uuid;
        let market_bump = market.bump;
        let seeds: &[&[u8]] = &[b"market", &market_uuid, &[market_bump]];
        let signer_seeds = &[seeds];

        let fee_cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.treasury_usdc.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(fee_cpi, protocol_fee)?;

        let prize_cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.winner_token_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(prize_cpi, prize_pool)?;

        let market = &mut ctx.accounts.market;
        market.winner = Some(winner_pubkey);
        market.state = MarketState::Settled;

        emit!(LotterySettledEvent {
            market: ctx.accounts.market.key(),
            winner: winner_pubkey,
            prize_amount: prize_pool,
            protocol_fee,
        });

        Ok(())
    }

    /// Allow stakers to recover their stake if market is abandoned (14+ days after close).
    pub fn recover_stake(ctx: Context<RecoverStake>) -> Result<()> {
        let clock = Clock::get()?;
        let market = &ctx.accounts.market;

        require!(
            clock.unix_timestamp >= market.closes_at + RECOVERY_PERIOD,
            OpinionError::MarketNotExpired
        );
        require!(
            market.state != MarketState::Settled,
            OpinionError::MarketNotActive
        );

        let opinion = &ctx.accounts.opinion;
        let stake_amount = opinion.stake_amount;

        let market_uuid = market.uuid;
        let market_bump = market.bump;
        let seeds: &[&[u8]] = &[b"market", &market_uuid, &[market_bump]];
        let signer_seeds = &[seeds];

        let recovery_cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.staker_usdc.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(recovery_cpi, stake_amount)?;

        msg!("Stake recovered: staker={} amount={}", ctx.accounts.staker.key(), stake_amount);

        Ok(())
    }
}

// ── Account Contexts ─────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub deployer: Signer<'info>,

    #[account(
        init,
        payer = deployer,
        space = ProgramConfig::SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, ProgramConfig>,

    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(statement: String, duration_secs: u64, uuid: [u8; 16])]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        init,
        payer = creator,
        space = Market::SPACE,
        seeds = [b"market", uuid.as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = creator,
        token::mint = usdc_mint,
        token::authority = market,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = creator_usdc.owner == creator.key(),
    )]
    pub creator_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = treasury_usdc.owner == config.treasury @ OpinionError::TreasuryMismatch,
    )]
    pub treasury_usdc: Account<'info, TokenAccount>,

    #[account(constraint = usdc_mint.key() == config.usdc_mint @ OpinionError::MintMismatch)]
    pub usdc_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct StakeOpinion<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = staker,
        space = Opinion::SPACE,
        seeds = [b"opinion", market.key().as_ref(), staker.key().as_ref()],
        bump,
    )]
    pub opinion: Account<'info, Opinion>,

    #[account(
        mut,
        constraint = staker_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = staker_usdc.owner == staker.key(),
    )]
    pub staker_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReactToOpinion<'info> {
    #[account(mut)]
    pub reactor: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        constraint = opinion.market == market.key(),
    )]
    pub opinion: Account<'info, Opinion>,

    /// One reaction per (reactor, opinion) — enforced by PDA seeds
    #[account(
        init,
        payer = reactor,
        space = Reaction::SPACE,
        seeds = [b"reaction", opinion.key().as_ref(), reactor.key().as_ref()],
        bump,
    )]
    pub reaction: Account<'info, Reaction>,

    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = reactor_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = reactor_usdc.owner == reactor.key(),
    )]
    pub reactor_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    /// CHECK: permissionless — anyone can call after expiry
    pub caller: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct RecordSentiment<'info> {
    #[account(constraint = oracle_authority.key() == config.oracle_authority @ OpinionError::Unauthorized)]
    pub oracle_authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct RecordAiScore<'info> {
    #[account(constraint = oracle_authority.key() == config.oracle_authority @ OpinionError::Unauthorized)]
    pub oracle_authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    pub market: Account<'info, Market>,

    #[account(
        mut,
        constraint = opinion.market == market.key(),
    )]
    pub opinion: Account<'info, Opinion>,
}

#[derive(Accounts)]
pub struct SettleOpinion<'info> {
    #[account(constraint = oracle_authority.key() == config.oracle_authority @ OpinionError::Unauthorized)]
    pub oracle_authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        constraint = opinion.market == market.key(),
    )]
    pub opinion: Account<'info, Opinion>,
}

#[derive(Accounts)]
pub struct FinalizeSettlement<'info> {
    #[account(constraint = oracle_authority.key() == config.oracle_authority @ OpinionError::Unauthorized)]
    pub oracle_authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = treasury_usdc.owner == config.treasury @ OpinionError::TreasuryMismatch,
    )]
    pub treasury_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = opinion.market == market.key(),
        constraint = opinion.staker == staker.key() @ OpinionError::Unauthorized,
    )]
    pub opinion: Account<'info, Opinion>,

    #[account(
        mut,
        constraint = staker_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = staker_usdc.owner == staker.key(),
    )]
    pub staker_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RunLottery<'info> {
    #[account(constraint = oracle_authority.key() == config.oracle_authority @ OpinionError::Unauthorized)]
    pub oracle_authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = winner_token_account.mint == config.usdc_mint @ OpinionError::MintMismatch,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = treasury_usdc.owner == config.treasury @ OpinionError::TreasuryMismatch,
    )]
    pub treasury_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RecoverStake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"opinion", market.key().as_ref(), staker.key().as_ref()],
        bump = opinion.bump,
    )]
    pub opinion: Account<'info, Opinion>,

    #[account(
        mut,
        constraint = staker_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = staker_usdc.owner == staker.key(),
    )]
    pub staker_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
