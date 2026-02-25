import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database';
import { Market, MarketState } from '../entities/Market';
import { Opinion } from '../entities/Opinion';
import { OpinionReaction } from '../entities/OpinionReaction';
import { Position } from '../entities/Position';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

const router = Router();
const marketRepository = () => AppDataSource.getRepository(Market);
const opinionRepository = () => AppDataSource.getRepository(Opinion);
const reactionRepository = () => AppDataSource.getRepository(OpinionReaction);
const positionRepository = () => AppDataSource.getRepository(Position);

/**
 * GET /markets
 * List all markets with filtering and pagination
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

    const pageLimit = Math.min(parseInt(limit as string) || 20, 100);
    const pageOffset = Math.max(parseInt(offset as string) || 0, 0);
    const validSortFields = ['createdAt', 'closesAt', 'totalStake'];
    const sortField = validSortFields.includes(sortBy as string)
      ? (sortBy as string)
      : 'closesAt';
    const validOrder = sortOrder === 'desc' ? 'desc' : 'asc';

    let query = marketRepository()
      .createQueryBuilder('market')
      .loadRelationIds({ relations: ['opinions'] });

    if (state && Object.values(MarketState).includes(state as MarketState)) {
      query = query.where('market.state = :state', { state });
    }

    const orderField = `market.${sortField}`;
    query = query.orderBy(orderField, validOrder === 'desc' ? 'DESC' : 'ASC');
    query = query.skip(pageOffset).take(pageLimit);

    const [markets, total] = await query.getManyAndCount();

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
    res.status(500).json({ success: false, error: 'Failed to fetch markets' });
  }
});

/**
 * GET /markets/:id
 * Get market details with opinions and their reactions
 */
router.get('/markets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || id.length < 10) {
      return res.status(400).json({ success: false, error: 'Invalid market ID' });
    }

    const market = await marketRepository()
      .createQueryBuilder('market')
      .leftJoinAndSelect('market.opinions', 'opinions')
      .leftJoinAndSelect('opinions.reactions', 'reactions')
      .where('market.id = :id', { id })
      .orderBy('opinions.backing_total', 'DESC')
      .addOrderBy('opinions.created_at', 'DESC')
      .getOne();

    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    res.json({ success: true, data: market });
  } catch (error) {
    console.error('GET /markets/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch market' });
  }
});

/**
 * POST /markets
 * Create a new market.
 *
 * Body: { statement, duration, creator, signature, max_stake? }
 *   max_stake: optional micro-USDC cap per opinion/reaction.
 *              Default $10 (10_000_000). Range: $1–$500.
 */
router.post('/markets', async (req: Request, res: Response) => {
  try {
    const { statement, duration, creator, signature, max_stake } = req.body;

    if (!statement || typeof statement !== 'string') {
      return res.status(400).json({ success: false, error: 'statement is required' });
    }
    if (!creator || typeof creator !== 'string') {
      return res.status(400).json({ success: false, error: 'creator is required' });
    }
    if (!duration || typeof duration !== 'number' || duration <= 0) {
      return res.status(400).json({ success: false, error: 'duration must be a positive number' });
    }
    if (statement.length > 280) {
      return res.status(400).json({ success: false, error: 'Statement must be 280 characters or less' });
    }

    // Validate optional stake cap (micro-USDC)
    const MIN_CAP = 1_000_000;    // $1.00
    const MAX_CAP = 500_000_000;  // $500.00
    const DEFAULT_CAP = 10_000_000; // $10.00
    let resolvedMaxStake = DEFAULT_CAP;
    if (max_stake !== undefined) {
      if (typeof max_stake !== 'number' || !Number.isInteger(max_stake)) {
        return res.status(400).json({ success: false, error: 'max_stake must be an integer (micro-USDC)' });
      }
      if (max_stake < MIN_CAP || max_stake > MAX_CAP) {
        return res.status(400).json({
          success: false,
          error: `max_stake must be between $1.00 (1_000_000) and $500.00 (500_000_000)`,
        });
      }
      resolvedMaxStake = max_stake;
    }

    const market = new Market();
    market.id = `market_${uuidv4()}`;
    market.uuid = uuidv4();
    market.statement = statement;
    market.creator_address = creator;
    market.created_at = new Date();
    market.closes_at = new Date(Date.now() + duration * 1000);
    market.state = MarketState.ACTIVE;
    market.total_stake = 0;
    market.staker_count = 0;
    market.max_stake = resolvedMaxStake;

    const savedMarket = await marketRepository().save(market);

    res.status(201).json({ success: true, data: savedMarket });
  } catch (error) {
    console.error('POST /markets error:', error);
    res.status(500).json({ success: false, error: 'Failed to create market' });
  }
});

/**
 * POST /markets/:id/stake
 * Submit an opinion stake — now includes an agreement prediction (0–100)
 * for the crowd consensus layer.
 *
 * Body: { staker, amount, opinion_text, prediction, signature }
 */
