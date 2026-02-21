/**
 * Opinion-Markets REST API Server
 *
 * Provides RESTful endpoints for:
 * - Market queries and creation
 * - User position tracking
 * - Event indexing and streaming
 * - Transaction estimation
 *
 * Environment variables:
 *   PORT: API server port (default: 3001)
 *   DATABASE_URL: PostgreSQL connection string
 *   REDIS_URL: Redis connection string
 *   SOLANA_RPC_URL: Solana RPC endpoint
 *   PROGRAM_ID: Opinion-Markets program ID
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import * as pino from "pino";
import pinoHttp from "pino-http";

// Load environment variables
dotenv.config();

// Initialize logger
const logger = pino.pino();
const httpLogger = pinoHttp({ logger });

// Middleware interfaces
interface ApiRequest extends Request {
  logger: pino.Logger;
}

interface ApiResponse extends Response {
  // Add custom response methods as needed
}

// Environment configuration
const config = {
  port: parseInt(process.env.PORT || "3001"),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  programId: process.env.PROGRAM_ID || "2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu",
  nodeEnv: process.env.NODE_ENV || "development",
};

// Validate required configuration
const requiredConfig = ["databaseUrl"];
for (const key of requiredConfig) {
  if (!config[key as keyof typeof config]) {
    logger.warn(`Missing required environment variable: ${key}`);
  }
}

// Initialize Express app
const app: Express = express();

// Middleware setup
app.use(httpLogger);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom middleware to attach logger
app.use((req: ApiRequest, res: ApiResponse, next: NextFunction) => {
  req.logger = logger.child({
    requestId: req.headers["x-request-id"] || undefined,
    method: req.method,
    path: req.path,
  });
  next();
});

// Health check endpoint
app.get("/health", (req: ApiRequest, res: ApiResponse) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// ─── MARKETS API ───────────────────────────────────────────────────────────

/**
 * GET /markets
 * List all markets with optional filtering
 *
 * Query parameters:
 *   - state: Filter by market state (Active, Closed, Scored, AwaitingRandomness, Settled)
 *   - limit: Number of results (default: 50, max: 1000)
 *   - offset: Pagination offset (default: 0)
 *   - sortBy: Sort field (createdAt, closesAt, totalStake)
 *   - sortOrder: asc or desc
 *
 * Response:
 *   {
 *     data: [{ id, statement, state, createdAt, closesAt, totalStake, stakerCount }],
 *     pagination: { limit, offset, total }
 *   }
 */
app.get("/markets", (req: ApiRequest, res: ApiResponse) => {
  req.logger.info("GET /markets");
  res.json({
    data: [],
    pagination: { limit: 50, offset: 0, total: 0 },
  });
});

/**
 * GET /markets/:id
 * Get details for a specific market
 *
 * Path parameters:
 *   - id: Market PDA address
 *
 * Response:
 *   {
 *     id: string,
 *     statement: string,
 *     state: string,
 *     creator: string,
 *     createdAt: number,
 *     closesAt: number,
 *     totalStake: string,
 *     stakerCount: number,
 *     winner: string | null,
 *     sentimentScore: number | null,
 *     opinions: [{ staker, amount, ipfs_cid }]
 *   }
 */
app.get("/markets/:id", (req: ApiRequest, res: ApiResponse) => {
  const { id } = req.params;
  req.logger.info({ marketId: id }, "GET /markets/:id");
  res.json({
    id,
    statement: "Sample market statement",
    state: "Active",
    creator: "",
    createdAt: Date.now(),
    closesAt: Date.now() + 86_400_000,
    totalStake: "0",
    stakerCount: 0,
    winner: null,
    sentimentScore: null,
    opinions: [],
  });
});

/**
 * POST /markets
 * Create a new opinion market (auth required)
 *
 * Body:
 *   {
 *     statement: string (required, max 280 chars),
 *     duration: "24h" | "3d" | "7d" | "14d" (required),
 *     signature: string (required for wallet auth)
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     transactionHash: string,
 *     market: { id, statement, closesAt }
 *   }
 */
app.post("/markets", (req: ApiRequest, res: ApiResponse) => {
  const { statement, duration } = req.body;
  req.logger.info({ statement, duration }, "POST /markets");

  // Validation would go here
  if (!statement || !duration) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  res.status(201).json({
    success: true,
    transactionHash: "",
    market: {
      id: "",
      statement,
      closesAt: Date.now(),
    },
  });
});

// ─── OPINIONS & STAKING ────────────────────────────────────────────────────

/**
 * POST /markets/:id/stake
 * Stake USDC on an opinion (auth required)
 *
 * Path parameters:
 *   - id: Market PDA address
 *
 * Body:
 *   {
 *     amount: string (in micro-USDC),
 *     opinionText: string,
 *     signature: string
 *   }
 *
 * Response:
 *   {
 *     success: boolean,
 *     transactionHash: string,
 *     stake: { market, staker, amount, ipfsCid }
 *   }
 */
