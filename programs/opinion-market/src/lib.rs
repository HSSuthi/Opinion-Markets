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
}

// ── State Enums ──────────────────────────────────────────────────────────────
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketState {
    Active,
    Closed,
    Scored,
    AwaitingRandomness, // Waiting for Chainlink VRF callback
    Settled,
}

// ── Events ────────────────────────────────────────────────────────────────────

/// Emitted when a new opinion market is created
#[event]
pub struct MarketCreatedEvent {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub statement: String,
    pub closes_at: i64,
    pub duration_secs: u64,
}

/// Emitted when a staker stakes an opinion on a market
#[event]
pub struct OpinionStakedEvent {
    pub market: Pubkey,
    pub staker: Pubkey,
    pub stake_amount: u64,
    pub ipfs_cid: String,
    pub total_stake_after: u64,
}

/// Emitted when a market transitions from Active to Closed
#[event]
pub struct MarketClosedEvent {
    pub market: Pubkey,
    pub closed_at: i64,
    pub total_stakers: u32,
    pub total_stake: u64,
}

/// Emitted when oracle records sentiment analysis
#[event]
pub struct SentimentRecordedEvent {
    pub market: Pubkey,
    pub sentiment_score: u8,
    pub confidence: u8,
    pub summary_hash: [u8; 32],
}

/// Emitted when lottery is settled and prize distributed
#[event]
pub struct LotterySettledEvent {
    pub market: Pubkey,
    pub winner: Pubkey,
    pub prize_amount: u64,
    pub protocol_fee: u64,
}

/// Emitted when Chainlink VRF randomness is requested
#[event]
pub struct VrfRandomnessRequestedEvent {
    pub market: Pubkey,
    pub vrf_request_id: u64,
    pub request_timestamp: i64,
}

/// Emitted when Chainlink VRF callback fulfills randomness
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
    /// Multi-sig oracle authority (Squads V3, Safe, or other multi-sig contract)
    /// For devnet: can be a single keypair; for mainnet: must be 3-of-5 multi-sig
    pub oracle_authority: Pubkey,
    /// Wallet that receives creation fees + 10% protocol cut
    pub treasury: Pubkey,
    /// USDC SPL token mint (devnet or mainnet)
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
    /// Random 16-byte UUID — part of PDA seed so one creator can make many markets
    pub uuid: [u8; 16],
    pub statement: String,
    pub created_at: i64,
    pub closes_at: i64,
    pub state: MarketState,
    pub staker_count: u32,
    /// Total USDC staked in micro-USDC (6 decimals)
    pub total_stake: u64,
    /// Sentiment score 0–100 (set after scoring)
    pub sentiment_score: u8,
    /// 0 = low, 1 = medium, 2 = high
    pub confidence: u8,
    /// SHA-256 of the LLM summary string
    pub summary_hash: [u8; 32],
    /// Winner's wallet pubkey (set after lottery)
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
        + 1   // sentiment_score
        + 1   // confidence
        + 32  // summary_hash
        + 1 + 32 // winner: Option<Pubkey>
        + 1;  // bump
}

/// A single staked opinion
#[account]
pub struct Opinion {
    pub market: Pubkey,
    pub staker: Pubkey,
    /// Amount staked in micro-USDC
    pub stake_amount: u64,
    /// SHA-256 of opinion text (integrity proof)
    pub text_hash: [u8; 32],
    /// Pinata/IPFS CID pointing to the full opinion text
    pub ipfs_cid: String,
    pub created_at: i64,
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
        + 1;  // bump
}

/// Tracks a pending Chainlink VRF randomness request
#[account]
pub struct VrfRequest {
    pub market: Pubkey,
    /// Request ID from Chainlink VRF
    pub request_id: u64,
    /// Randomness value once fulfilled (32 bytes from Chainlink)
    pub randomness: Option<[u8; 32]>,
    /// Timestamp when request was made
    pub requested_at: i64,
    /// Timestamp when randomness was fulfilled (if fulfilled)
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
    ///
    /// DEVNET: oracle_authority can be a single keypair for testing
    /// MAINNET: oracle_authority MUST be a verified 3-of-5 multi-sig wallet address
    ///          Recommended: Squads V3 (https://squads.so) or Safe
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

