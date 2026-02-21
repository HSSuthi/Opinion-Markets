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
const express_1 = require("express");
const database_1 = require("../database");
const Market_1 = require("../entities/Market");
const Opinion_1 = require("../entities/Opinion");
const Position_1 = require("../entities/Position");
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
const router = (0, express_1.Router)();
const marketRepository = () => database_1.AppDataSource.getRepository(Market_1.Market);
const opinionRepository = () => database_1.AppDataSource.getRepository(Opinion_1.Opinion);
const positionRepository = () => database_1.AppDataSource.getRepository(Position_1.Position);
/**
 * GET /markets
 * List all markets with filtering and pagination
 *
 * Query parameters:
 *   - state: Filter by state (Active, Closed, Scored, AwaitingRandomness, Settled)
 *   - limit: Results per page (default: 20, max: 100)
 *   - offset: Pagination offset (default: 0)
 *   - sortBy: createdAt | closesAt | totalStake (default: closesAt)
 *   - sortOrder: asc | desc (default: asc for closesAt, desc for others)
 */
router.get('/markets', async (req, res) => {
    try {
        const { state, limit = '20', offset = '0', sortBy = 'closesAt', sortOrder = 'asc', } = req.query;
        // Validate and sanitize inputs
        const pageLimit = Math.min(parseInt(limit) || 20, 100);
        const pageOffset = Math.max(parseInt(offset) || 0, 0);
        const validSortFields = ['createdAt', 'closesAt', 'totalStake'];
        const sortField = validSortFields.includes(sortBy)
            ? sortBy
            : 'closesAt';
        const validOrder = sortOrder === 'desc' ? 'desc' : 'asc';
        // Build query
        let query = marketRepository()
            .createQueryBuilder('market')
            .loadRelationIds({ relations: ['opinions'] });
        // Filter by state if provided
        if (state && Object.values(Market_1.MarketState).includes(state)) {
            query = query.where('market.state = :state', { state });
        }
        // Apply sorting with defaults
        const orderField = `market.${sortField}`;
        if (sortField === 'closesAt') {
            query = query.orderBy(orderField, sortOrder === 'desc' ? 'DESC' : 'ASC');
        }
        else {
            query = query.orderBy(orderField, sortOrder === 'desc' ? 'DESC' : 'ASC');
        }
        // Pagination
        query = query.skip(pageOffset).take(pageLimit);
        // Execute query
        const [markets, total] = await query.getManyAndCount();
        // Return paginated response
        res.json({
            success: true,
            data: markets,
            pagination: {
                limit: pageLimit,
                offset: pageOffset,
                total,
                hasMore: pageOffset + pageLimit < total,
            },
        });
    }
    catch (error) {
        console.error('GET /markets error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch markets',
        });
    }
});
/**
 * GET /markets/:id
 * Get market details with opinions
 *
 * Path parameters:
 *   - id: Market ID (Solana PDA address)
 *
 * Response includes all opinions ranked by stake amount
 */
router.get('/markets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Validate market ID format (Solana address is 43-44 chars base58)
        if (!id || id.length < 40) {
            return res.status(400).json({
                success: false,
                error: 'Invalid market ID format',
            });
        }
        // Fetch market with relations
        const market = await marketRepository()
            .createQueryBuilder('market')
            .leftJoinAndSelect('market.opinions', 'opinions')
            .where('market.id = :id', { id })
            .orderBy('opinions.amount', 'DESC') // Opinions ranked by stake
            .addOrderBy('opinions.created_at', 'DESC')
            .getOne();
        if (!market) {
            return res.status(404).json({
                success: false,
                error: 'Market not found',
            });
        }
        res.json({
            success: true,
            data: market,
        });
    }
    catch (error) {
        console.error('GET /markets/:id error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch market',
        });
    }
});
/**
 * POST /markets
 * Create a new market
 *
 * Request body:
 *   - statement: string (market statement)
 *   - duration: number (seconds until closing)
 *   - creator: string (wallet address)
 *   - signature: string (proof of wallet ownership - TODO: implement verification)
 */