router.post('/markets/:id/stake', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { staker, amount, opinion_text, prediction, signature } = req.body;

    // Validate required fields
    if (!staker || typeof staker !== 'string') {
      return res.status(400).json({ success: false, error: 'staker is required' });
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be a positive number' });
    }

    const MIN_STAKE = 500_000; // $0.50 — global floor, never lower

    const market = await marketRepository().findOne({ where: { id } });
    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }
    if (market.state !== MarketState.ACTIVE) {
      return res.status(400).json({
        success: false,
        error: `Market is not active (current state: ${market.state})`,
      });
    }

    const marketMaxStake = Number(market.max_stake);
    if (amount < MIN_STAKE || amount > marketMaxStake) {
      return res.status(400).json({
        success: false,
        error: `Stake amount must be between $0.50 and $${(marketMaxStake / 1_000_000).toFixed(2)} (received: $${(amount / 1_000_000).toFixed(2)})`,
      });
    }

    if (opinion_text && typeof opinion_text === 'string') {
      if (opinion_text.length < 1 || opinion_text.length > 280) {
        return res.status(400).json({ success: false, error: 'Opinion text must be 1–280 characters' });
      }
    }

    // Validate prediction (Layer 2: crowd consensus)
    if (prediction !== undefined) {
      if (
        typeof prediction !== 'number' ||
        !Number.isInteger(prediction) ||
        prediction < 0 ||
        prediction > 100
      ) {
        return res.status(400).json({
          success: false,
          error: 'prediction must be an integer between 0 and 100',
        });
      }
    }

    const existingOpinion = await opinionRepository().findOne({
      where: { market_id: id, staker_address: staker },
    });
    if (existingOpinion) {
      return res.status(400).json({ success: false, error: 'User has already staked on this market' });
    }

    const textHash = crypto
      .createHash('sha256')
      .update(opinion_text || '')
      .digest();

    const opinion = new Opinion();
    opinion.id = uuidv4();
    opinion.market_id = id;
    opinion.staker_address = staker;
    opinion.amount = amount;
    opinion.opinion_text = opinion_text || null;
    opinion.text_hash = textHash;
    opinion.created_at = new Date();
    opinion.prediction = prediction !== undefined ? prediction : null;
    // Author's own stake counts as initial backing for Layer 1
    opinion.backing_total = amount;
    opinion.slashing_total = 0;

    const savedOpinion = await opinionRepository().save(opinion);

    market.total_stake = Number(market.total_stake) + amount;
    market.staker_count = Number(market.staker_count) + 1;
    await marketRepository().save(market);

    res.status(201).json({ success: true, data: savedOpinion });
  } catch (error) {
    console.error('POST /markets/:id/stake error:', error);
    res.status(500).json({ success: false, error: 'Failed to record stake' });
  }
});

/**
 * POST /markets/:id/opinions/:opinionId/react
 * Layer 1: Back (agree) or Slash (disagree) another user's opinion.
 * Reactor's stake goes into the prize pool and affects opinion's weight score.
 *
 * Body: { reactor, reaction_type: 'back'|'slash', amount, signature }
 */
router.post('/markets/:id/opinions/:opinionId/react', async (req: Request, res: Response) => {
  try {
    const { id: marketId, opinionId } = req.params;
    const { reactor, reaction_type, amount, signature } = req.body;

    if (!reactor || typeof reactor !== 'string') {
      return res.status(400).json({ success: false, error: 'reactor is required' });
    }
    if (!['back', 'slash'].includes(reaction_type)) {
      return res.status(400).json({ success: false, error: "reaction_type must be 'back' or 'slash'" });
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be a positive number' });
    }

    const MIN_STAKE = 500_000; // $0.50 — global floor

    const market = await marketRepository().findOne({ where: { id: marketId } });
    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }
    if (market.state !== MarketState.ACTIVE) {
      return res.status(400).json({ success: false, error: 'Market is not open for reactions' });
    }

    const marketMaxStake = Number(market.max_stake);
    if (amount < MIN_STAKE || amount > marketMaxStake) {
      return res.status(400).json({
        success: false,
        error: `Reaction stake must be between $0.50 and $${(marketMaxStake / 1_000_000).toFixed(2)}`,
      });
    }

    const opinion = await opinionRepository().findOne({ where: { id: opinionId, market_id: marketId } });
    if (!opinion) {
      return res.status(404).json({ success: false, error: 'Opinion not found' });
    }

    // Cannot react to own opinion
    if (opinion.staker_address === reactor) {
      return res.status(400).json({ success: false, error: 'Cannot react to your own opinion' });
    }

    // One reaction per (reactor, opinion)
    const existingReaction = await reactionRepository().findOne({
      where: { opinion_id: opinionId, reactor_address: reactor },
    });
    if (existingReaction) {
      return res.status(409).json({ success: false, error: 'You have already reacted to this opinion' });
    }

    // Create reaction record
    const reaction = new OpinionReaction();
    reaction.id = uuidv4();
    reaction.opinion_id = opinionId;
    reaction.market_id = marketId;
    reaction.reactor_address = reactor;
    reaction.reaction_type = reaction_type;
    reaction.amount = amount;

    await reactionRepository().save(reaction);

    // Update opinion backing/slashing totals
    if (reaction_type === 'back') {
      opinion.backing_total = Number(opinion.backing_total) + amount;
    } else {
      opinion.slashing_total = Number(opinion.slashing_total) + amount;
    }
    await opinionRepository().save(opinion);

    // Add reactor's stake to market pool
    market.total_stake = Number(market.total_stake) + amount;
    await marketRepository().save(market);

    res.status(201).json({ success: true, data: reaction });
  } catch (error) {
    console.error('POST /markets/:id/opinions/:opinionId/react error:', error);
    res.status(500).json({ success: false, error: 'Failed to record reaction' });
  }
});