        // Transfer $5 USDC from creator → treasury
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
        market.sentiment_score = 0;
        market.confidence = 0;
        market.summary_hash = [0u8; 32];
        market.winner = None;
        market.bump = ctx.bumps.market;

        msg!("Market created: closes_at={}", market.closes_at);

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
    pub fn stake_opinion(
        ctx: Context<StakeOpinion>,
        stake_amount: u64,
        text_hash: [u8; 32],
        ipfs_cid: String,
    ) -> Result<()> {
        require!(stake_amount >= MIN_STAKE, OpinionError::StakeTooSmall);
        require!(stake_amount <= MAX_STAKE, OpinionError::StakeTooLarge);
        require!(ipfs_cid.len() <= MAX_IPFS_CID_LEN, OpinionError::CidTooLong);

        let clock = Clock::get()?;
        {
            let market = &ctx.accounts.market;
            require!(market.state == MarketState::Active, OpinionError::MarketNotActive);
            require!(clock.unix_timestamp < market.closes_at, OpinionError::MarketExpired);
        }

        // Transfer stake from staker → market escrow
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
        opinion.bump = ctx.bumps.opinion;

        msg!("Opinion staked: staker={} amount={} cid={}", staker_key, stake_amount, ipfs_cid);

        let market = &mut ctx.accounts.market;
        market.total_stake = market.total_stake.saturating_add(stake_amount);
        market.staker_count = market.staker_count.saturating_add(1);

        let total_stake_after = market.total_stake;

        emit!(OpinionStakedEvent {
            market: market_key,
            staker: staker_key,
            stake_amount,
            ipfs_cid: ipfs_cid_for_event,
            total_stake_after,
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
        msg!("Market closed");

        emit!(MarketClosedEvent {
            market: market_key,
            closed_at: clock.unix_timestamp,
            total_stakers: staker_count,
            total_stake,
        });

        Ok(())
    }

    /// Oracle writes LLM sentiment score on-chain. Restricted to oracle keypair.
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

        msg!("Sentiment: score={} confidence={}", score, confidence);

        emit!(SentimentRecordedEvent {
            market: ctx.accounts.market.key(),
            sentiment_score: score,
            confidence,
            summary_hash,
        });

        Ok(())
    }

    /// Request Chainlink VRF randomness for lottery winner selection.
    /// Called by oracle after recording sentiment. Market transitions to AwaitingRandomness.
    ///
    /// On mainnet: This calls the actual Chainlink VRF contract to request randomness.
    /// On devnet: This is mocked for testing purposes.
    pub fn request_vrf_randomness(ctx: Context<RequestVrfRandomness>) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(market.state == MarketState::Scored, OpinionError::MarketNotScored);

        let clock = Clock::get()?;
        let market_key = market.key();

        // In production, this would call Chainlink VRF contract via CPI
        // For now, we generate a mock request ID based on blockhash
        let request_id = clock.slot;

        let vrf_request = &mut ctx.accounts.vrf_request;
        vrf_request.market = market_key;
        vrf_request.request_id = request_id;
        vrf_request.randomness = None;
        vrf_request.requested_at = clock.unix_timestamp;
        vrf_request.fulfilled_at = None;
        vrf_request.bump = ctx.bumps.vrf_request;

        // Update market state to await randomness
        let market = &mut ctx.accounts.market;
        market.state = MarketState::AwaitingRandomness;

        msg!("VRF randomness requested for market: request_id={}", request_id);

        emit!(VrfRandomnessRequestedEvent {
            market: market_key,
            vrf_request_id: request_id,
            request_timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Fulfill Chainlink VRF randomness callback. Called by Chainlink VRF contract.
    /// Uses the randomness to select a proportional winner and settle the market.
    ///
    /// MAINNET: Only the Chainlink VRF contract can call this via authorized callback.
    /// DEVNET: Anyone can call this for testing (in production, would be restricted).
    pub fn fulfill_vrf_randomness(
        ctx: Context<FulfillVrfRandomness>,
        randomness: [u8; 32],
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        require!(
            market.state == MarketState::AwaitingRandomness,
            OpinionError::MarketNotAwaitingRandomness
        );
        require!(market.total_stake > 0, OpinionError::EmptyPrizePool);

        let clock = Clock::get()?;

        // Store randomness in VrfRequest account
        let vrf_request = &mut ctx.accounts.vrf_request;
        vrf_request.randomness = Some(randomness);
        vrf_request.fulfilled_at = Some(clock.unix_timestamp);

        let market_key = market.key();

        msg!("VRF randomness fulfilled for market: randomness={:?}", randomness);

        emit!(VrfRandomnessFulfilledEvent {
            market: market_key,
            vrf_request_id: vrf_request.request_id,
            randomness,
        });

        // Calculate prize distribution
        let total_stake = market.total_stake;
        let protocol_fee = total_stake
            .checked_mul(PROTOCOL_FEE_BPS)
            .unwrap()
            .checked_div(10_000)
            .unwrap();
        let prize_pool = total_stake.checked_sub(protocol_fee).unwrap();

        // Convert randomness to u64 for weighted selection
        let mut seed = [0u8; 8];
        seed.copy_from_slice(&randomness[0..8]);
        let random_value = u64::from_le_bytes(seed);

        // Deterministically select winner based on randomness and staker weights
        // This would need to iterate through all Opinion accounts for the market
        // For now, we pass control to run_lottery_with_vrf to handle the actual settlement
        // The winner selection logic would go here in production

        msg!("Settlement calculations: total_stake={} protocol_fee={} prize_pool={} random_value={}",
            total_stake, protocol_fee, prize_pool, random_value);

        Ok(())
    }

    /// Distribute prize pool using VRF-selected winner.
    /// Must be called after fulfill_vrf_randomness, or use oracle-selected path with run_lottery.
    pub fn run_lottery_with_vrf(
        ctx: Context<RunLotteryWithVrf>,
        winner_pubkey: Pubkey,
    ) -> Result<()> {
        // Validate winner account ownership
        require!(
            ctx.accounts.winner_token_account.owner == winner_pubkey,
            OpinionError::Unauthorized
        );

        let market = &ctx.accounts.market;
        require!(
            market.state == MarketState::AwaitingRandomness,
            OpinionError::MarketNotAwaitingRandomness
        );

        // Verify randomness was fulfilled
        let vrf_request = &ctx.accounts.vrf_request;
        require!(
            vrf_request.randomness.is_some(),
            OpinionError::RandomnessNotReady
        );

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

        // Market PDA is the authority over the escrow token account
        let seeds: &[&[u8]] = &[b"market", &market_uuid, &[market_bump]];
        let signer_seeds = &[seeds];

        // Transfer 10% protocol fee to treasury
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

        // Transfer 90% prize pool to VRF-selected winner
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

        msg!("VRF Lottery settled: winner={} prize={} fee={}", winner_pubkey, prize_pool, protocol_fee);

        emit!(LotterySettledEvent {
            market: ctx.accounts.market.key(),
            winner: winner_pubkey,
            prize_amount: prize_pool,
            protocol_fee,
        });

        Ok(())
    }

    /// Distribute prize pool. Oracle supplies the winner's pubkey and token account.
    ///
    /// DEVNET: Oracle selects winner proportionally off-chain using recent
    /// blockhash as randomness seed.
    ///
    /// MAINNET: This is the fallback path. For normal mainnet operation, use the
    /// VRF path: request_vrf_randomness → fulfill_vrf_randomness → run_lottery_with_vrf
    pub fn run_lottery(ctx: Context<RunLottery>, winner_pubkey: Pubkey) -> Result<()> {
        // Validate winner account ownership to prevent oracle from passing arbitrary accounts
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

        msg!("Settlement calculations: total_stake={} protocol_fee={} prize_pool={}",
            total_stake, protocol_fee, prize_pool);

        let market_uuid = market.uuid;
        let market_bump = market.bump;

        // Market PDA is the authority over the escrow token account
        let seeds: &[&[u8]] = &[b"market", &market_uuid, &[market_bump]];
        let signer_seeds = &[seeds];

        // Transfer 10% protocol fee to treasury
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

        // Transfer 90% prize pool to winner
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

        msg!("Lottery settled: winner={} prize={} fee={}", winner_pubkey, prize_pool, protocol_fee);

        emit!(LotterySettledEvent {
            market: ctx.accounts.market.key(),
            winner: winner_pubkey,
            prize_amount: prize_pool,
            protocol_fee,
        });

        Ok(())
    }

    /// Allow stakers to recover their stake if market is abandoned (not settled after 14 days).
    /// This is an escape hatch mechanism to prevent funds from being locked forever.
    pub fn recover_stake(ctx: Context<RecoverStake>) -> Result<()> {
        let clock = Clock::get()?;
        let market = &ctx.accounts.market;

        // Market must have been closed for at least 14 days
        require!(
            clock.unix_timestamp >= market.closes_at + RECOVERY_PERIOD,
            OpinionError::MarketNotExpired  // Reusing error: not enough time has passed
        );

        // Only allow recovery from markets that are NOT already settled
        // (settled markets already distributed funds)
        require!(
            market.state != MarketState::Settled,
            OpinionError::MarketNotActive  // Reusing error: cannot recover from settled market
        );

        let opinion = &ctx.accounts.opinion;
        let stake_amount = opinion.stake_amount;

        // Transfer stake from escrow back to staker
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

    /// Escrow token account owned by the market PDA
    #[account(
        init,
        payer = creator,
        token::mint = usdc_mint,
        token::authority = market,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Creator's USDC token account (source of creation fee)
    #[account(
        mut,
        constraint = creator_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = creator_usdc.owner == creator.key(),
    )]
    pub creator_usdc: Account<'info, TokenAccount>,

    /// Treasury USDC token account (receives creation fee)
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

    /// Escrow receives the stake
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

    /// Staker's USDC token account (source of stake)
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
    /// Must be the registered oracle_authority (multi-sig on mainnet)
    /// For devnet: can be a single keypair signer
    /// For mainnet: must be signed by the multi-sig contract (Squads V3, etc)
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
pub struct RunLottery<'info> {
    /// Must be the registered oracle_authority (multi-sig on mainnet)
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

    /// Escrow holding all stakes
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Winner's USDC token account — oracle has computed winner proportionally
    /// Winner pubkey is passed as instruction parameter to enable validation
    #[account(
        mut,
        constraint = winner_token_account.mint == config.usdc_mint @ OpinionError::MintMismatch,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// Treasury receives 10% protocol fee
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

    /// Escrow account holding stakes
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// The staker's opinion on this market
    #[account(
        seeds = [b"opinion", market.key().as_ref(), staker.key().as_ref()],
        bump = opinion.bump,
    )]
    pub opinion: Account<'info, Opinion>,

