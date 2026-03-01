-- ============================================================
-- Migration 004: Dual Score & Dual Payout System
--
-- Separates opinion_score (how much user agrees with statement)
-- from market_prediction (bet on where crowd will land).
-- Adds dual pool payout tracking columns.
-- ============================================================

-- opinions table
ALTER TABLE opinions RENAME COLUMN prediction TO market_prediction;
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS opinion_score SMALLINT;
ALTER TABLE opinions RENAME COLUMN consensus_score TO prediction_score;
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS opinion_payout BIGINT;
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS prediction_payout BIGINT;
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS jackpot_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS jackpot_winner BOOLEAN DEFAULT FALSE;

-- Backfill opinion_score for existing rows (best available approximation)
UPDATE opinions SET opinion_score = market_prediction WHERE opinion_score IS NULL;

-- Make opinion_score NOT NULL after backfill
ALTER TABLE opinions ALTER COLUMN opinion_score SET NOT NULL;

-- markets table: dual pool tracking
ALTER TABLE markets ADD COLUMN IF NOT EXISTS opinion_pool BIGINT DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS prediction_pool BIGINT DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS jackpot_amount BIGINT DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS jackpot_claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS jackpot_winner VARCHAR;
