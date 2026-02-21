import "reflect-metadata";
/**
 * Opinion-Markets REST API Server
 *
 * Provides RESTful endpoints for:
 * - Market queries and creation
 * - User position tracking
 * - Sentiment history and analytics
 * - Event indexing
 *
 * Environment variables:
 *   PORT: API server port (default: 3001)
 *   DATABASE_URL: PostgreSQL connection string (REQUIRED)
 *   REDIS_HOST: Redis host (default: localhost)
 *   REDIS_PORT: Redis port (default: 6379)
 *   SOLANA_RPC_URL: Solana RPC endpoint (default: devnet)
 *   PROGRAM_ID: Opinion-Markets program ID
 *   NODE_ENV: development | production
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as pino from 'pino';
import pinoHttp from 'pino-http';
import { initializeDatabase, closeDatabase } from './database';
import marketRoutes from './routes/markets';
import userRoutes from './routes/user';
import sentimentRoutes from './routes/sentiment';

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
  // Custom response methods
}

// Environment configuration
const config = {
  port: parseInt(process.env.PORT || '3001'),
  databaseUrl: process.env.DATABASE_URL,
  solanaRpcUrl:
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  programId:
    process.env.PROGRAM_ID || '2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu',
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate required configuration
const requiredEnvVars = ['DATABASE_URL'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  logger.error(
    `Missing required environment variables: ${missingVars.join(', ')}`
  );
  process.exit(1);
}

// Initialize Express app
const app: Express = express();

// Middleware setup
app.use(httpLogger);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom middleware to attach logger
app.use((req: ApiRequest, res: ApiResponse, next: NextFunction) => {
  req.logger = logger.child({
    requestId: req.headers['x-request-id'] || undefined,
    method: req.method,
    path: req.path,
  });
  next();
});

// Health check endpoint
app.get('/health', (req: ApiRequest, res: ApiResponse) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// API version endpoint
app.get('/api/version', (req: ApiRequest, res: ApiResponse) => {
  res.json({
    version: '0.1.0',
    name: 'Opinion Markets API',
    status: 'beta',
  });
});

// ─── ROUTE REGISTRATION ────────────────────────────────────────────────────

app.use('/', marketRoutes);
app.use('/', userRoutes);
app.use('/', sentimentRoutes);

// ─── ERROR HANDLING ────────────────────────────────────────────────────────

// 404 handler
app.use((req: ApiRequest, res: ApiResponse) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path,
  });
});

// Global error handler
app.use(
  (error: any, req: ApiRequest, res: ApiResponse, next: NextFunction) => {
    req.logger.error({ error }, 'Unhandled error');
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
);

// ─── SERVER STARTUP ────────────────────────────────────────────────────────

/**
 * Start the server and initialize database
 */
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();

    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info(
        {
          port: config.port,
          environment: config.nodeEnv,
          programId: config.programId,
          solanaRpc: config.solanaRpcUrl,
        },
        '✅ API server listening'
      );
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        try {
          await closeDatabase();
          logger.info('Server and database closed successfully');
          process.exit(0);
        } catch (error) {
          logger.error(error, 'Error during shutdown');
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown - taking too long');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Unhandled error handlers
    process.on('uncaughtException', (error) => {
      logger.fatal(error, 'Uncaught Exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, 'Unhandled Rejection');
      process.exit(1);
    });
  } catch (error) {
    logger.fatal(error, 'Failed to start server');
    process.exit(1);
  }
}

// Start server if not imported as module
if (require.main === module) {
  startServer();
}

export default app;
