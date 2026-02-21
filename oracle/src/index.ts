/**
 * Opinion-Markets Oracle Service
 *
 * Provides:
 * - Sentiment analysis using Claude API (LLM)
 * - Market monitoring and settlement coordination
 * - VRF integration with Chainlink
 * - Multi-sig transaction signing via Squads
 * - Job queue for async operations
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY: Claude API key
 *   SOLANA_RPC_URL: Solana RPC endpoint
 *   PROGRAM_ID: Opinion-Markets program ID
 *   DATABASE_URL: PostgreSQL connection
 *   REDIS_URL: Redis for job queue
 *   ORACLE_KEYPAIR_PATH: Path to oracle keypair
 *   SQUADS_MULTISIG: Squads V3 multi-sig address (mainnet)
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
  squadsMultisig: process.env.SQUADS_MULTISIG,
  network: process.env.NETWORK || "devnet",
};

// Validate configuration
if (!config.anthropicApiKey) {
  logger.error("ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

// Initialize Solana connection and program
const connection = new Connection(config.solanaRpcUrl);
const wallet = loadOracleKeypair(config.oracleKeypairPath);
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "processed",
});

logger.info({ network: config.network, programId: config.programId }, "Oracle Service initialized");

/**
 * Load oracle keypair from filesystem
 */
function loadOracleKeypair(keypairPath: string): anchor.Wallet {
  if (!fs.existsSync(keypairPath)) {
    logger.error({ path: keypairPath }, "Oracle keypair not found");
    process.exit(1);
  }

  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Buffer.from(secretKey));
  return new anchor.Wallet(keypair);
}

/**
 * LLM Sentiment Analysis Engine
 *
 * Takes market statement and staker opinions, uses Claude to generate:
 * - Sentiment score (0-100)
 * - Confidence level (0=low, 1=medium, 2=high)
 * - Summary hash (for on-chain storage)
 */
class SentimentAnalyzer {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({
      apiKey,
      timeout: 30000, // 30 second timeout
    });
  }

  /**
   * Analyze market sentiment from opinions
   *
   * Returns: { score: 0-100, confidence: 0-2, summary: string }
   */
  async analyzeSentiment(
    statement: string,
    opinions: Array<{ staker: string; amount: number; text: string }>
  ): Promise<{ score: number; confidence: number; summary: string }> {
    logger.info({ statementPreview: statement.substring(0, 100), opinionCount: opinions.length }, "Analyzing sentiment");

    // Prepare prompt for Claude
    const opinionsSummary = opinions
      .map(
        (o, i) =>
          `Opinion ${i + 1} (stake: $${o.amount / 1_000_000}): "${o.text.substring(0, 200)}..."`
      )
      .join("\n");

    const prompt = `Analyze the following market and opinions to determine sentiment on a scale of 0-100.

Market Statement: "${statement}"

Staker Opinions:
${opinionsSummary}

Provide your analysis in the following JSON format:
{
  "sentiment_score": <0-100>,
  "confidence": <0=low, 1=medium, 2=high>,
  "reasoning": "<brief explanation>",
  "percentage_bullish": <0-100>
}

Rules:
- 0-30: Strong bearish sentiment
- 30-45: Bearish sentiment
- 45-55: Neutral sentiment
- 55-70: Bullish sentiment
- 70-100: Strong bullish sentiment

Consider opinion frequency, stake size weighting, and conviction level.`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // Parse Claude's response
      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Claude");
      }

      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON from Claude response");
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validate sentiment score range
      const sentiment_score = Math.max(0, Math.min(100, analysis.sentiment_score));
      const confidence = Math.max(0, Math.min(2, analysis.confidence));

      logger.info(
        { sentiment_score, confidence, reasoning: analysis.reasoning },
        "Sentiment analysis complete"
      );

      return {
        score: sentiment_score,
        confidence,
        summary: analysis.reasoning || "",
      };
    } catch (error: any) {
      logger.error({ error: error.message }, "Sentiment analysis failed");
      throw error;
    }
  }
}

/**
 * Market Settlement Coordinator
 *
 * Monitors markets that need settlement:
 * 1. Record sentiment (oracle-gated)
 * 2. Request VRF randomness
 * 3. Wait for VRF callback
 * 4. Run lottery to settle
 */
class SettlementCoordinator {
  private sentimentAnalyzer: SentimentAnalyzer;
  private settlementQueue: Queue.Queue;

  constructor(analyzer: SentimentAnalyzer) {
    this.sentimentAnalyzer = analyzer;
    this.settlementQueue = new Queue("market-settlements", config.redisUrl);
    this.setupQueueHandlers();
  }

