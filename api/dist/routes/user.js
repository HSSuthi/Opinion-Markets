"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../database");
const Position_1 = require("../entities/Position");
const UserPortfolio_1 = require("../entities/UserPortfolio");
const Opinion_1 = require("../entities/Opinion");
const router = (0, express_1.Router)();
const positionRepository = () => database_1.AppDataSource.getRepository(Position_1.Position);
const userPortfolioRepository = () => database_1.AppDataSource.getRepository(UserPortfolio_1.UserPortfolio);
const opinionRepository = () => database_1.AppDataSource.getRepository(Opinion_1.Opinion);
/**
 * GET /user/:wallet
 * Get user portfolio summary
 *
 * Path parameters:
 *   - wallet: User's wallet address
 *
 * Response:
 *   {
 *     wallet_address: string,
 *     total_staked: number (micro-USDC),
 *     total_prize_won: number (micro-USDC),
 *     positions_count: number,
 *     win_count: number,
 *     win_rate: number (0-1),
 *     roi: number (percentage)
 *   }
 */
router.get('/user/:wallet', async (req, res) => {
    try {
        const { wallet } = req.params;
        // Validate wallet address format
        if (!wallet || wallet.length < 40) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address',
            });
        }
        // Try to get cached portfolio
        let portfolio = await userPortfolioRepository().findOne({
            where: { wallet_address: wallet },
        });
        if (!portfolio) {
            // Calculate from positions if portfolio not cached
            const positions = await positionRepository().find({
                where: { wallet_address: wallet },
            });
            if (positions.length === 0) {
                // Return empty portfolio for new user
                return res.json({
                    success: true,
                    data: {
                        wallet_address: wallet,
                        total_staked: 0,
                        total_prize_won: 0,
                        positions_count: 0,
                        win_count: 0,
                        win_rate: 0,
                        roi: 0,
                    },
                });
            }
            // Calculate totals
            const totalStaked = positions.reduce((sum, p) => sum + p.stake_amount, 0);
            const totalPrizeWon = positions.reduce((sum, p) => sum + (p.prize_amount || 0), 0);
            const winCount = positions.filter((p) => p.prize_amount && p.prize_amount > 0).length;
            // Create portfolio cache
            portfolio = userPortfolioRepository().create({
                wallet_address: wallet,
                total_staked: totalStaked,
                total_prize_won: totalPrizeWon,
                positions_count: positions.length,
                win_count: winCount,
            });
            await userPortfolioRepository().save(portfolio);
        }
        res.json({
            success: true,
            data: {
                wallet_address: portfolio.wallet_address,
                total_staked: portfolio.total_staked,
                total_prize_won: portfolio.total_prize_won,
                positions_count: portfolio.positions_count,
                win_count: portfolio.win_count,
                win_rate: portfolio.win_rate,
                roi: portfolio.roi,
            },
        });
    }
    catch (error) {
        console.error('GET /user/:wallet error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user portfolio',
        });
    }
});
/**
 * GET /user/:wallet/positions
 * Get all positions (stakes) for a user
 *
 * Path parameters:
 *   - wallet: User's wallet address
 *
 * Query parameters:
 *   - limit: Results per page (default: 50, max: 100)
 *   - offset: Pagination offset (default: 0)
 *   - settled: true|false - filter by settled status
 */
router.get('/user/:wallet/positions', async (req, res) => {
    try {
        const { wallet } = req.params;
        const { limit = '50', offset = '0', settled } = req.query;
        // Validate wallet
        if (!wallet || wallet.length < 40) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address',
            });
        }
        // Parse pagination
        const pageLimit = Math.min(parseInt(limit) || 50, 100);
        const pageOffset = Math.max(parseInt(offset) || 0, 0);
        // Build query
        let query = positionRepository()
            .createQueryBuilder('position')
            .leftJoinAndSelect('position.market', 'market')
            .where('position.wallet_address = :wallet', { wallet })
            .orderBy('position.created_at', 'DESC');
        // Filter by settled status if provided
        if (settled === 'true') {
            query = query.andWhere('position.settled_at IS NOT NULL');
        }
        else if (settled === 'false') {
            query = query.andWhere('position.settled_at IS NULL');
        }
        // Execute query with pagination
        const [positions, total] = await query
            .skip(pageOffset)
            .take(pageLimit)
            .getManyAndCount();
        res.json({
            success: true,
            data: positions,
            pagination: {
                limit: pageLimit,
                offset: pageOffset,
                total,
                hasMore: pageOffset + pageLimit < total,
            },
        });
    }
    catch (error) {
        console.error('GET /user/:wallet/positions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user positions',
        });
    }
});
/**
 * GET /user/:wallet/opinions
 * Get all opinions submitted by a user
 *
 * Path parameters:
 *   - wallet: User's wallet address
 */
router.get('/user/:wallet/opinions', async (req, res) => {
    try {
        const { wallet } = req.params;
        const { limit = '50', offset = '0' } = req.query;
        // Validate wallet
        if (!wallet || wallet.length < 40) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address',
            });
        }
        // Parse pagination
        const pageLimit = Math.min(parseInt(limit) || 50, 100);
        const pageOffset = Math.max(parseInt(offset) || 0, 0);
        // Fetch opinions
        const [opinions, total] = await opinionRepository()
            .createQueryBuilder('opinion')
            .leftJoinAndSelect('opinion.market', 'market')
            .where('opinion.staker_address = :wallet', { wallet })
            .orderBy('opinion.created_at', 'DESC')
            .skip(pageOffset)
            .take(pageLimit)
            .getManyAndCount();
        res.json({
            success: true,
            data: opinions,
            pagination: {
                limit: pageLimit,
                offset: pageOffset,
                total,
                hasMore: pageOffset + pageLimit < total,
            },
        });
    }
    catch (error) {
        console.error('GET /user/:wallet/opinions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user opinions',
        });
    }
});
exports.default = router;
//# sourceMappingURL=user.js.map