app.post("/markets/:id/stake", (req: ApiRequest, res: ApiResponse) => {
  const { id } = req.params;
  const { amount, opinionText } = req.body;
  req.logger.info({ marketId: id, amount }, "POST /markets/:id/stake");

  res.status(201).json({
    success: true,
    transactionHash: "",
    stake: {
      market: id,
      staker: "",
      amount,
      ipfsCid: "",
    },
  });
});

/**
 * GET /markets/:id/opinions
 * Get all opinions for a market
 *
 * Response:
 *   {
 *     market: string,
 *     opinions: [
 *       {
 *         staker: string,
 *         amount: string,
 *         ipfsCid: string,
 *         textHash: string,
 *         createdAt: number
 *       }
 *     ]
 *   }
 */
app.get("/markets/:id/opinions", (req: ApiRequest, res: ApiResponse) => {
  const { id } = req.params;
  req.logger.info({ marketId: id }, "GET /markets/:id/opinions");
  res.json({
    market: id,
    opinions: [],
  });
});

// ─── MARKET OPERATIONS ─────────────────────────────────────────────────────

/**
 * POST /markets/:id/close
 * Close a market (permissionless)
 *
 * Response:
 *   {
 *     success: boolean,
 *     transactionHash: string,
 *     market: { id, state }
 *   }
 */
app.post("/markets/:id/close", (req: ApiRequest, res: ApiResponse) => {
  const { id } = req.params;
  req.logger.info({ marketId: id }, "POST /markets/:id/close");
  res.json({
    success: true,
    transactionHash: "",
    market: { id, state: "Closed" },
  });
});

/**
 * GET /markets/:id/events
 * Stream market events (WebSocket endpoint)
 *
 * Events:
 *   - MarketCreated
 *   - OpinionStaked
 *   - MarketClosed
 *   - SentimentRecorded
 *   - LotterySettled
 *   - VrfRandomnessRequested
 *   - VrfRandomnessFulfilled
 */
app.get("/markets/:id/events", (req: ApiRequest, res: ApiResponse) => {
  const { id } = req.params;
  req.logger.info({ marketId: id }, "GET /markets/:id/events");
  res.json({
    note: "WebSocket endpoint - upgrade connection for event streaming",
  });
});

// ─── USER PORTFOLIO ────────────────────────────────────────────────────────

/**
 * GET /user/:wallet
 * Get user portfolio and position history
 *
 * Path parameters:
 *   - wallet: Solana wallet address
 *
 * Query parameters:
 *   - includeSettled: Include settled markets (default: true)
 *   - limit: Number of positions (default: 50)
 *
 * Response:
 *   {
 *     wallet: string,
 *     positions: [
 *       {
 *         market: string,
 *         stake: string,
 *         state: string,
 *         prize: string | null
 *       }
 *     ],
 *     totalStaked: string,
 *     totalPrizeWon: string,
 *     winRate: number
 *   }
 */
app.get("/user/:wallet", (req: ApiRequest, res: ApiResponse) => {
  const { wallet } = req.params;
  req.logger.info({ wallet }, "GET /user/:wallet");
  res.json({
    wallet,
    positions: [],
    totalStaked: "0",
    totalPrizeWon: "0",
    winRate: 0,
  });
});

// ─── TRANSACTION ESTIMATION ────────────────────────────────────────────────

/**
 * POST /tx/estimate
 * Estimate transaction cost (compute units, fees)
 *
 * Body:
 *   {
 *     instruction: string (e.g., "createMarket", "stakeOpinion"),
 *     params: {} // instruction-specific parameters
 *   }
 *
 * Response:
 *   {
 *     instruction: string,
 *     estimatedCU: number,
 *     estimatedFee: string,
 *     priority: "low" | "medium" | "high"
 *   }
 */
app.post("/tx/estimate", (req: ApiRequest, res: ApiResponse) => {
  const { instruction } = req.body;
  req.logger.info({ instruction }, "POST /tx/estimate");
  res.json({
    instruction,
    estimatedCU: 5000,
    estimatedFee: "0",
    priority: "medium",
  });
});

// ─── ERROR HANDLING ────────────────────────────────────────────────────────

/**
 * 404 handler
 */
app.use((req: ApiRequest, res: ApiResponse) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
  });
});

/**
 * Global error handler
 */
app.use((err: any, req: ApiRequest, res: ApiResponse, next: NextFunction) => {
  req.logger.error(err, "Unhandled error");
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// ─── SERVER STARTUP ────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      environment: config.nodeEnv,
      programId: config.programId,
      solanaRpc: config.solanaRpcUrl,
    },
    "API server listening"
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

export default app;
