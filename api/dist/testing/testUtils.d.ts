/**
 * Opinion Markets - Testing Utilities
 * Provides helper functions for API testing, data generation, and validation
 *
 * Usage in tests:
 * ```
 * const testUtils = new TestUtils(API_URL);
 * const market = await testUtils.createMarket('Will SOL reach $500?', 86400);
 * await testUtils.stakeOpinion(market.id, 5_000_000, 'bullish');
 * ```
 */
export interface TestMarket {
    id: string;
    uuid: string;
    statement: string;
    creator_address: string;
    created_at: string;
    closes_at: string;
    state: string;
    total_stake: number;
    staker_count: number;
    sentiment_score: number | null;
    sentiment_confidence: number | null;
    winner: string | null;
    winner_prize: number | null;
}
export interface TestOpinion {
    id: string;
    market_id: string;
    staker_address: string;
    amount: number;
    opinion_text: string | null;
    text_hash: string;
    created_at: string;
}
export interface TestPosition {
    id: string;
    wallet_address: string;
    market_id: string;
    stake_amount: number;
    prize_amount: number | null;
    market_state: string;
    created_at: string;
    settled_at: string | null;
}
export interface TestPortfolio {
    wallet_address: string;
    total_staked: number;
    total_prize_won: number;
    positions_count: number;
    win_count: number;
    win_rate: number;
    roi: number;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    pagination?: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
    };
}
export declare class TestUtils {
    private client;
    private baseUrl;
    constructor(baseUrl?: string);
    /**
     * Check API health status
     */
    checkHealth(): Promise<boolean>;
    /**
     * Get API version info
     */
    getVersion(): Promise<any>;
    /**
     * Create a test market
     * @param statement Market statement (max 280 chars)
     * @param duration Duration in seconds
     * @param creator Creator wallet address (defaults to random)
     */
    createMarket(statement: string, duration: number, creator?: string): Promise<TestMarket>;
    /**
     * Get all markets with optional filtering
     */
    getMarkets(options?: {
        state?: string;
        limit?: number;
        offset?: number;
        sortBy?: string;
        sortOrder?: string;
    }): Promise<{
        markets: TestMarket[];
        pagination: any;
    }>;
    /**
     * Get a specific market with opinions
     */
    getMarket(marketId: string): Promise<TestMarket & {
        opinions: TestOpinion[];
    }>;
    /**
     * Stake an opinion on a market
     */
    stakeOpinion(marketId: string, amount: number, opinionText?: string, staker?: string): Promise<TestOpinion>;
    /**
     * Get user portfolio summary
     */
    getUserPortfolio(wallet: string): Promise<TestPortfolio>;
    /**
     * Get user positions with pagination
     */
    getUserPositions(wallet: string, limit?: number, offset?: number): Promise<{
        positions: TestPosition[];
        pagination: any;
    }>;
    /**
     * Get sentiment history of settled markets
     */
    getSentimentHistory(limit?: number, offset?: number): Promise<any>;
    /**
     * Search markets by topic
     */
    searchTopic(query: string, limit?: number): Promise<any>;
    /**
     * Validate market statement length
     */
    validateStatement(statement: string): {
        valid: boolean;
        error?: string;
    };
    /**
     * Validate stake amount
     */
    validateStakeAmount(amount: number): {
        valid: boolean;
        error?: string;
    };
    /**
     * Validate wallet address format
     */
    validateWallet(wallet: string): {
        valid: boolean;
        error?: string;
    };
    /**
     * Generate a random wallet address
     */
    randomWallet(): string;
    /**
     * Generate test market data
     */
    generateMarket(overrides?: Partial<TestMarket>): TestMarket;
    /**
     * Generate test opinion data
     */
    generateOpinion(marketId: string, overrides?: Partial<TestOpinion>): TestOpinion;
    /**
     * Run a complete market lifecycle test
     */
    testFullLifecycle(): Promise<{
        market: TestMarket;
        opinions: TestOpinion[];
        portfolio: TestPortfolio;
    }>;
    /**
     * Test error handling for invalid inputs
     */
    testErrorHandling(): Promise<void>;
    /**
     * Test pagination
     */
    testPagination(): Promise<void>;
}
/**
 * Create a new test utilities instance
 */
export declare function createTestUtils(baseUrl?: string): TestUtils;
/**
 * Format USDC amount for display
 */
export declare function formatUSDC(microUsdc: number): string;
/**
 * Convert seconds to human-readable duration
 */
export declare function formatDuration(seconds: number): string;
//# sourceMappingURL=testUtils.d.ts.map