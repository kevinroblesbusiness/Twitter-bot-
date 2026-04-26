import { Router, Request, Response } from 'express';
import { createFanvueAPI } from '../services/fanvue-api.js';
import { getPool, queryOne, queryMany, execute } from '../services/database.js';
import { searchContentByTags, rankContentForFan, predictConversionProbability } from '../services/recommendation-engine.js';
import { getRedis } from '../services/redis.js';
import { v4 as uuidv4 } from 'uuid';

export function setupWebhookHandler(): Router {
  const router = Router();
  const fanvueApi = createFanvueAPI();

  // Parse raw body for signature verification
  router.use('/fanvue', (req: Request, res: Response, next) => {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk.toString();
    });
    req.on('end', () => {
      req.rawBody = rawBody;
      next();
    });
  });

  // Main webhook endpoint
  router.post('/fanvue', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-fanvue-signature'] as string;
      const rawBody = req.rawBody as string;

      // Verify signature
      let payload;
      try {
        payload = fanvueApi.parseWebhookPayload(rawBody, signature);
      } catch (error) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const eventType = payload.event_type;
      console.log(`📬 Webhook received: ${eventType}`);

      // Route to handler
      switch (eventType) {
        case 'message.received':
          await handleMessageReceived(payload);
          break;
        case 'subscriber.created':
          await handleNewSubscriber(payload);
          break;
        case 'tip.received':
          await handleTipReceived(payload);
          break;
        case 'purchase.completed':
          await handlePurchaseCompleted(payload);
          break;
        default:
          console.log(`Unknown event type: ${eventType}`);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: 'Processing failed' });
    }
  });

  return router;
}

async function handleMessageReceived(payload: any) {
  const { data } = payload;
  const creatorFanvueId = data.creator.id;
  const fanFanvueId = data.subscriber.id;
  const messageText = data.message;
  const chatId = data.chat_id;

  try {
    // Get creator
    const creator = await queryOne<any>(
      `SELECT id, fanvue_id, name, oauth_access_token, oauth_refresh_token, settings
       FROM creators
       WHERE fanvue_id = $1`,
      [creatorFanvueId]
    );

    if (!creator) {
      console.log(`Creator not found: ${creatorFanvueId}`);
      return;
    }

    // Get or create fan
    let fan = await queryOne<any>(
      `SELECT id FROM fan_profiles
       WHERE creator_id = $1 AND fanvue_fan_id = $2`,
      [creator.id, fanFanvueId]
    );

    if (!fan) {
      const fanId = uuidv4();
      await execute(
        `INSERT INTO fan_profiles (
          id, creator_id, fanvue_fan_id, display_name, subscription_tier, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [fanId, creator.id, fanFanvueId, data.subscriber.display_name, 'free']
      );
      fan = { id: fanId };
    }

    // Update last interaction
    await execute(
      `UPDATE fan_profiles SET last_interaction_at = NOW() WHERE id = $1`,
      [fan.id]
    );

    // Queue message for processing
    const redis = getRedis();
    await redis.rPush(
      'message_queue',
      JSON.stringify({
        creator_id: creator.id,
        fan_id: fan.id,
        fanvue_chat_id: chatId,
        message_text: messageText,
        timestamp: new Date().toISOString(),
      })
    );

    console.log(`✅ Message queued for fan: ${fan.id}`);
  } catch (error) {
    console.error('Error handling message received:', error);
  }
}

async function handleNewSubscriber(payload: any) {
  const { data } = payload;
  const creatorFanvueId = data.creator.id;
  const fanFanvueId = data.subscriber.id;

  try {
    const creator = await queryOne<any>(
      `SELECT id FROM creators WHERE fanvue_id = $1`,
      [creatorFanvueId]
    );

    if (!creator) return;

    // Create fan profile
    const fanId = uuidv4();
    await execute(
      `INSERT INTO fan_profiles (
        id, creator_id, fanvue_fan_id, display_name, subscription_tier, subscription_started_at, is_active_subscriber, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), true, NOW())`,
      [fanId, creator.id, fanFanvueId, data.subscriber.display_name, data.tier]
    );

    // Queue welcome message
    const redis = getRedis();
    await redis.rPush(
      'message_queue',
      JSON.stringify({
        creator_id: creator.id,
        fan_id: fanId,
        message_type: 'welcome',
        timestamp: new Date().toISOString(),
      })
    );

    console.log(`✅ New subscriber welcome message queued`);
  } catch (error) {
    console.error('Error handling new subscriber:', error);
  }
}

async function handleTipReceived(payload: any) {
  const { data } = payload;
  const creatorFanvueId = data.creator.id;
  const fanFanvueId = data.subscriber.id;
  const amount = data.amount;

  try {
    const creator = await queryOne<any>(`SELECT id FROM creators WHERE fanvue_id = $1`, [
      creatorFanvueId,
    ]);

    if (!creator) return;

    const fan = await queryOne<any>(
      `SELECT id FROM fan_profiles WHERE creator_id = $1 AND fanvue_fan_id = $2`,
      [creator.id, fanFanvueId]
    );

    if (!fan) return;

    // Update fan metrics
    await execute(
      `UPDATE fan_profiles
       SET total_tips = COALESCE(total_tips, 0) + $1,
           lifetime_value = COALESCE(lifetime_value, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [amount, fan.id]
    );

    console.log(`✅ Tip recorded: $${amount} from fan`);
  } catch (error) {
    console.error('Error handling tip received:', error);
  }
}

async function handlePurchaseCompleted(payload: any) {
  const { data } = payload;
  const creatorFanvueId = data.creator.id;
  const fanFanvueId = data.subscriber.id;
  const amount = data.amount;

  try {
    const creator = await queryOne<any>(`SELECT id FROM creators WHERE fanvue_id = $1`, [
      creatorFanvueId,
    ]);

    if (!creator) return;

    const fan = await queryOne<any>(
      `SELECT id FROM fan_profiles WHERE creator_id = $1 AND fanvue_fan_id = $2`,
      [creator.id, fanFanvueId]
    );

    if (!fan) return;

    // Update fan metrics
    await execute(
      `UPDATE fan_profiles
       SET total_purchases = COALESCE(total_purchases, 0) + $1,
           lifetime_value = COALESCE(lifetime_value, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [amount, fan.id]
    );

    console.log(`✅ Purchase recorded: $${amount} from fan`);
  } catch (error) {
    console.error('Error handling purchase completed:', error);
  }
}
