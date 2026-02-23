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
  prediction: number;      // 0–100 agreement prediction
  backing_total: number;   // total backing from peers
  slashing_total: number;  // total slashing from peers
}

interface ScoredOpinion extends OpinionData {
  net_backing: number;
  weight_score: number;    // Layer 1: 0–100
  ai_score: number;        // Layer 3: 0–100
  consensus_score: number; // Layer 2: 0–100
  combined_bps: number;    // 0–10000 (for on-chain precision)
  combined_score: number;  // 0–100
  payout_share: number;    // 0.0–1.0 fraction of distributable pool
  payout_amount: number;   // micro-USDC
}

// ── Triple-Check Scorer ────────────────────────────────────────────────────────

class TripleCheckScorer {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey, timeout: 60000 });
  }

  // ── Layer 2: Crowd Score ────────────────────────────────────────────────────

  /**
   * Volume-weighted mean of all agreement predictions.
   * Users who staked MORE (original + reactions) have more influence.
   *
   * crowdScore = Σ(prediction_i × total_activity_i) / Σ(total_activity_i)
   */
  calculateCrowdScore(opinions: OpinionData[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const op of opinions) {
      const activity = op.amount + op.backing_total + op.slashing_total;
      weightedSum += (op.prediction || 50) * activity;
      totalWeight += activity;
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

  // ── Layer 2: Consensus Scores ───────────────────────────────────────────────

  /**
   * How close was each staker's prediction to the crowd mean?
   * consensus_i = max(0, 100 - |prediction_i - crowdScore|)
   */
  calculateConsensusScores(opinions: OpinionData[], crowdScore: number): Map<string, number> {
    const scores = new Map<string, number>();
    for (const op of opinions) {
      const diff = Math.abs((op.prediction || 50) - crowdScore);
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
    const consensusScores = this.calculateConsensusScores(opinions, crowdScore);

    // Layer 3
    logger.info("Calling Claude AI to score opinion texts...");
    const aiScores = await this.scoreOpinionTexts(statement, opinions);

    // Composite
    const PROTOCOL_FEE_BPS = 1000; // 10%
    const protocolFee = Math.floor((totalStakeMicroUsdc * PROTOCOL_FEE_BPS) / 10_000);
    const distributablePool = totalStakeMicroUsdc - protocolFee;

    const scored: ScoredOpinion[] = opinions.map((op) => {
      const W = weightScores.get(op.id) ?? 50;
      const C = consensusScores.get(op.id) ?? 50;
      const A = aiScores.get(op.id) ?? 50;

      // S = W*50 + C*30 + A*20  (integer basis points, range 0–10000)
      const combined_bps = W * 50 + C * 30 + A * 20;
      const combined_score = Math.round(combined_bps / 100);

      return {
        ...op,
        net_backing: Number(op.backing_total) - Number(op.slashing_total),
        weight_score: W,
        consensus_score: C,
        ai_score: A,
        combined_bps,
        combined_score,
        payout_share: 0, // calculated after
        payout_amount: 0,
      };
    });

    // Calculate total combined_bps for proportional distribution
    const totalCombinedBps = scored.reduce((sum, op) => sum + op.combined_bps, 0);

    if (totalCombinedBps === 0) {
      // Edge case: all scores zero — distribute equally
      const equalShare = Math.floor(distributablePool / scored.length);
      scored.forEach((op) => {
        op.payout_share = 1 / scored.length;
        op.payout_amount = equalShare;
      });
    } else {
      scored.forEach((op) => {
        op.payout_share = op.combined_bps / totalCombinedBps;
        op.payout_amount = Math.floor((op.combined_bps * distributablePool) / totalCombinedBps);
      });
    }

    return { crowdScore, scoredOpinions: scored };
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

        // Step 2: Compute all three layers
        const { crowdScore, scoredOpinions } =
          await this.scorer.computeTripleCheckScores(statement, opinions, totalStake);

        // Step 3: Write scores to blockchain
        await this.writeScoresOnChain(marketId, score, confidence, summary, crowdScore, scoredOpinions);

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
   */
  private async writeScoresOnChain(
    marketId: string,
    sentimentScore: number,
    confidence: number,
    summary: string,
    crowdScore: number,
    scoredOpinions: ScoredOpinion[]
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
    //        .settleOpinion(Math.round(crowdScore), op.weight_score, op.consensus_score)
    //        .accounts({ oracleAuthority, config, market, opinion: opinionPDA })
    //        .rpc();
    //    }
    //
    // 4. await program.methods
    //      .finalizeSettlement()
    //      .accounts({ oracleAuthority, config, market, escrowTokenAccount, treasuryUsdc, tokenProgram })
    //      .rpc();

    logger.info(
      {
        marketId,
        sentimentScore,
        crowdScore: Math.round(crowdScore),
        opinionCount: scoredOpinions.length,
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
            consensus_score: op.consensus_score,
            ai_score: op.ai_score,
            composite_score: op.combined_score,
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
    const sorted = [...opinions].sort((a, b) => b.combined_score - a.combined_score);
    const totalPool = opinions.reduce((s, o) => s + o.amount + o.backing_total, 0);

    logger.info(`\n${"═".repeat(80)}`);
    logger.info(`Triple-Check Settlement Report`);
    logger.info(`Market: "${statement.substring(0, 70)}"`);
    logger.info(`Crowd Score (volume-weighted mean): ${crowdScore.toFixed(1)}`);
    logger.info(`Total Pool: $${(totalPool / 1_000_000).toFixed(2)} USDC`);
    logger.info(`${"─".repeat(80)}`);

    const header = `${"Staker".padEnd(12)} ${"W".padStart(4)} ${"C".padStart(4)} ${"A".padStart(4)} ${"S".padStart(4)} ${"Share%".padStart(7)} ${"Payout".padStart(8)}`;
    logger.info(header);

    for (const op of sorted) {
      const staker = op.staker_address.slice(0, 6) + "..." + op.staker_address.slice(-4);
      const payout = `$${(op.payout_amount / 1_000_000).toFixed(2)}`;
      logger.info(
        `${staker.padEnd(12)} ${String(op.weight_score).padStart(4)} ${String(op.consensus_score).padStart(4)} ${String(op.ai_score).padStart(4)} ${String(op.combined_score).padStart(4)} ${(op.payout_share * 100).toFixed(1).padStart(6)}% ${payout.padStart(8)}`
      );
    }
    logger.info(`${"═".repeat(80)}`);
  }
}

// ── Market Monitor ─────────────────────────────────────────────────────────────

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
            prediction: op.prediction ?? 50,
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
    const monitor = new MarketMonitor(coordinator);

    await monitor.start();

    logger.info("Triple-Check Oracle running. Press Ctrl+C to stop.");

    process.on("SIGINT", async () => {
      logger.info("Shutting down gracefully");
      monitor.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down");
      monitor.stop();
      process.exit(0);
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to start oracle service");
    process.exit(1);
  }
}

main();

export { TripleCheckScorer, SettlementCoordinator, MarketMonitor };
// Legacy alias for backward compatibility
export { TripleCheckScorer as SentimentAnalyzer };
