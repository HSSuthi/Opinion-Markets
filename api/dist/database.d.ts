import { DataSource } from 'typeorm';
export declare const AppDataSource: DataSource;
/**
 * Initialize database connection
 * Call this in your server startup
 */
export declare function initializeDatabase(): Promise<void>;
/**
 * Close database connection (for graceful shutdown)
 */
export declare function closeDatabase(): Promise<void>;
//# sourceMappingURL=database.d.ts.map