import { Router, Request, Response } from 'express';
import { createFanvueAPI } from '../services/fanvue-api.js';
import { execute, queryOne } from '../services/database.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export function setupAuthRoutes(): Router {
  const router = Router();
  const fanvueApi = createFanvueAPI();

  // Start OAuth flow
  router.get('/login', (req: Request, res: Response) => {
    const state = crypto.randomBytes(32).toString('hex');
    const authUrl = fanvueApi.getAuthorizationUrl(state);

    // Store state in simple session (in production, use Redis)
    res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000 });
    res.redirect(authUrl);
  });

  // OAuth callback
  router.get('/callback', async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      const storedState = req.cookies?.oauth_state;

      if (!code || state !== storedState) {
        return res.status(400).json({ error: 'Invalid OAuth state' });
      }

      // Exchange code for token
      const tokenData = await fanvueApi.exchangeCodeForToken(code);

      // Get creator info from Fanvue
      const fanvueCreatorInfo = await fanvueApi.getUnreadMessages(1);
      const creatorFanvueId = (fanvueCreatorInfo as any)[0]?.creator?.id || 'unknown';

      // Check if creator exists
      let creator = await queryOne(
        `SELECT id FROM creators WHERE fanvue_id = $1`,
        [creatorFanvueId]
      );

      if (!creator) {
        // Create new creator
        const creatorId = uuidv4();
        await execute(
          `INSERT INTO creators (
            id, fanvue_id, name, email, oauth_access_token, oauth_refresh_token, oauth_expires_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            creatorId,
            creatorFanvueId,
            'Creator',
            `creator_${creatorFanvueId}@fanvue.local`,
            tokenData.access_token,
            tokenData.refresh_token,
            new Date(Date.now() + tokenData.expires_in * 1000),
          ]
        );
        creator = { id: creatorId };
      } else {
        // Update tokens
        await execute(
          `UPDATE creators
           SET oauth_access_token = $1, oauth_refresh_token = $2, oauth_expires_at = $3
           WHERE id = $4`,
          [
            tokenData.access_token,
            tokenData.refresh_token,
            new Date(Date.now() + tokenData.expires_in * 1000),
            creator.id,
          ]
        );
      }

      // Redirect to frontend with creator ID
      res.redirect(`${process.env.FRONTEND_URL}?creator_id=${(creator as any).id}`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(400).json({ error: 'Authentication failed' });
    }
  });

  return router;
}
