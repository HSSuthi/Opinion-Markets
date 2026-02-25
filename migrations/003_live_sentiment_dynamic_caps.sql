-- ============================================================
-- Migration 003: Live Sentiment Scoring + Dynamic Stake Caps
--
-- Change 1 — Live Sentiment:
--   Adds fields to persist the continuously-updated sentiment
--   score computed during the active phase of a market.
--   live_sentiment_score   : 0–100, blended AI + crowd signal
--   live_sentiment_confidence: 0=low / 1=medium / 2=high
--   live_scored_at         : timestamp of last live score run
--
-- Change 2 — Dynamic Stake Caps:
--   Adds max_stake (micro-USDC) set by the market creator.
--   Default $10 preserves existing behaviour.
--   Higher-conviction markets can go up to $500.
-- ============================================================

-- ── Live sentiment columns ────────────────────────────────────────────────────

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS live_sentiment_score      SMALLINT;    -- 0–100

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS live_sentiment_confidence SMALLINT;    -- 0/1/2

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS live_scored_at            TIMESTAMPTZ; -- last scoring run

-- ── Dynamic stake cap ─────────────────────────────────────────────────────────

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS max_stake BIGINT NOT NULL DEFAULT 10000000;
  -- Default: $10.00 (10_000_000 micro-USDC)
  -- Creator may set up to $500.00 (500_000_000 micro-USDC)

-- Optional: index for quickly finding markets eligible for live scoring
CREATE INDEX IF NOT EXISTS idx_markets_active_live
  ON markets (state, live_scored_at)
  WHERE state = 'Active';