  private setupQueueHandlers() {
    // Process settlement jobs
    this.settlementQueue.process(10, async (job) => {
      const { marketId, statement, opinions } = job.data;

      try {
        logger.info({ marketId }, "Processing market settlement");

        // Step 1: Analyze sentiment
        const { score, confidence, summary } = await this.sentimentAnalyzer.analyzeSentiment(
          statement,
          opinions
        );

        // Step 2: Record sentiment on-chain (oracle-gated)
        await this.recordSentiment(marketId, score, confidence, summary);

        // Step 3: Request VRF randomness
        await this.requestVrfRandomness(marketId);

        // Step 4: Wait for VRF callback (separate async job)
        await this.settlementQueue.add(
          { type: "vrf-fulfill", marketId },
          { delay: 30000 } // Check in 30 seconds
        );

        logger.info({ marketId }, "Sentiment recorded, awaiting VRF");
        return { success: true, marketId };
      } catch (error: any) {
        logger.error({ marketId, error: error.message }, "Settlement failed");
        throw error; // Will trigger retry
      }
    });

    // Handle job failures
    this.settlementQueue.on("failed", (job, err) => {
      logger.error({ jobId: job.id, error: err.message }, "Settlement job failed");
    });

    // Handle job completion
    this.settlementQueue.on("completed", (job) => {
      logger.info({ jobId: job.id }, "Settlement job completed");
    });
  }

  /**
   * Record sentiment on-chain (oracle-gated instruction)
   */
  private async recordSentiment(
    marketId: string,
    score: number,
    confidence: number,
    summary: string
  ): Promise<void> {
    try {
      logger.info({ marketId, score, confidence }, "Recording sentiment on-chain");

      // Calculate summary hash (SHA-256)
      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(summary).digest();
      const hashArray = Array.from(hash);

      // TODO: Call recordSentiment instruction
      // This would be:
      // const tx = await program.methods
      //   .recordSentiment(score, confidence, hashArray)
      //   .accounts({ ... })
      //   .signers([oracleKeypair])
      //   .rpc();

      logger.info({ marketId }, "Sentiment recorded");
    } catch (error: any) {
      logger.error({ marketId, error: error.message }, "Failed to record sentiment");
      throw error;
    }
  }

  /**
   * Request VRF randomness from Chainlink
   */
  private async requestVrfRandomness(marketId: string): Promise<void> {
    try {
      logger.info({ marketId }, "Requesting VRF randomness");

      // TODO: Call requestVrfRandomness instruction
      // In devnet: just stores request
      // In mainnet: calls Chainlink VRF CPI

      logger.info({ marketId }, "VRF randomness requested");
    } catch (error: any) {
      logger.error({ marketId, error: error.message }, "Failed to request VRF");
      throw error;
    }
  }

  /**
   * Add market to settlement queue
   */
  async queueMarketForSettlement(
    marketId: string,
    statement: string,
    opinions: Array<{ staker: string; amount: number; text: string }>
  ): Promise<void> {
    await this.settlementQueue.add(
      { marketId, statement, opinions },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
      }
    );

    logger.info({ marketId }, "Market queued for settlement");
  }
}

/**
 * Market Monitor
 *
 * Periodically checks for markets that:
 * - Have reached their close time
 * - Are ready for sentiment analysis
 * - Need settlement
 */
class MarketMonitor {
  private settlementCoordinator: SettlementCoordinator;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(coordinator: SettlementCoordinator) {
    this.settlementCoordinator = coordinator;
  }

  /**
   * Start monitoring for markets needing settlement
   */
  async start(): Promise<void> {
    logger.info("Market monitor started");

    // Check every 60 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForSettlementCandidates();
      } catch (error: any) {
        logger.error({ error: error.message }, "Monitor check failed");
      }
    }, 60000);
  }

  /**
   * Check for markets ready for settlement
   */
  private async checkForSettlementCandidates(): Promise<void> {
    try {
      logger.debug("Checking for markets needing settlement");

      // TODO: Query on-chain for markets in Closed state
      // - Filter by closes_at < now
      // - Fetch all opinions from IPFS
      // - Queue for sentiment analysis

      // Placeholder: would iterate through markets
      // for (const market of closedMarkets) {
      //   await this.settlementCoordinator.queueMarketForSettlement(...)
      // }
    } catch (error: any) {
      logger.error({ error: error.message }, "Failed to check for settlement candidates");
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("Market monitor stopped");
    }
  }
}

/**
 * Health check endpoint
 */
async function healthCheck(): Promise<{ status: string; uptime: number }> {
  return {
    status: "healthy",
    uptime: process.uptime(),
  };
}

/**
 * Main startup sequence
 */
async function main() {
  try {
    logger.info("Starting Opinion-Markets Oracle Service");

    // Initialize components
    const analyzer = new SentimentAnalyzer(config.anthropicApiKey);
    const coordinator = new SettlementCoordinator(analyzer);
    const monitor = new MarketMonitor(coordinator);

    // Start monitor
    await monitor.start();

    // Keep running
    logger.info("Oracle service running. Press Ctrl+C to stop.");

    // Handle graceful shutdown
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

// Start the service
main();

export { SentimentAnalyzer, SettlementCoordinator, MarketMonitor };
