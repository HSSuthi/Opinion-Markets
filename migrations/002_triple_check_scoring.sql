-- ============================================================
-- Migration 002: Triple-Check Scoring
--
-- Adds three new scoring layers to the opinions table:
--   Layer 1 (W): Peer backing via Back/Slash reactions
--   Layer 2 (C): Crowd consensus via agreement predictions
--   Layer 3 (A): AI quality scoring per opinion
--
-- Formula: S = (W × 0.5) + (C × 0.3) + (A × 0.2)
-- Payout: proportional to composite score, 10% protocol fee
-- ============================================================

-- ── opinions table: new Triple-Check columns ──────────────────────────────────

-- Layer 2: agreement prediction submitted with stake (0–100)
ALTER TABLE opinions
  ADD COLUMN IF NOT EXISTS prediction SMALLINT;

-- Layer 1: peer backing totals
ALTER TABLE opinions
  ADD COLUMN IF NOT EXISTS backing_total BIGINT NOT NULL DEFAULT 0;

ALTER TABLE opinions
  ADD COLUMN IF NOT EXISTS slashing_total BIGINT NOT NULL DEFAULT 0;

-- Scoring outputs (set by oracle at settlement)
ALTER TABLE opinions
  ADD COLUMN IF NOT EXISTS weight_score    FLOAT;   -- Layer 1 normalized (0–100)

ALTER TABLE opinions
  ADD COLUMN IF NOT EXISTS ai_score        SMALLINT; -- Layer 3 AI quality (0–100)

ALTER TABLE opinions
  ADD COLUMN IF NOT EXISTS consensus_score FLOAT;   -- Layer 2 crowd alignment (0–100)

ALTER TABLE opinions
  ADD COLUMN IF NOT EXISTS composite_score FLOAT;   -- Final S score (0–100)

-- Payout
ALTER TABLE opinions
  ADD COLUMN IF NOT EXISTS payout_amount   BIGINT;  -- Prize earned in micro-USDC

-- ── markets table: crowd_score ───────────────────────────────────────────────

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS crowd_score FLOAT; -- Volume-weighted mean of predictions

-- ── opinion_reactions table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opinion_reactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  opinion_id      UUID        NOT NULL REFERENCES opinions(id) ON DELETE CASCADE,
  market_id       VARCHAR     NOT NULL,
  reactor_address VARCHAR     NOT NULL,
  reaction_type   VARCHAR(10) NOT NULL CHECK (reaction_type IN ('back', 'slash')),
  amount          BIGINT      NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One reaction per (reactor, opinion)
CREATE UNIQUE INDEX IF NOT EXISTS idx_opinion_reactions_unique
  ON opinion_reactions(opinion_id, reactor_address);

CREATE INDEX IF NOT EXISTS idx_opinion_reactions_opinion_id
  ON opinion_reactions(opinion_id);

CREATE INDEX IF NOT EXISTS idx_opinion_reactions_reactor
  ON opinion_reactions(reactor_address);

CREATE INDEX IF NOT EXISTS idx_opinion_reactions_market_id
  ON opinion_reactions(market_id);

-- ── Migrate existing opinions: set backing_total = amount ────────────────────
-- (Author's own stake is their initial backing)
UPDATE opinions
  SET backing_total = amount
  WHERE backing_total = 0;
