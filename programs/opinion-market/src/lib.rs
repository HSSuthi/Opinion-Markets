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
}

// ── State Enums ──────────────────────────────────────────────────────────────
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketState {
    Active,
    Closed,
    Scored,
    Settled,
}

// ── Account Structs ──────────────────────────────────────────────────────────

/// Global program configuration — initialized once by deployer
#[account]
pub struct ProgramConfig {
    /// The oracle keypair that may call record_sentiment and run_lottery
    pub oracle: Pubkey,
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

// ── Program ──────────────────────────────────────────────────────────────────
#[program]
pub mod opinion_market {
    use super::*;

    /// Initialize global config — called once by deployer
    pub fn initialize(
        ctx: Context<InitializeConfig>,
        oracle: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.oracle = oracle;
        config.treasury = treasury;
        config.usdc_mint = ctx.accounts.usdc_mint.key();
        config.bump = ctx.bumps.config;
        msg!("ProgramConfig initialized: oracle={} treasury={}", oracle, treasury);
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

        let opinion = &mut ctx.accounts.opinion;
        opinion.market = ctx.accounts.market.key();
        opinion.staker = ctx.accounts.staker.key();
        opinion.stake_amount = stake_amount;
        opinion.text_hash = text_hash;
        opinion.ipfs_cid = ipfs_cid;
        opinion.created_at = clock.unix_timestamp;
        opinion.bump = ctx.bumps.opinion;

        let market = &mut ctx.accounts.market;
        market.total_stake = market.total_stake.saturating_add(stake_amount);
        market.staker_count = market.staker_count.saturating_add(1);

        Ok(())
    }

    /// Close a market after its duration expires. Permissionless.
    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        let clock = Clock::get()?;
        let market = &mut ctx.accounts.market;
        require!(market.state == MarketState::Active, OpinionError::MarketNotActive);
        require!(clock.unix_timestamp >= market.closes_at, OpinionError::MarketNotExpired);
        market.state = MarketState::Closed;
        msg!("Market closed");
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
        Ok(())
    }

    /// Distribute prize pool. Oracle supplies the winner's token account.
    ///
    /// DEVNET: Oracle selects winner proportionally off-chain using recent
    /// blockhash as randomness seed.
    ///
    /// MAINNET TODO: Replace with Chainlink VRF on-chain callback.
    /// VRF request is made in record_sentiment, callback fires run_lottery
    /// with the verified random winner pubkey.
    pub fn run_lottery(ctx: Context<RunLottery>) -> Result<()> {
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
        market.winner = Some(ctx.accounts.winner_token_account.owner);
        market.state = MarketState::Settled;

        msg!("Lottery settled: prize={} fee={}", prize_pool, protocol_fee);
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
    /// Must be the registered oracle keypair
    #[account(constraint = oracle.key() == config.oracle @ OpinionError::Unauthorized)]
    pub oracle: Signer<'info>,

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
    /// Must be the registered oracle keypair
    #[account(constraint = oracle.key() == config.oracle @ OpinionError::Unauthorized)]
    pub oracle: Signer<'info>,

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
