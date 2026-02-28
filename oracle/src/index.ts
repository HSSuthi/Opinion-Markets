/**
 * Opinion-Markets Oracle Service — Triple-Check Edition
 *
 * Implements the 3-fold scoring mechanism:
 *   Layer 1 (W, 50%): Peer backing — net backing score per opinion
 *   Layer 2 (C, 30%): Crowd consensus — how close prediction was to crowd mean
 *   Layer 3 (A, 20%): AI quality — Claude scores each opinion's text
 *
 *   Final score: S = (W × 0.5) + (C × 0.3) + (A × 0.2)
 *   Payout: proportional to S, 10% protocol fee
 *
 * Settlement flow:
 *   Market closes → record_sentiment (market-level) → record_ai_score (per opinion)
 *   → settle_opinion (per opinion, with crowd/weight/consensus) → finalize_settlement
 *   → stakers call claim_payout
 */

import * as pino from "pino";
import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";
import Queue from "bull";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";

// Initialize logger
const logger = pino.pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});

// Configuration
const config = {
  solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  programId: process.env.PROGRAM_ID || "2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu",
  oracleKeypairPath: process.env.ORACLE_KEYPAIR_PATH || path.join(process.env.HOME!, ".config/solana/oracle.json"),
  databaseUrl: process.env.DATABASE_URL || "postgresql://localhost/opinion_markets",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  network: process.env.NETWORK || "devnet",
};

if (!config.anthropicApiKey) {
  logger.error("ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

const connection = new Connection(config.solanaRpcUrl);
const wallet = loadOracleKeypair(config.oracleKeypairPath);
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "processed",
});

logger.info({ network: config.network, programId: config.programId }, "Triple-Check Oracle initialized");

function loadOracleKeypair(keypairPath: string): anchor.Wallet {
  if (!fs.existsSync(keypairPath)) {
    logger.error({ path: keypairPath }, "Oracle keypair not found");
    process.exit(1);
  }
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Buffer.from(secretKey));
  return new anchor.Wallet(keypair);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OpinionData {
  id: string;
  staker_address: string;
  amount: number;          // micro-USDC stake
  opinion_text: string;
  opinion_score: number;      // NEW: 0–100, user's agreement score → shapes truth
  market_prediction: number;  // RENAMED from prediction: user's bet on crowd → shapes payout
  backing_total: number;   // total backing from peers
  slashing_total: number;  // total slashing from peers
}

interface ScoredOpinion extends OpinionData {
  net_backing: number;
  weight_score: number;       // Layer 1: 0–100
  ai_score: number;           // Layer 3: 0–100
  prediction_score: number;   // RENAMED from consensus_score: Layer 2: 0–100
  combined_bps: number;       // 0–10000 (for on-chain precision)
  combined_score: number;     // 0–100
  opinion_payout: number;       // NEW: from 70% opinion pool
  prediction_payout: number;    // NEW: from 24% prediction pool
  jackpot_eligible: boolean;    // NEW: top 20% closest predictors
  jackpot_winner: boolean;      // NEW: randomly selected from eligible
  payout_amount: number;        // opinion_payout + prediction_payout
  payout_share: number;    // 0.0–1.0 fraction of distributable pool
  _prediction_weight?: number;  // internal scratch field
}

// ── Triple-Check Scorer ────────────────────────────────────────────────────────