router.post('/markets', async (req, res) => {
    try {
        const { statement, duration, creator, signature } = req.body;
        // Validate required fields
        if (!statement || typeof statement !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'statement is required and must be a string',
            });
        }
        if (!creator || typeof creator !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'creator is required and must be a string',
            });
        }
        if (!duration || typeof duration !== 'number' || duration <= 0) {
            return res.status(400).json({
                success: false,
                error: 'duration is required and must be a positive number',
            });
        }
        // Validate statement length (280 chars max like Twitter)
        if (statement.length > 280) {
            return res.status(400).json({
                success: false,
                error: 'Statement must be 280 characters or less',
            });
        }
        // TODO: Verify signature with wallet address
        // Create market entity
        const market = new Market_1.Market();
        market.id = `market_${(0, uuid_1.v4)()}`; // In production, use Solana PDA
        market.uuid = (0, uuid_1.v4)();
        market.statement = statement;
        market.creator_address = creator;
        market.created_at = new Date();
        market.closes_at = new Date(Date.now() + duration * 1000);
        market.state = Market_1.MarketState.ACTIVE;
        market.total_stake = 0;
        market.staker_count = 0;
        // Save to database
        const savedMarket = await marketRepository().save(market);
        res.status(201).json({
            success: true,
            data: savedMarket,
        });
    }
    catch (error) {
        console.error('POST /markets error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create market',
        });
    }
});
/**
 * POST /markets/:id/stake
 * Submit an opinion stake on a market
 *
 * Path parameters:
 *   - id: Market ID
 *
 * Request body:
 *   - staker: string (wallet address)
 *   - amount: number (USDC in micro-units, $0.50-$10)
 *   - opinion_text: string (1-280 characters)
 *   - signature: string (proof of transaction)
 */
router.post('/markets/:id/stake', async (req, res) => {
    try {
        const { id } = req.params;
        const { staker, amount, opinion_text, signature } = req.body;
        // Validate inputs
        if (!staker || typeof staker !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'staker is required',
            });
        }
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'amount is required and must be a positive number',
            });
        }
        // Validate amount range ($0.50 - $10.00 in micro-USDC)
        const MIN_STAKE = 500_000; // $0.50
        const MAX_STAKE = 10_000_000; // $10.00
        if (amount < MIN_STAKE || amount > MAX_STAKE) {
            return res.status(400).json({
                success: false,
                error: `Stake amount must be between $0.50 and $10.00 (received: $${amount / 1_000_000})`,
            });
        }
        if (opinion_text && typeof opinion_text === 'string') {
            if (opinion_text.length < 1 || opinion_text.length > 280) {
                return res.status(400).json({
                    success: false,
                    error: 'Opinion text must be 1-280 characters',
                });
            }
        }
        // TODO: Verify transaction signature
        // Check market exists and is active
        const market = await marketRepository().findOne({ where: { id } });
        if (!market) {
            return res.status(404).json({
                success: false,
                error: 'Market not found',
            });
        }
        if (market.state !== Market_1.MarketState.ACTIVE) {
            return res.status(400).json({
                success: false,
                error: `Market is not active (current state: ${market.state})`,
            });
        }
        // Check if user already staked on this market (one opinion per user)
        const existingOpinion = await opinionRepository().findOne({
            where: { market_id: id, staker_address: staker },
        });
        if (existingOpinion) {
            return res.status(400).json({
                success: false,
                error: 'User has already staked on this market',
            });
        }
        // Hash the opinion text
        const textHash = crypto
            .createHash('sha256')
            .update(opinion_text || '')
            .digest();
        // Create opinion entity
        const opinion = new Opinion_1.Opinion();
        opinion.id = (0, uuid_1.v4)();
        opinion.market_id = id;
        opinion.staker_address = staker;
        opinion.amount = amount;
        opinion.opinion_text = opinion_text || null;
        opinion.text_hash = textHash;
        opinion.created_at = new Date();
        // Save opinion
        const savedOpinion = await opinionRepository().save(opinion);
        // Update market totals (should use transaction in production)
        market.total_stake += amount;
        market.staker_count += 1;
        await marketRepository().save(market);
        res.status(201).json({
            success: true,
            data: savedOpinion,
        });
    }
    catch (error) {
        console.error('POST /markets/:id/stake error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record stake',
        });
    }
});
exports.default = router;
//# sourceMappingURL=markets.js.map