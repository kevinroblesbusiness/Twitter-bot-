import { Router, Request, Response } from 'express';
import { queryMany, queryOne, execute } from '../services/database.js';
import { createFanvueAPI } from '../services/fanvue-api.js';

const fanvueApi = createFanvueAPI();

export function setupMessageRoutes(): Router {
  const router = Router();

  // Get pending messages (approval queue)
  router.get('/pending', async (req: Request, res: Response) => {
    try {
      const creatorId = req.query.creator_id as string;

      if (!creatorId) {
        return res.status(400).json({ error: 'creator_id required' });
      }

      const messages = await queryMany(
        `SELECT m.id, m.fan_id, f.display_name, m.draft, m.created_at,
                c.filename, c.price
         FROM messages m
         JOIN fan_profiles f ON m.fan_id = f.id
         LEFT JOIN content_vault c ON (m.draft->>'recommended_content_id')::uuid = c.content_id
         WHERE m.creator_id = $1 AND m.status = 'pending'
         ORDER BY m.created_at DESC`,
        [creatorId]
      );

      res.json(messages);
    } catch (error) {
      console.error('Error getting pending messages:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  });

  // Approve and send message
  router.post('/:messageId/approve', async (req: Request, res: Response) => {
    try {
      const messageId = req.params.messageId;
      const creatorId = req.query.creator_id as string;

      if (!creatorId) {
        return res.status(400).json({ error: 'creator_id required' });
      }

      // Get message
      const message = await queryOne<any>(
        `SELECT * FROM messages WHERE id = $1 AND creator_id = $2`,
        [messageId, creatorId]
      );

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const messageText = message.draft.generated_text;

      // Get creator for Fanvue API
      const creator = await queryOne<any>(
        `SELECT oauth_access_token, oauth_refresh_token, oauth_expires_at FROM creators WHERE id = $1`,
        [creatorId]
      );

      if (!creator) {
        return res.status(404).json({ error: 'Creator not found' });
      }

      // Get fan's chat ID
      const fan = await queryOne<any>(
        `SELECT fanvue_chat_id FROM fan_profiles WHERE id = $1`,
        [message.fan_id]
      );

      if (!fan || !fan.fanvue_chat_id) {
        return res.status(400).json({ error: 'Fan chat ID not found' });
      }

      // Set tokens
      fanvueApi.setTokens(
        creator.oauth_access_token,
        creator.oauth_refresh_token,
        creator.oauth_expires_at ? new Date(creator.oauth_expires_at).getTime() : Date.now()
      );

      // Send via Fanvue
      try {
        await fanvueApi.sendMessage(fan.fanvue_chat_id, messageText);

        // Update message status
        await execute(
          `UPDATE messages SET status = 'sent', final_text = $1, sent_at = NOW() WHERE id = $2`,
          [messageText, messageId]
        );

        res.json({ success: true, status: 'sent' });
      } catch (error) {
        console.error('Failed to send via Fanvue:', error);
        res.status(500).json({ error: 'Failed to send message' });
      }
    } catch (error) {
      console.error('Error approving message:', error);
      res.status(500).json({ error: 'Failed to approve message' });
    }
  });

  // Reject message
  router.post('/:messageId/reject', async (req: Request, res: Response) => {
    try {
      const messageId = req.params.messageId;
      const creatorId = req.query.creator_id as string;

      if (!creatorId) {
        return res.status(400).json({ error: 'creator_id required' });
      }

      await execute(
        `UPDATE messages SET status = 'rejected' WHERE id = $1 AND creator_id = $2`,
        [messageId, creatorId]
      );

      res.json({ success: true, status: 'rejected' });
    } catch (error) {
      console.error('Error rejecting message:', error);
      res.status(500).json({ error: 'Failed to reject message' });
    }
  });

  return router;
}