class TripleCheckScorer {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey, timeout: 60000 });
  }

  // ── Layer 2: Crowd Score ────────────────────────────────────────────────────

  /**
   * Volume-weighted mean of all opinion_score values.
   * Users who staked MORE (original + backing) have more influence.
   *
   * crowdScore = Σ(opinion_score_i × weight_i) / Σ(weight_i)
   *   where weight_i = amount_i + backing_total_i
   */
  calculateCrowdScore(opinions: OpinionData[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const op of opinions) {
      const weight = op.amount + op.backing_total;
      weightedSum += (op.opinion_score ?? 50) * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return 50;
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  // ── Layer 1: Weight Scores ──────────────────────────────────────────────────

  /**
   * Normalize net backing (backing_total - slashing_total) to 0–100 across all opinions.
   * Minimum weight is 5 so no opinion ever scores zero.
   *
   * weight_i = max(5, ((netBacking_i - minNet) / range) × 95 + 5)
   */
  calculateWeightScores(opinions: OpinionData[]): Map<string, number> {
    const netBacking = opinions.map((op) => ({
      id: op.id,
      net: Number(op.backing_total) - Number(op.slashing_total),
    }));

    const values = netBacking.map((n) => n.net);
    const maxNet = Math.max(...values);
    const minNet = Math.min(...values);
    const range = maxNet - minNet || 1;

    const scores = new Map<string, number>();
    for (const { id, net } of netBacking) {
      const score = Math.max(5, Math.round(((net - minNet) / range) * 95) + 5);
      scores.set(id, score);
    }
    return scores;
  }

  // ── Layer 2: Prediction Scores ──────────────────────────────────────────────

  /**
   * How close was each staker's market_prediction to the crowd score?
   * prediction_score_i = max(0, 100 - |market_prediction_i - crowdScore|)
   */
  calculatePredictionScores(opinions: OpinionData[], crowdScore: number): Map<string, number> {
    const scores = new Map<string, number>();
    for (const op of opinions) {
      const diff = Math.abs((op.market_prediction ?? 50) - crowdScore);
      const score = Math.max(0, 100 - Math.round(diff));
      scores.set(op.id, score);
    }
    return scores;
  }

  // ── Layer 3: AI Quality Scores ─────────────────────────────────────────────

  /**
   * Batch-calls Claude to score each opinion's text quality (0–100).
   * Scores on: clarity, insight, reasoning, originality.
   * Falls back to 50 on failure.
   */
  async scoreOpinionTexts(
    statement: string,
    opinions: OpinionData[]
  ): Promise<Map<string, number>> {
    if (opinions.length === 0) return new Map();

    const opinionsList = opinions
      .map((op, i) => `Opinion ${i + 1}: "${(op.opinion_text || "").substring(0, 200)}"`)
      .join("\n");

    const prompt = `You are an objective evaluator for a prediction market. Rate each opinion on a scale of 0–100.

Market Question: "${statement}"

Scoring criteria:
- Clarity (20 pts): Is the argument easy to understand?
- Insight (30 pts): Does it add meaningful perspective or new information?
- Reasoning (30 pts): Is the position backed by logic or evidence?
- Originality (20 pts): More than a generic platitude?

Scores: 0–20 = spam/bot-like, 21–40 = weak, 41–60 = average, 61–80 = good, 81–100 = excellent

${opinionsList}

Respond ONLY with a JSON array of integers, one per opinion in order. Example: [72, 45, 88, 31]
No other text.`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text.trim() : "[]";

      // Extract JSON array robustly
      const match = text.match(/\[[\d,\s]+\]/);
      if (!match) throw new Error("No JSON array in response");

      const rawScores = JSON.parse(match[0]) as number[];
      const scores = new Map<string, number>();

      if (rawScores.length !== opinions.length) {
        logger.warn(
          { got: rawScores.length, expected: opinions.length },
          "AI returned wrong number of scores, using defaults"
        );
        for (const op of opinions) scores.set(op.id, 50);
        return scores;
      }

      for (let i = 0; i < opinions.length; i++) {
        scores.set(opinions[i].id, Math.max(0, Math.min(100, Math.round(rawScores[i] || 50))));
      }
      return scores;
    } catch (err: any) {
      logger.error({ error: err.message }, "AI scoring failed, using default scores of 50");
      const scores = new Map<string, number>();
      for (const op of opinions) scores.set(op.id, 50);
      return scores;
    }
  }

  // ── Market-Level Sentiment Summary ─────────────────────────────────────────

  /**
   * Generates a market-level sentiment score + summary for on-chain storage.
   * This is the legacy single-score used by the SentimentRecordedEvent.
   */
  async analyzeMarketSentiment(
    statement: string,
    opinions: OpinionData[]
  ): Promise<{ score: number; confidence: number; summary: string }> {
    if (opinions.length === 0) {
      return { score: 50, confidence: 0, summary: "No opinions submitted." };
    }

    const opinionsSummary = opinions
      .map((o, i) => `Opinion ${i + 1} (stake: $${o.amount / 1_000_000}): "${(o.opinion_text || "").substring(0, 200)}"`)
      .join("\n");

    const prompt = `Analyze the following market opinions and provide a market-level sentiment score.

Market: "${statement}"

Opinions:
${opinionsSummary}

Respond in JSON:
{
  "sentiment_score": <0-100>,
  "confidence": <0=low, 1=medium, 2=high>,
  "reasoning": "<one sentence summary>"
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "{}";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON in response");

      const result = JSON.parse(match[0]);
      return {
        score: Math.max(0, Math.min(100, result.sentiment_score || 50)),
        confidence: Math.max(0, Math.min(2, result.confidence || 0)),
        summary: result.reasoning || "",
      };
    } catch (err: any) {
      logger.error({ error: err.message }, "Market sentiment analysis failed");
      return { score: 50, confidence: 0, summary: "Analysis unavailable." };
    }
  }

  // ── Full Settlement Computation ────────────────────────────────────────────

  /**
   * Runs all three layers and returns fully scored opinions with payouts.
   *
   * Formula: S_bps = W*50 + C*30 + A*20   (range 0–10000)
   * Payout = (S_bps / Σ S_bps) × distributable_pool
   */
  async computeTripleCheckScores(
    statement: string,
    opinions: OpinionData[],
    totalStakeMicroUsdc: number
  ): Promise<{ crowdScore: number; scoredOpinions: ScoredOpinion[] }> {
    logger.info(
      { opinionCount: opinions.length, totalStake: totalStakeMicroUsdc },
      "Running Triple-Check computation"
    );

    // Layer 1
    const weightScores = this.calculateWeightScores(opinions);

    // Layer 2
    const crowdScore = this.calculateCrowdScore(opinions);
    const predictionScores = this.calculatePredictionScores(opinions, crowdScore);

    // Layer 3
    logger.info("Calling Claude AI to score opinion texts...");
    const aiScores = await this.scoreOpinionTexts(statement, opinions);

    // Composite
    const PROTOCOL_FEE_BPS = 1000; // 10%
    const protocolFee = Math.floor((totalStakeMicroUsdc * PROTOCOL_FEE_BPS) / 10_000);
    const distributablePool = totalStakeMicroUsdc - protocolFee;

    const scored: ScoredOpinion[] = opinions.map((op) => {
      const W = weightScores.get(op.id) ?? 50;
      const C = predictionScores.get(op.id) ?? 50;
      const A = aiScores.get(op.id) ?? 50;

      // S = W*50 + C*30 + A*20  (integer basis points, range 0–10000)
      const combined_bps = W * 50 + C * 30 + A * 20;
      const combined_score = Math.round(combined_bps / 100);

      return {
        ...op,
        net_backing: Number(op.backing_total) - Number(op.slashing_total),
        weight_score: W,
        prediction_score: C,
        ai_score: A,
        combined_bps,
        combined_score,
        opinion_payout: 0,
        prediction_payout: 0,
        jackpot_eligible: false,
        jackpot_winner: false,
        payout_share: 0,
        payout_amount: 0,
      };
    });

    // ── Pool splits ──────────────────────────────────────────────────────
    const opinionPool = Math.floor(distributablePool * 70 / 100);
    const fullPredictionPool = distributablePool - opinionPool; // 30%
    const jackpotAmount = Math.floor(fullPredictionPool * 20 / 100); // 6% of total
    const proportionalPredictionPool = fullPredictionPool - jackpotAmount; // 24% of total

    // Opinion payouts — proportional to net backing
    const netBackings = scored.map(op => Math.max(0, op.net_backing));
    const totalNetBacking = netBackings.reduce((s, v) => s + v, 0) || 1;
    scored.forEach((op, i) => {
      op.opinion_payout = Math.floor(netBackings[i] * opinionPool / totalNetBacking);
    });

    // Prediction payouts — inverse distance from crowd score
    scored.forEach(op => {
      const diff = Math.abs(op.market_prediction - crowdScore);
      op._prediction_weight = Math.floor(1_000_000 / (diff + 1));
    });
    const totalPredictionWeight = scored.reduce((s, op) => s + (op._prediction_weight || 0), 0) || 1;
    scored.forEach(op => {
      op.prediction_payout = Math.floor(
        (op._prediction_weight || 0) * proportionalPredictionPool / totalPredictionWeight
      );
    });

    // Jackpot eligibility — top 20% closest to crowd score
    const sortedByAccuracy = [...scored].sort((a, b) =>
      Math.abs(a.market_prediction - crowdScore) - Math.abs(b.market_prediction - crowdScore)
    );
    const jackpotCutoff = Math.max(1, Math.ceil(sortedByAccuracy.length * 0.2));
    const eligibleIds = new Set(sortedByAccuracy.slice(0, jackpotCutoff).map(op => op.id));
    scored.forEach(op => {
      op.jackpot_eligible = eligibleIds.has(op.id);
      op.jackpot_winner = false;
      op.payout_amount = op.opinion_payout + op.prediction_payout;
    });

    // Select jackpot winner randomly from eligible
    const eligible = sortedByAccuracy.slice(0, jackpotCutoff);
    const jackpotWinner = eligible[Math.floor(Math.random() * eligible.length)];
    if (jackpotWinner) {
      jackpotWinner.jackpot_winner = true;
    }

    // Calculate payout shares for reporting
    const totalPayouts = scored.reduce((s, op) => s + op.payout_amount, 0) || 1;
    scored.forEach(op => {
      op.payout_share = op.payout_amount / totalPayouts;
    });

    return {
      crowdScore,
      scoredOpinions: scored,
      totalNetBacking,
      totalPredictionWeight,
      jackpotWinnerAddress: jackpotWinner?.staker_address,
      jackpotAmount,
    };
  }
}

// ── Settlement Coordinator ────────────────────────────────────────────────────

class SettlementCoordinator {
  private scorer: TripleCheckScorer;
  private settlementQueue: Queue.Queue;

  constructor(scorer: TripleCheckScorer) {
    this.scorer = scorer;
    this.settlementQueue = new Queue("triple-check-settlements", config.redisUrl);
    this.setupQueueHandlers();
  }

  private setupQueueHandlers() {
    this.settlementQueue.process(5, async (job) => {
      const { marketId, statement, opinions, totalStake } = job.data;

      try {
        logger.info({ marketId }, "Processing Triple-Check settlement");

        // Step 1: Market-level sentiment (for on-chain SentimentRecordedEvent)
        const { score, confidence, summary } =
          await this.scorer.analyzeMarketSentiment(statement, opinions);

        // Step 2: Compute all three layers + dual pool payouts
        const { crowdScore, scoredOpinions, totalNetBacking, totalPredictionWeight, jackpotWinnerAddress, jackpotAmount } =
          await this.scorer.computeTripleCheckScores(statement, opinions, totalStake);

        // Step 3: Write scores to blockchain
        await this.writeScoresOnChain(marketId, score, confidence, summary, crowdScore, scoredOpinions, totalNetBacking, totalPredictionWeight, jackpotWinnerAddress);

        // Step 4: Save results to database via API
        await this.persistScoresToDatabase(marketId, crowdScore, scoredOpinions);

        logger.info({ marketId }, "Settlement complete");
        this.printSettlementReport(statement, crowdScore, scoredOpinions);

        return { success: true, marketId };
      } catch (error: any) {
        logger.error({ marketId, error: error.message }, "Settlement failed");
        throw error;
      }
    });

    this.settlementQueue.on("failed", (job, err) => {
      logger.error({ jobId: job.id, error: err.message }, "Settlement job failed");
    });
    this.settlementQueue.on("completed", (job) => {
      logger.info({ jobId: job.id }, "Settlement job completed");
    });
  }

  /**
   * Write all scores on-chain via oracle instructions.
   * Order: record_sentiment → record_ai_score (×N) → settle_opinion (×N) → finalize_settlement
   *        → claim_payout (×N) → claim_jackpot
   */
  private async writeScoresOnChain(
    marketId: string,
    sentimentScore: number,
    confidence: number,
    summary: string,
    crowdScore: number,
    scoredOpinions: ScoredOpinion[],
    totalNetBacking: number,
    totalPredictionWeight: number,
    jackpotWinnerAddress?: string,
  ): Promise<void> {
    const crypto = require("crypto");
    const summaryHash = crypto.createHash("sha256").update(summary).digest();

    logger.info({ marketId }, "Writing scores on-chain...");

    // TODO: Replace with actual Anchor CPI calls:
    //
    // 1. await program.methods
    //      .recordSentiment(sentimentScore, confidence, Array.from(summaryHash))
    //      .accounts({ oracleAuthority, config, market })
    //      .signers([oracleKeypair])
    //      .rpc();
    //
    // 2. for (const op of scoredOpinions) {
    //      await program.methods
    //        .recordAiScore(op.ai_score)
    //        .accounts({ oracleAuthority, config, market, opinion: opinionPDA })
    //        .rpc();
    //    }
    //
    // 3. for (const op of scoredOpinions) {
    //      await program.methods
    //        .settleOpinion(Math.round(crowdScore), op.weight_score, op.prediction_score)
    //        .accounts({ oracleAuthority, config, market, opinion: opinionPDA })
    //        .rpc();
    //    }
    //
    // 4. await program.methods
    //      .finalizeSettlement()
    //      .accounts({ oracleAuthority, config, market, escrowTokenAccount, treasuryUsdc, tokenProgram })
    //      .rpc();
    //
    // 5. for (const op of scoredOpinions) {
    //      await program.methods
    //        .claimPayout(new BN(1), new BN(totalNetBacking), new BN(totalPredictionWeight))
    //        .accounts({ staker, config, market, escrowTokenAccount, opinion: opinionPDA, stakerUsdc, tokenProgram })
    //        .rpc();
    //    }
    //
    // 6. if (jackpotWinnerAddress) {
    //      await program.methods
    //        .claimJackpot(new PublicKey(jackpotWinnerAddress))
    //        .accounts({ oracleAuthority, config, market, escrowTokenAccount, winnerTokenAccount, tokenProgram })
    //        .rpc();
    //    }

    logger.info(
      {
        marketId,
        sentimentScore,
        crowdScore: Math.round(crowdScore),
        opinionCount: scoredOpinions.length,
        totalNetBacking,
        totalPredictionWeight,
        jackpotWinner: jackpotWinnerAddress,
      },
      "On-chain writes complete (devnet: mocked)"
    );
  }

  /**
   * Persist computed scores back to the database via direct repository updates.
   */
  private async persistScoresToDatabase(
    marketId: string,
    crowdScore: number,
    scoredOpinions: ScoredOpinion[]
  ): Promise<void> {
    const apiUrl = process.env.API_URL || "http://localhost:3001";

    try {
      // Update market crowd_score and state
      await fetch(`${apiUrl}/internal/markets/${marketId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crowd_score: crowdScore,
          state: "Settled",
          opinions: scoredOpinions.map((op) => ({
            id: op.id,
            weight_score: op.weight_score,
            prediction_score: op.prediction_score,
            ai_score: op.ai_score,
            composite_score: op.combined_score,
            opinion_payout: op.opinion_payout,
            prediction_payout: op.prediction_payout,
            jackpot_eligible: op.jackpot_eligible,
            jackpot_winner: op.jackpot_winner,
            payout_amount: op.payout_amount,
          })),
        }),
      });
    } catch (err: any) {
      logger.warn({ error: err.message }, "Could not persist scores via API — will rely on on-chain state");
    }
  }

  async queueMarketForSettlement(
    marketId: string,
    statement: string,
    opinions: OpinionData[],
    totalStake: number
  ): Promise<void> {
    await this.settlementQueue.add(
      { marketId, statement, opinions, totalStake },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
      }
    );
    logger.info({ marketId }, "Market queued for Triple-Check settlement");
  }

  private printSettlementReport(
    statement: string,
    crowdScore: number,
    opinions: ScoredOpinion[]
  ): void {
    const sorted = [...opinions].sort((a, b) => b.payout_amount - a.payout_amount);
    const totalPool = opinions.reduce((s, o) => s + o.amount + o.backing_total, 0);

    logger.info(`\n${"═".repeat(100)}`);
    logger.info(`Triple-Check Settlement Report (Dual Pool)`);
    logger.info(`Market: "${statement.substring(0, 70)}"`);
    logger.info(`Crowd Score (weighted mean of opinion_scores): ${crowdScore.toFixed(1)}`);
    logger.info(`Total Pool: $${(totalPool / 1_000_000).toFixed(2)} USDC`);
    logger.info(`${"─".repeat(100)}`);

    const header = `${"Staker".padEnd(12)} ${"W".padStart(4)} ${"P".padStart(4)} ${"A".padStart(4)} ${"OpPay".padStart(8)} ${"PrPay".padStart(8)} ${"Total".padStart(8)} ${"JP".padStart(3)}`;
    logger.info(header);

    for (const op of sorted) {
      const staker = op.staker_address.slice(0, 6) + "..." + op.staker_address.slice(-4);
      const opPay = `$${(op.opinion_payout / 1_000_000).toFixed(2)}`;
      const prPay = `$${(op.prediction_payout / 1_000_000).toFixed(2)}`;
      const total = `$${(op.payout_amount / 1_000_000).toFixed(2)}`;
      const jp = op.jackpot_winner ? "WIN" : op.jackpot_eligible ? "yes" : " - ";
      logger.info(
        `${staker.padEnd(12)} ${String(op.weight_score).padStart(4)} ${String(op.prediction_score).padStart(4)} ${String(op.ai_score).padStart(4)} ${opPay.padStart(8)} ${prPay.padStart(8)} ${total.padStart(8)} ${jp.padStart(3)}`
      );
    }
    logger.info(`${"═".repeat(100)}`);
  }
}