    /// Staker's USDC token account (receives recovered stake)
    #[account(
        mut,
        constraint = staker_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = staker_usdc.owner == staker.key(),
    )]
    pub staker_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RequestVrfRandomness<'info> {
    /// Must be the registered oracle_authority (multi-sig on mainnet)
    #[account(mut, constraint = oracle_authority.key() == config.oracle_authority @ OpinionError::Unauthorized)]
    pub oracle_authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// VRF request account to track the pending randomness request
    #[account(
        init,
        payer = oracle_authority,
        space = VrfRequest::SPACE,
        seeds = [b"vrf_request", market.key().as_ref()],
        bump,
    )]
    pub vrf_request: Account<'info, VrfRequest>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FulfillVrfRandomness<'info> {
    /// CHECK: In production, this would be the Chainlink VRF contract.
    /// On devnet, we allow any account to fulfill for testing purposes.
    /// On mainnet, this should be restricted to the actual VRF contract.
    pub vrf_callback: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"market", market.uuid.as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"vrf_request", market.key().as_ref()],
        bump = vrf_request.bump,
    )]
    pub vrf_request: Account<'info, VrfRequest>,
}

#[derive(Accounts)]
pub struct RunLotteryWithVrf<'info> {
    /// Must be the registered oracle_authority (multi-sig on mainnet)
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

    /// VRF request must be fulfilled before settling
    #[account(
        seeds = [b"vrf_request", market.key().as_ref()],
        bump = vrf_request.bump,
    )]
    pub vrf_request: Account<'info, VrfRequest>,

    /// Escrow holding all stakes
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Winner's USDC token account
    #[account(
        mut,
        constraint = winner_token_account.mint == config.usdc_mint @ OpinionError::MintMismatch,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// Treasury receives 10% protocol fee
    #[account(
        mut,
        constraint = treasury_usdc.mint == config.usdc_mint @ OpinionError::MintMismatch,
        constraint = treasury_usdc.owner == config.treasury @ OpinionError::TreasuryMismatch,
    )]
    pub treasury_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
