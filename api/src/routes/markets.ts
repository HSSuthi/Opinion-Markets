import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database';
import { Market, MarketState } from '../entities/Market';
import { Opinion } from '../entities/Opinion';
import { Position } from '../entities/Position';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

const router = Router();
const marketRepository = () => AppDataSource.getRepository(Market);
const opinionRepository = () => AppDataSource.getRepository(Opinion);
const positionRepository = () => AppDataSource.getRepository(Position);

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
router.get('/markets', async (req: Request, res: Response) => {
  try {
    const {
      state,
      limit = '20',
      offset = '0',
      sortBy = 'closesAt',
      sortOrder = 'asc',
    } = req.query;

    // Validate and sanitize inputs
    const pageLimit = Math.min(parseInt(limit as string) || 20, 100);
    const pageOffset = Math.max(parseInt(offset as string) || 0, 0);
    const validSortFields = ['createdAt', 'closesAt', 'totalStake'];
    const sortField = validSortFields.includes(sortBy as string)
      ? (sortBy as string)
      : 'closesAt';
    const validOrder = sortOrder === 'desc' ? 'desc' : 'asc';

    // Build query
    let query = marketRepository()
      .createQueryBuilder('market')
      .loadRelationIds({ relations: ['opinions'] });

    // Filter by state if provided
    if (state && Object.values(MarketState).includes(state as MarketState)) {
      query = query.where('market.state = :state', { state });
    }

    // Apply sorting with defaults
    const orderField = `market.${sortField}`;
    if (sortField === 'closesAt') {
      query = query.orderBy(orderField, sortOrder === 'desc' ? 'DESC' : 'ASC');
    } else {
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
  } catch (error) {
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
router.get('/markets/:id', async (req: Request, res: Response) => {
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
  } catch (error) {
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
router.post('/markets', async (req: Request, res: Response) => {
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
    const market = new Market();
    market.id = `market_${uuidv4()}`; // In production, use Solana PDA
    market.uuid = uuidv4();
    market.statement = statement;
    market.creator_address = creator;
    market.created_at = new Date();
    market.closes_at = new Date(Date.now() + duration * 1000);
    market.state = MarketState.ACTIVE;
    market.total_stake = 0;
    market.staker_count = 0;

    // Save to database
    const savedMarket = await marketRepository().save(market);

    res.status(201).json({
      success: true,
      data: savedMarket,
    });
  } catch (error) {
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
router.post('/markets/:id/stake', async (req: Request, res: Response) => {
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

    if (market.state !== MarketState.ACTIVE) {
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
    const opinion = new Opinion();
    opinion.id = uuidv4();
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
  } catch (error) {
    console.error('POST /markets/:id/stake error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record stake',
    });
  }
});

export default router;
