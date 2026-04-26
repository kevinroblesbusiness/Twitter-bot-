import { Router, Request, Response } from 'express';
import { queryOne, execute } from '../services/database.js';

export function setupCreatorRoutes(): Router {
  const router = Router();

  // Get creator profile
  router.get('/me', async (req: Request, res: Response) => {
    try {
      const creatorId = req.query.creator_id as string;

      if (!creatorId) {
        return res.status(400).json({ error: 'creator_id required' });
      }

      const creator = await queryOne(
        `SELECT id, name, email, fanvue_id, settings, ai_profile, created_at FROM creators WHERE id = $1`,
        [creatorId]
      );

      if (!creator) {
        return res.status(404).json({ error: 'Creator not found' });
      }

      res.json(creator);
    } catch (error) {
      console.error('Error getting creator profile:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  // Update creator settings
  router.put('/settings', async (req: Request, res: Response) => {
    try {
      const creatorId = req.query.creator_id as string;
      const { message_tone, auto_approve_threshold } = req.body;

      if (!creatorId) {
        return res.status(400).json({ error: 'creator_id required' });
      }

      await execute(
        `UPDATE creators
         SET settings = jsonb_set(
          COALESCE(settings, '{}'::jsonb),
          '{message_tone}',
          to_jsonb($1::text)
         ),
         settings = jsonb_set(
          settings,
          '{auto_approve_threshold}',
          to_jsonb($2::float)
         )
         WHERE id = $3`,
        [message_tone || 'friendly', auto_approve_threshold || 0.8, creatorId]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  return router;
}
