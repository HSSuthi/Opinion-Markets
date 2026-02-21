"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestUtils = void 0;
exports.createTestUtils = createTestUtils;
exports.formatUSDC = formatUSDC;
exports.formatDuration = formatDuration;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
// ─────────────────────────────────────────────────────────────────────────────
// TEST UTILITIES CLASS
// ─────────────────────────────────────────────────────────────────────────────
class TestUtils {
    constructor(baseUrl = 'http://localhost:3001') {
        this.baseUrl = baseUrl;
        this.client = axios_1.default.create({
            baseURL: baseUrl,
            validateStatus: () => true, // Don't throw on any status code
        });
    }
    // ─────────────────────────────────────────────────────────────────────────
    // HEALTH & CONNECTIVITY
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Check API health status
     */
    async checkHealth() {
        try {
            const response = await this.client.get('/health');
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
    /**
     * Get API version info
     */
    async getVersion() {
        const response = await this.client.get('/api/version');
        return response.data;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // MARKET OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Create a test market
     * @param statement Market statement (max 280 chars)
     * @param duration Duration in seconds
     * @param creator Creator wallet address (defaults to random)
     */
    async createMarket(statement, duration, creator = this.randomWallet()) {
        const response = await this.client.post('/markets', {
            statement,
            duration,
            creator,
            signature: 'mock-signature', // In production, would be real signature
        });
        if (!response.data.success || !response.data.data) {
            throw new Error(`Failed to create market: ${response.data.error}`);
        }
        return response.data.data;
    }
    /**
     * Get all markets with optional filtering
     */
    async getMarkets(options = {}) {
        const params = new URLSearchParams();
        if (options.state)
            params.append('state', options.state);
        if (options.limit)
            params.append('limit', options.limit.toString());
        if (options.offset)
            params.append('offset', options.offset.toString());
        if (options.sortBy)
            params.append('sortBy', options.sortBy);
        if (options.sortOrder)
            params.append('sortOrder', options.sortOrder);
        const response = await this.client.get(`/markets?${params.toString()}`);
        if (!response.data.success) {
            throw new Error(`Failed to fetch markets: ${response.data.error}`);
        }
        return {
            markets: response.data.data || [],
            pagination: response.data.pagination,
        };
    }
    /**
     * Get a specific market with opinions
     */
    async getMarket(marketId) {
        const response = await this.client.get(`/markets/${marketId}`);
        if (!response.data.success || !response.data.data) {
            throw new Error(`Market not found: ${marketId}`);
        }
        return response.data.data;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // OPINION STAKING
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Stake an opinion on a market
     */
    async stakeOpinion(marketId, amount, opinionText = 'bullish', staker = this.randomWallet()) {
        const response = await this.client.post(`/markets/${marketId}/stake`, {
            staker,
            amount,
            opinion_text: opinionText,
            signature: 'mock-signature',
        });
        if (!response.data.success || !response.data.data) {
            throw new Error(`Failed to stake opinion: ${response.data.error}`);
        }
        return response.data.data;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // USER PORTFOLIO
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Get user portfolio summary
     */
    async getUserPortfolio(wallet) {
        const response = await this.client.get(`/user/${wallet}`);
        if (!response.data.success || !response.data.data) {
            throw new Error(`Portfolio not found for ${wallet}`);
        }
        return response.data.data;
    }
    /**
     * Get user positions with pagination
     */
    async getUserPositions(wallet, limit = 50, offset = 0) {
        const response = await this.client.get(`/user/${wallet}/positions?limit=${limit}&offset=${offset}`);
        if (!response.data.success) {
            throw new Error(`Failed to fetch positions: ${response.data.error}`);
        }
        return {
            positions: response.data.data || [],
            pagination: response.data.pagination,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // SENTIMENT & ANALYTICS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Get sentiment history of settled markets
     */
    async getSentimentHistory(limit = 50, offset = 0) {
        const response = await this.client.get(`/sentiment/history?limit=${limit}&offset=${offset}`);
        if (!response.data.success) {
            throw new Error(`Failed to fetch sentiment history: ${response.data.error}`);
        }
        return response.data.data;
    }
    /**
     * Search markets by topic
     */
    async searchTopic(query, limit = 20) {
        const response = await this.client.get(`/sentiment/topic?q=${encodeURIComponent(query)}&limit=${limit}`);
        if (!response.data.success) {
            throw new Error(`Search failed: ${response.data.error}`);
        }
        return response.data.data;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // VALIDATION HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Validate market statement length
     */
    validateStatement(statement) {
        if (!statement)
            return { valid: false, error: 'Statement is required' };
        if (statement.length > 280) {
            return { valid: false, error: 'Statement exceeds 280 characters' };
        }
        return { valid: true };
    }
    /**
     * Validate stake amount
     */
    validateStakeAmount(amount) {
        const MIN_STAKE = 500_000; // $0.50
        const MAX_STAKE = 10_000_000; // $10.00
        if (!Number.isFinite(amount)) {
            return { valid: false, error: 'Amount must be a finite number' };
        }
        if (amount < MIN_STAKE) {
            return {
                valid: false,
                error: `Amount too low (min: $${MIN_STAKE / 1_000_000})`,
            };
        }
        if (amount > MAX_STAKE) {
            return {
                valid: false,
                error: `Amount too high (max: $${MAX_STAKE / 1_000_000})`,
            };
        }
        return { valid: true };
    }
    /**
     * Validate wallet address format
     */
    validateWallet(wallet) {
        if (!wallet || wallet.length < 40) {
            return { valid: false, error: 'Invalid wallet address' };
        }
        return { valid: true };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // DATA GENERATION
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Generate a random wallet address
     */
    randomWallet() {
        return `wallet_${(0, uuid_1.v4)().slice(0, 36)}`;
    }
    /**
     * Generate test market data
     */
    generateMarket(overrides = {}) {
        const now = new Date();
        const closes = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return {
            id: `market_${(0, uuid_1.v4)()}`,
            uuid: (0, uuid_1.v4)(),
            statement: 'Will this test market succeed?',
            creator_address: this.randomWallet(),
            created_at: now.toISOString(),
            closes_at: closes.toISOString(),
            state: 'Active',
            total_stake: 0,
            staker_count: 0,
            sentiment_score: null,
            sentiment_confidence: null,
            winner: null,
            winner_prize: null,
            ...overrides,
        };
    }
    /**
     * Generate test opinion data
     */
    generateOpinion(marketId, overrides = {}) {
        return {
            id: (0, uuid_1.v4)(),
            market_id: marketId,
            staker_address: this.randomWallet(),
            amount: 5_000_000, // $5
            opinion_text: 'This is a test opinion',
            text_hash: '0'.repeat(64), // Mock SHA256
            created_at: new Date().toISOString(),
            ...overrides,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // TEST SCENARIOS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Run a complete market lifecycle test
     */
    async testFullLifecycle() {
        console.log('🧪 Starting full lifecycle test...\n');
        // 1. Create market
        console.log('1️⃣  Creating market...');
        const market = await this.createMarket('Will Bitcoin reach $100k by 2026?', 86400 // 24 hours
        );
        console.log(`   ✅ Market created: ${market.id}`);
        // 2. Get market details
        console.log('\n2️⃣  Fetching market details...');
        const marketDetails = await this.getMarket(market.id);
        console.log(`   ✅ Opinions: ${marketDetails.opinions?.length || 0}`);
        // 3. Stake multiple opinions
        console.log('\n3️⃣  Staking opinions...');
        const opinions = [];
        const wallets = [this.randomWallet(), this.randomWallet(), this.randomWallet()];
        for (const wallet of wallets) {
            const opinion = await this.stakeOpinion(market.id, 5_000_000, `Opinion from ${wallet.slice(0, 10)}...`, wallet);
            opinions.push(opinion);
            console.log(`   ✅ Opinion staked from ${wallet.slice(0, 10)}...`);
        }
        // 4. Get updated market
        console.log('\n4️⃣  Getting updated market...');
        const updatedMarket = await this.getMarket(market.id);
        console.log(`   ✅ Total stake: $${updatedMarket.total_stake / 1_000_000}`);
        console.log(`   ✅ Staker count: ${updatedMarket.staker_count}`);
        // 5. Get portfolio for first staker
        console.log('\n5️⃣  Getting portfolio...');
        const portfolio = await this.getUserPortfolio(wallets[0]);
        console.log(`   ✅ Total staked: $${portfolio.total_staked / 1_000_000}`);
        console.log(`   ✅ Positions: ${portfolio.positions_count}`);
        console.log('\n✅ Full lifecycle test completed!\n');
        return { market: updatedMarket, opinions, portfolio };
    }
    /**
     * Test error handling for invalid inputs
     */
    async testErrorHandling() {
        console.log('🧪 Testing error handling...\n');
        // Test 1: Invalid market ID
        console.log('1️⃣  Testing invalid market ID...');
        const invalidMarketRes = await this.client.get('/markets/invalid');
        console.log(`   Status: ${invalidMarketRes.status} (expect 400 or 404)`);
        // Test 2: Statement too long
        console.log('\n2️⃣  Testing statement too long...');
        const longStatement = 'a'.repeat(281);
        const longStmtRes = await this.client.post('/markets', {
            statement: longStatement,
            duration: 86400,
            creator: this.randomWallet(),
        });
        console.log(`   Status: ${longStmtRes.status} (expect 400)`);
        console.log(`   Error: ${longStmtRes.data?.error}`);
        // Test 3: Stake amount too low
        console.log('\n3️⃣  Testing stake amount too low...');
        const market = await this.createMarket('Test market', 86400);
        const lowStakeRes = await this.client.post(`/markets/${market.id}/stake`, {
            staker: this.randomWallet(),
            amount: 100_000, // $0.10 (below $0.50 minimum)
            opinion_text: 'test',
        });
        console.log(`   Status: ${lowStakeRes.status} (expect 400)`);
        console.log(`   Error: ${lowStakeRes.data?.error}`);
        // Test 4: Invalid wallet address
        console.log('\n4️⃣  Testing invalid wallet address...');
        const invalidWalletRes = await this.client.get('/user/invalid');
        console.log(`   Status: ${invalidWalletRes.status} (expect 400)`);
        // Test 5: Duplicate opinion on same market
        console.log('\n5️⃣  Testing duplicate opinion prevention...');
        const wallet = this.randomWallet();
        const opinion1 = await this.stakeOpinion(market.id, 5_000_000, 'opinion1', wallet);
        console.log(`   ✅ First opinion staked`);
        const opinion2Res = await this.client.post(`/markets/${market.id}/stake`, {
            staker: wallet,
            amount: 3_000_000,
            opinion_text: 'opinion2',
        });
        console.log(`   Status: ${opinion2Res.status} (expect 400 - already staked)`);
        console.log(`   Error: ${opinion2Res.data?.error}`);
        console.log('\n✅ Error handling tests completed!\n');
    }
    /**
     * Test pagination
     */
    async testPagination() {
        console.log('🧪 Testing pagination...\n');
        // Create multiple markets
        console.log('1️⃣  Creating 25 test markets...');
        const marketIds = [];
        for (let i = 0; i < 25; i++) {
            const market = await this.createMarket(`Market ${i + 1}`, 86400);
            marketIds.push(market.id);
            if ((i + 1) % 5 === 0) {
                console.log(`   ✅ Created ${i + 1} markets`);
            }
        }
        // Test pagination
        console.log('\n2️⃣  Testing pagination...');
        const page1 = await this.getMarkets({ limit: 10, offset: 0 });
        console.log(`   Page 1: ${page1.markets.length} items`);
        console.log(`   Has more: ${page1.pagination.hasMore}`);
        const page2 = await this.getMarkets({ limit: 10, offset: 10 });
        console.log(`   Page 2: ${page2.markets.length} items`);
        console.log(`   Has more: ${page2.pagination.hasMore}`);
        const page3 = await this.getMarkets({ limit: 10, offset: 20 });
        console.log(`   Page 3: ${page3.markets.length} items`);
        console.log(`   Has more: ${page3.pagination.hasMore}`);
        console.log('\n✅ Pagination tests completed!\n');
    }
}
exports.TestUtils = TestUtils;
// ─────────────────────────────────────────────────────────────────────────────
// EXPORT HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Create a new test utilities instance
 */
function createTestUtils(baseUrl) {
    return new TestUtils(baseUrl);
}
/**
 * Format USDC amount for display
 */
function formatUSDC(microUsdc) {
    return `$${(microUsdc / 1_000_000).toFixed(2)}`;
}
/**
 * Convert seconds to human-readable duration
 */
function formatDuration(seconds) {
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400)
        return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}
//# sourceMappingURL=testUtils.js.map