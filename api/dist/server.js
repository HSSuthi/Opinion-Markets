"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const pino = __importStar(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
const database_1 = require("./database");
const markets_1 = __importDefault(require("./routes/markets"));
const user_1 = __importDefault(require("./routes/user"));
const sentiment_1 = __importDefault(require("./routes/sentiment"));
// Load environment variables
dotenv_1.default.config();
// Initialize logger
const logger = pino.pino();
const httpLogger = (0, pino_http_1.default)({ logger });
// Environment configuration
const config = {
    port: parseInt(process.env.PORT || '3001'),
    databaseUrl: process.env.DATABASE_URL,
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    programId: process.env.PROGRAM_ID || '2NaUpg4jEZVGDBmmuKYLdsAfSGKwHxjghhfgVpQvZJYu',
    nodeEnv: process.env.NODE_ENV || 'development',
};
// Validate required configuration
const requiredEnvVars = ['DATABASE_URL'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}
// Initialize Express app
const app = (0, express_1.default)();
// Middleware setup
app.use(httpLogger);
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Custom middleware to attach logger
app.use((req, res, next) => {
    req.logger = logger.child({
        requestId: req.headers['x-request-id'] || undefined,
        method: req.method,
        path: req.path,
    });
    next();
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
    });
});
// API version endpoint
app.get('/api/version', (req, res) => {
    res.json({
        version: '0.1.0',
        name: 'Opinion Markets API',
        status: 'beta',
    });
});
// ─── ROUTE REGISTRATION ────────────────────────────────────────────────────
app.use('/', markets_1.default);
app.use('/', user_1.default);
app.use('/', sentiment_1.default);
// ─── ERROR HANDLING ────────────────────────────────────────────────────────
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        path: req.path,
    });
});
// Global error handler
app.use((error, req, res, next) => {
    req.logger.error({ error }, 'Unhandled error');
    res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Internal server error',
    });
});
// ─── SERVER STARTUP ────────────────────────────────────────────────────────
/**
 * Start the server and initialize database
 */
async function startServer() {
    try {
        // Initialize database connection
        await (0, database_1.initializeDatabase)();
        // Start Express server
        const server = app.listen(config.port, () => {
            logger.info({
                port: config.port,
                environment: config.nodeEnv,
                programId: config.programId,
                solanaRpc: config.solanaRpcUrl,
            }, '✅ API server listening');
        });
        // Graceful shutdown handler
        const gracefulShutdown = async (signal) => {
            logger.info(`${signal} received, shutting down gracefully...`);
            server.close(async () => {
                try {
                    await (0, database_1.closeDatabase)();
                    logger.info('Server and database closed successfully');
                    process.exit(0);
                }
                catch (error) {
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
    }
    catch (error) {
        logger.fatal(error, 'Failed to start server');
        process.exit(1);
    }
}
// Start server if not imported as module
if (require.main === module) {
    startServer();
}
exports.default = app;
//# sourceMappingURL=server.js.map