import { DataSource } from 'typeorm';
import * as path from 'path';
import { Market } from './entities/Market';
import { Opinion } from './entities/Opinion';
import { Position } from './entities/Position';
import { UserPortfolio } from './entities/UserPortfolio';

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
  throw new Error(
    'DATABASE_URL environment variable is required. Format: postgres://user:pass@localhost:5432/dbname'
  );
}

// Connection options based on environment
const synchronize = isDev; // Auto-sync schema in development (ONLY dev!)
const logging = isDev && process.env.DEBUG_SQL === 'true'; // Log SQL queries in dev if DEBUG_SQL=true

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  synchronize, // ⚠️ DANGEROUS in production - use migrations instead
  logging,
  entities: [Market, Opinion, Position, UserPortfolio],
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
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('Initializing database connection...');

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ Database connected successfully');

      // Run migrations in production
      if (!isDev && !synchronize) {
        console.log('Running pending migrations...');
        await AppDataSource.runMigrations();
        console.log('✅ Migrations completed');
      }
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Close database connection (for graceful shutdown)
 */
export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('Database connection closed');
  }
}