/**
 * GET /markets/:id/scores
 * Returns Triple-Check scores for all opinions in a settled market.
 * Shows W/C/A breakdown and each staker's payout share.
 */
router.get('/markets/:id/scores', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const market = await marketRepository()
      .createQueryBuilder('market')
      .leftJoinAndSelect('market.opinions', 'opinions')
      .where('market.id = :id', { id })
      .orderBy('opinions.composite_score', 'DESC')
      .getOne();

    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    if (market.state !== MarketState.SETTLED) {
      return res.status(400).json({
        success: false,
        error: `Scores are only available for settled markets (current state: ${market.state})`,
      });
    }

    const opinions = (market as any).opinions || [];
    const totalComposite = opinions.reduce(
      (sum: number, op: any) => sum + (Number(op.composite_score) || 0),
      0
    );

    const scoredOpinions = opinions.map((op: any) => ({
      id: op.id,
      staker_address: op.staker_address,
      opinion_text: op.opinion_text,
      amount: op.amount,
      prediction: op.prediction,
      backing_total: op.backing_total,
      slashing_total: op.slashing_total,
      weight_score: op.weight_score,
      consensus_score: op.consensus_score,
      ai_score: op.ai_score,
      composite_score: op.composite_score,
      payout_amount: op.payout_amount,
      share_percent:
        totalComposite > 0
          ? ((Number(op.composite_score) || 0) / totalComposite) * 100
          : 0,
    }));

    res.json({
      success: true,
      data: {
        market_id: market.id,
        statement: market.statement,
        state: market.state,
        crowd_score: market.crowd_score,
        sentiment_score: market.sentiment_score,
        total_stake: market.total_stake,
        opinions: scoredOpinions,
      },
    });
  } catch (error) {
    console.error('GET /markets/:id/scores error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scores' });
  }
});

/**
 * POST /internal/markets/:id/live-sentiment
 * Internal endpoint called by the oracle to persist a live sentiment score
 * for an active market.  Not rate-limited by the public API layer.
 *
 * Body: { live_sentiment_score: number, live_sentiment_confidence: number }
 */
router.post('/internal/markets/:id/live-sentiment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { live_sentiment_score, live_sentiment_confidence } = req.body;

    if (
      typeof live_sentiment_score !== 'number' ||
      live_sentiment_score < 0 ||
      live_sentiment_score > 100
    ) {
      return res.status(400).json({ success: false, error: 'live_sentiment_score must be 0–100' });
    }

    const market = await marketRepository().findOne({ where: { id } });
    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    market.live_sentiment_score = Math.round(live_sentiment_score);
    market.live_sentiment_confidence =
      typeof live_sentiment_confidence === 'number' ? live_sentiment_confidence : null;
    market.live_scored_at = new Date();

    await marketRepository().save(market);

    res.json({ success: true, data: { live_sentiment_score: market.live_sentiment_score } });
  } catch (error) {
    console.error('POST /internal/markets/:id/live-sentiment error:', error);
    res.status(500).json({ success: false, error: 'Failed to update live sentiment' });
  }
});

/**
 * POST /internal/markets/:id/settle
 * Internal endpoint called by the oracle to persist final settlement scores.
 *
 * Body: { crowd_score, state, opinions: [{ id, weight_score, consensus_score,
 *          ai_score, composite_score, payout_amount }] }
 */
router.post('/internal/markets/:id/settle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { crowd_score, state, opinions } = req.body;

    const market = await marketRepository().findOne({ where: { id } });
    if (!market) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    if (crowd_score !== undefined) market.crowd_score = crowd_score;
    if (state) market.state = state as MarketState;
    await marketRepository().save(market);

    if (Array.isArray(opinions)) {
      for (const op of opinions) {
        const opinion = await opinionRepository().findOne({ where: { id: op.id } });
        if (!opinion) continue;
        opinion.weight_score = op.weight_score ?? opinion.weight_score;
        opinion.consensus_score = op.consensus_score ?? opinion.consensus_score;
        opinion.ai_score = op.ai_score ?? opinion.ai_score;
        opinion.composite_score = op.composite_score ?? opinion.composite_score;
        opinion.payout_amount = op.payout_amount ?? opinion.payout_amount;
        await opinionRepository().save(opinion);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('POST /internal/markets/:id/settle error:', error);
    res.status(500).json({ success: false, error: 'Failed to settle market' });
  }
});

export default router;
