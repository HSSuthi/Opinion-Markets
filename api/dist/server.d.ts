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
import { Express } from 'express';
declare const app: Express;
export default app;
//# sourceMappingURL=server.d.ts.map