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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
exports.initializeDatabase = initializeDatabase;
exports.closeDatabase = closeDatabase;
const typeorm_1 = require("typeorm");
const path = __importStar(require("path"));
const Market_1 = require("./entities/Market");
const Opinion_1 = require("./entities/Opinion");
const Position_1 = require("./entities/Position");
const UserPortfolio_1 = require("./entities/UserPortfolio");
/**
 * TypeORM DataSource configuration
 * Handles database connection for PostgreSQL
 *
 * Environment variables:
 *   DATABASE_URL: PostgreSQL connection string
 *   NODE_ENV: development | production | test
 */
const isDev = process.env.NODE_ENV !== 'production';
// Parse DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required. Format: postgres://user:pass@localhost:5432/dbname');
}
// Connection options based on environment
const synchronize = isDev; // Auto-sync schema in development (ONLY dev!)
const logging = isDev && process.env.DEBUG_SQL === 'true'; // Log SQL queries in dev if DEBUG_SQL=true
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    url: databaseUrl,
    synchronize, // ⚠️ DANGEROUS in production - use migrations instead
    logging,
    entities: [Market_1.Market, Opinion_1.Opinion, Position_1.Position, UserPortfolio_1.UserPortfolio],
    migrations: [path.join(__dirname, 'migrations', '*.ts')],
    migrationsRun: false, // Manually run migrations
    subscribers: [],
    cache: {
        type: 'redis',
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        duration: 30000, // 30 seconds default cache
    },
    poolSize: 20,
    maxQueryExecutionTime: 30000, // 30 second timeout
    connectTimeoutMS: 5000,
});
/**
 * Initialize database connection
 * Call this in your server startup
 */
async function initializeDatabase() {
    try {
        console.log('Initializing database connection...');
        if (!exports.AppDataSource.isInitialized) {
            await exports.AppDataSource.initialize();
            console.log('✅ Database connected successfully');
            // Run migrations in production
            if (!isDev && !synchronize) {
                console.log('Running pending migrations...');
                await exports.AppDataSource.runMigrations();
                console.log('✅ Migrations completed');
            }
        }
    }
    catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}
/**
 * Close database connection (for graceful shutdown)
 */
async function closeDatabase() {
    if (exports.AppDataSource.isInitialized) {
        await exports.AppDataSource.destroy();
        console.log('Database connection closed');
    }
}
//# sourceMappingURL=database.js.map