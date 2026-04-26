import { Router, Request, Response } from 'express';
import { queryMany, queryOne } from '../services/database.js';

export function setupFanRoutes(): Router {
  const router = Router();

  // List all fans
  router.get('/', async (req: Request, res: Response) => {
    try {
      const creatorId = req.query.creator_id as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      if (!creatorId) {
        return res.status(400).json({ error: 'creator_id required' });
      }

      const fans = await queryMany(
        `SELECT id, display_name, subscription_tier, lifetime_value, engagement_score,
                churn_risk, preference_tags, total_lifetime, average_ppv_price
         FROM fan_profiles
         WHERE creator_id = $1
         ORDER BY lifetime_value DESC
         LIMIT $2 OFFSET $3`,
        [creatorId, limit, offset]
      );

      const totalResult = await queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM fan_profiles WHERE creator_id = $1`,
        [creatorId]
      );

      res.json({
        data: fans,
        total: totalResult?.count || 0,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Error listing fans:', error);
      res.status(500).json({ error: 'Failed to list fans' });
    }
  });

  // Get fan details
  router.get('/:fanId', async (req: Request, res: Response) => {
    try {
      const fanId = req.params.fanId;

      const fan = await queryOne(
        `SELECT * FROM fan_profiles WHERE id = $1`,
        [fanId]
      );

      if (!fan) {
        return res.status(404).json({ error: 'Fan not found' });
      }

      res.json(fan);
    } catch (error) {
      console.error('Error getting fan details:', error);
      res.status(500).json({ error: 'Failed to get fan details' });
    }
  });

  return router;
}
