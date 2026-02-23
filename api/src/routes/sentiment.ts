import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database';
import { Market, MarketState } from '../entities/Market';

const router = Router();
const marketRepository = () => AppDataSource.getRepository(Market);

/**
 * GET /sentiment/history
 * Get all settled markets with their final sentiment scores
 * Used for historical analysis and insights
 *
 * Query parameters:
 *   - limit: Results per page (default: 50, max: 100)
 *   - offset: Pagination offset (default: 0)
 *   - sortBy: created_at | sentiment_score (default: created_at)
 *   - sortOrder: asc | desc (default: desc)
 */
router.get('/sentiment/history', async (req: Request, res: Response) => {
  try {
    const {
      limit = '50',
      offset = '0',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    // Validate and sanitize inputs
    const pageLimit = Math.min(parseInt(limit as string) || 50, 100);
    const pageOffset = Math.max(parseInt(offset as string) || 0, 0);
    const validSortFields = ['created_at', 'sentiment_score'];
    const sortField = validSortFields.includes(sortBy as string)
      ? (sortBy as string)
      : 'created_at';
    const validOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    // Query all settled markets with sentiment scores
    const [markets, total] = await marketRepository()
      .createQueryBuilder('market')
      .where('market.state = :state', { state: MarketState.SETTLED })
      .andWhere('market.sentiment_score IS NOT NULL')
      .orderBy(`market.${sortField}`, validOrder as 'ASC' | 'DESC')
      .skip(pageOffset)
      .take(pageLimit)
      .getManyAndCount();

    res.json({
      success: true,
      data: markets.map((m) => ({
        id: m.id,
        statement: m.statement,
        sentiment_score: m.sentiment_score,
        sentiment_confidence: m.sentiment_confidence,
        total_stake: m.total_stake,
        staker_count: m.staker_count,
        winner: m.winner,
        created_at: m.created_at,
        closes_at: m.closes_at,
      })),
      pagination: {
        limit: pageLimit,
        offset: pageOffset,
        total,
        hasMore: pageOffset + pageLimit < total,
      },
    });
  } catch (error) {
    console.error('GET /sentiment/history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sentiment history',
    });
  }
});

/**
 * GET /sentiment/topic
 * Search settled markets by topic/keyword
 * Searches in the statement field
 *
 * Query parameters:
 *   - q: Search query (required, min 2 chars)
 *   - limit: Results per page (default: 20, max: 100)
 *   - offset: Pagination offset (default: 0)
 */
router.get('/sentiment/topic', async (req: Request, res: Response) => {
  try {
    const { q, limit = '20', offset = '0' } = req.query;

    // Validate search query
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    // Sanitize for LIKE query
    const searchTerm = `%${(q as string).replace(/[%_\\]/g, '\\$&')}%`;

    // Validate pagination
    const pageLimit = Math.min(parseInt(limit as string) || 20, 100);
    const pageOffset = Math.max(parseInt(offset as string) || 0, 0);

    // Search for markets by statement
    const [markets, total] = await marketRepository()
      .createQueryBuilder('market')
      .where('market.state = :state', { state: MarketState.SETTLED })
      .andWhere('market.statement ILIKE :searchTerm', { searchTerm })
      .orderBy('market.created_at', 'DESC')
      .skip(pageOffset)
      .take(pageLimit)
      .getManyAndCount();

    res.json({
      success: true,
      query: q,
      data: markets.map((m) => ({
        id: m.id,
        statement: m.statement,
        sentiment_score: m.sentiment_score,
        sentiment_confidence: m.sentiment_confidence,
        total_stake: m.total_stake,
        staker_count: m.staker_count,
        created_at: m.created_at,
      })),
      pagination: {
        limit: pageLimit,
        offset: pageOffset,
        total,
        hasMore: pageOffset + pageLimit < total,
      },
    });
  } catch (error) {
    console.error('GET /sentiment/topic error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search sentiment data',
    });
  }
});

export default router;