// ── Market Monitor ─────────────────────────────────────────────────────────────

/**
 * Polls ACTIVE markets every ~2 minutes and computes a blended "live" sentiment score.
 *
 * Multi-signal blend:
 *   - Signal 1: Crowd volume-weighted prediction (0–100)
 *   - Signal 2: Claude AI sentiment analysis (0–100)
 *   - Blended: (signal1 + signal2) / 2
 *
 * This gives a sentiment that responds to BOTH the crowd's predictions AND the AI's
 * semantic analysis of opinion texts — more robust than either alone.
 *
 * Confidence tier:
 *   - 0 (low):    < 5 opinions
 *   - 1 (medium): 5–14 opinions
 *   - 2 (high):   >= 15 opinions
 */
class LiveMarketMonitor {
  private scorer: TripleCheckScorer;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastScoredMarkets: Set<string> = new Set(); // Debounce cache

  constructor(scorer: TripleCheckScorer) {
    this.scorer = scorer;
  }

  async start(): Promise<void> {
    logger.info("Live Market Monitor started (scoring active markets every 2 minutes)");

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.scoreLiveMarkets();
      } catch (error: any) {
        logger.error({ error: error.message }, "Live scoring cycle failed");
      }
    }, 120000); // 2 minutes
  }

  private async scoreLiveMarkets(): Promise<void> {
    try {
      const apiUrl = process.env.API_URL || "http://localhost:3001";

      // Fetch active markets with minimal joins (for speed)
      const response = await fetch(`${apiUrl}/markets?state=Active&limit=100`);
      if (!response.ok) {
        logger.warn("Could not fetch active markets");
        return;
      }

      const { data: markets } = (await response.json()) as any;

      for (const market of markets || []) {
        try {
          // Skip if we scored it very recently (debounce: < 90 seconds ago)
          if (market.live_scored_at) {
            const lastScored = new Date(market.live_scored_at).getTime();
            if (Date.now() - lastScored < 90_000) {
              continue;
            }
          }

          // Skip markets with < 2 opinions (insufficient signal)
          if (market.staker_count < 2) {
            continue;
          }

          // Fetch full market with all opinions
          const detailRes = await fetch(`${apiUrl}/markets/${market.id}`);
          if (!detailRes.ok) {
            continue;
          }

          const { data: fullMarket } = (await detailRes.json()) as any;
          const opinions: OpinionData[] = (fullMarket.opinions || []).map(
            (op: any) => ({
              id: op.id,
              staker_address: op.staker_address,
              amount: Number(op.amount),
              opinion_text: op.opinion_text || "",
              opinion_score: op.opinion_score ?? op.prediction ?? 50,
              market_prediction: op.market_prediction ?? op.prediction ?? 50,
              backing_total: Number(op.backing_total || op.amount),
              slashing_total: Number(op.slashing_total || 0),
            })
          );

          // ── Two-Signal Blend ──────────────────────────────────────────────

          // Signal 1: Crowd prediction score (volume-weighted, no LLM needed)
          const crowdScore = this.scorer.calculateCrowdScore(opinions);

          // Signal 2: AI semantic sentiment analysis (Claude)
          const { score: aiScore } = await this.scorer.analyzeMarketSentiment(
            fullMarket.statement,
            opinions
          );

          // Blend both signals: equal weight on the 0–100 scale
          const blendedScore = Math.round((crowdScore + aiScore) / 2);

          // Derive confidence from opinion count
          const opinionCount = opinions.length;
          let confidence = 0;
          if (opinionCount >= 15) confidence = 2;
          else if (opinionCount >= 5) confidence = 1;

          // ── Persist to database ───────────────────────────────────────────

          await fetch(`${apiUrl}/internal/markets/${market.id}/live-sentiment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              live_sentiment_score: blendedScore,
              live_sentiment_confidence: confidence,
            }),
          });

          logger.debug(
            {
              marketId: market.id,
              crowdSignal: crowdScore.toFixed(1),
              aiSignal: aiScore.toFixed(1),
              blended: blendedScore,
              confidence,
              opinionCount,
            },
            "Live sentiment updated"
          );
        } catch (err: any) {
          logger.warn(
            { marketId: market.id, error: err.message },
            "Failed to score market"
          );
        }
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "Live market scoring failed");
    }
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("Live Market Monitor stopped");
    }
  }
}

// ── Market Monitor (Settlement) ────────────────────────────────────────────────

class MarketMonitor {
  private settlementCoordinator: SettlementCoordinator;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(coordinator: SettlementCoordinator) {
    this.settlementCoordinator = coordinator;
  }

  async start(): Promise<void> {
    logger.info("Triple-Check Market Monitor started");

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForSettlementCandidates();
      } catch (error: any) {
        logger.error({ error: error.message }, "Monitor check failed");
      }
    }, 60000);
  }

  private async checkForSettlementCandidates(): Promise<void> {
    try {
      logger.debug("Checking for markets needing Triple-Check settlement");

      const apiUrl = process.env.API_URL || "http://localhost:3001";
      const response = await fetch(
        `${apiUrl}/markets?state=Closed&limit=50`
      );

      if (!response.ok) {
        logger.warn("Could not fetch closed markets from API");
        return;
      }

      const { data: markets } = await response.json() as any;

      for (const market of (markets || [])) {
        if (new Date() >= new Date(market.closes_at)) {
          logger.info({ marketId: market.id }, "Queuing market for Triple-Check settlement");

          // Fetch opinions for this market
          const detailRes = await fetch(`${apiUrl}/markets/${market.id}`);
          if (!detailRes.ok) continue;

          const { data: fullMarket } = await detailRes.json() as any;
          const opinions: OpinionData[] = (fullMarket.opinions || []).map((op: any) => ({
            id: op.id,
            staker_address: op.staker_address,
            amount: Number(op.amount),
            opinion_text: op.opinion_text || "",
            opinion_score: op.opinion_score ?? op.prediction ?? 50,
            market_prediction: op.market_prediction ?? op.prediction ?? 50,
            backing_total: Number(op.backing_total || op.amount),
            slashing_total: Number(op.slashing_total || 0),
          }));

          await this.settlementCoordinator.queueMarketForSettlement(
            market.id,
            market.statement,
            opinions,
            Number(market.total_stake)
          );
        }
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "Failed to check for settlement candidates");
    }
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("Market monitor stopped");
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    logger.info("Starting Opinion-Markets Triple-Check Oracle Service");

    const scorer = new TripleCheckScorer(config.anthropicApiKey);
    const coordinator = new SettlementCoordinator(scorer);
    const settlementMonitor = new MarketMonitor(coordinator);
    const liveMonitor = new LiveMarketMonitor(scorer);

    await settlementMonitor.start();
    await liveMonitor.start();

    logger.info("Triple-Check Oracle running (settlement + live scoring). Press Ctrl+C to stop.");

    process.on("SIGINT", async () => {
      logger.info("Shutting down gracefully");
      settlementMonitor.stop();
      liveMonitor.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down");
      settlementMonitor.stop();
      liveMonitor.stop();
      process.exit(0);
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to start oracle service");
    process.exit(1);
  }
}

main();

export { TripleCheckScorer, SettlementCoordinator, MarketMonitor, LiveMarketMonitor };
// Legacy alias for backward compatibility
export { TripleCheckScorer as SentimentAnalyzer };
