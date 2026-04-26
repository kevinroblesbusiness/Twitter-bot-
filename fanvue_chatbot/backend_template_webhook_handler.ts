/**
 * Fanvue Webhook Handler
 * Processes incoming webhooks and triggers message generation
 */

import { Request, Response } from 'express';
import { Queue } from 'bull';
import FanvueAPI from './fanvue-api';
import ClaudeAIGenerator from './claude-ai';
import { Database } from './database';

export class WebhookHandler {
  constructor(
    private fanvueApi: FanvueAPI,
    private claudeAI: ClaudeAIGenerator,
    private db: Database,
    private messageQueue: Queue // Bull queue for async processing
  ) {}

  /**
   * Main webhook endpoint handler
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['x-fanvue-signature'] as string;
    const rawBody = req.rawBody as string;

    try {
      // Verify webhook signature
      const payload = this.fanvueApi.parseWebhookPayload(rawBody, signature);

      // Route to appropriate handler
      const eventType = payload.event_type;

      switch (eventType) {
        case 'message.received':
          await this.handleMessageReceived(payload);
          break;
        case 'subscriber.created':
          await this.handleNewSubscriber(payload);
          break;
        case 'tip.received':
          await this.handleTipReceived(payload);
          break;
        case 'purchase.completed':
          await this.handlePurchaseCompleted(payload);
          break;
        default:
          console.log(`Unknown event type: ${eventType}`);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle incoming message from fan
   * Queue AI response generation
   */
  private async handleMessageReceived(payload: any): Promise<void> {
    const { data } = payload;
    const creatorFanvueId = data.creator.id;
    const fanvueUserId = data.subscriber.id;
    const fanveMessage = data.message;
    const messageId = data.message_id;

    try {
      // Get creator from database
      const creator = await this.db.creators.findOne({
        fanvue_id: creatorFanvueId,
      });

      if (!creator) {
        console.log(`Creator not found: ${creatorFanvueId}`);
        return;
      }

      // Get or create fan profile
      let fan = await this.db.fans.findOne({
        creator_id: creator.id,
        fanvue_fan_id: fanvueUserId,
      });

      if (!fan) {
        // Create new fan profile
        fan = await this.db.fans.create({
          creator_id: creator.id,
          fanvue_fan_id: fanvueUserId,
          display_name: data.subscriber.display_name,
          subscription_tier: 'free',
          created_at: new Date(),
        });
      }

      // Update last interaction
      await this.db.fans.update(fan.id, {
        last_message_received_at: new Date(),
      });

      // Check if creator has auto-response enabled
      if (creator.settings.enable_auto_response !== false) {
        // Queue message generation
        await this.messageQueue.add(
          'generate_response',
          {
            creator_id: creator.id,
            fan_id: fan.id,
            fanvue_message_id: messageId,
            original_message: fanveMessage,
            goal: 'engagement',
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          }
        );
      }

      console.log(`Queued response generation for fan: ${fan.display_name}`);
    } catch (error) {
      console.error('Error handling message received:', error);
    }
  }

  /**
   * Handle new subscriber
   * Send welcome message
   */
  private async handleNewSubscriber(payload: any): Promise<void> {
    const { data } = payload;
    const creatorFanvueId = data.creator.id;
    const fanvueUserId = data.subscriber.id;

    try {
      const creator = await this.db.creators.findOne({
        fanvue_id: creatorFanvueId,
      });

      if (!creator) {
        console.log(`Creator not found: ${creatorFanvueId}`);
        return;
      }

      // Create fan profile
      const fan = await this.db.fans.create({
        creator_id: creator.id,
        fanvue_fan_id: fanvueUserId,
        display_name: data.subscriber.display_name,
        subscription_tier: data.tier,
        subscription_started_at: new Date(),
        is_active_subscriber: true,
      });

      // Check if creator has auto-welcome enabled
      if (creator.settings.enable_auto_welcome !== false) {
        // Queue welcome message generation
        await this.messageQueue.add(
          'generate_response',
          {
            creator_id: creator.id,
            fan_id: fan.id,
            message_type: 'welcome',
            goal: 'engagement',
          },
          {
            priority: 1, // High priority for welcome messages
          }
        );
      }

      console.log(`New subscriber: ${fan.display_name}`);
    } catch (error) {
      console.error('Error handling new subscriber:', error);
    }
  }

  /**
   * Handle tip received
   * Generate thank you message and potential upsell
   */
  private async handleTipReceived(payload: any): Promise<void> {
    const { data } = payload;
    const creatorFanvueId = data.creator.id;
    const fanvueUserId = data.subscriber.id;
    const amount = data.amount;

    try {
      const creator = await this.db.creators.findOne({
        fanvue_id: creatorFanvueId,
      });

      if (!creator) {
        console.log(`Creator not found: ${creatorFanvueId}`);
        return;
      }

      const fan = await this.db.fans.findOne({
        creator_id: creator.id,
        fanvue_fan_id: fanvueUserId,
      });

      if (!fan) {
        console.log(`Fan not found: ${fanvueUserId}`);
        return;
      }

      // Update fan's lifetime value
      await this.db.fans.update(fan.id, {
        total_tips: (fan.total_tips || 0) + amount,
        lifetime_value: (fan.lifetime_value || 0) + amount,
      });

      // Generate thank you message
      let messageType = 'thank_you';
      let context = `Fan just tipped $${amount}`;

      // If significant tip, offer exclusive content
      if (amount >= 20) {
        messageType = 'high_tip_upsell';
        context += ' (significant tip) - offer exclusive content';
      }

      await this.messageQueue.add(
        'generate_response',
        {
          creator_id: creator.id,
          fan_id: fan.id,
          message_type: messageType,
          context,
          goal: amount >= 20 ? 'sales' : 'retention',
        },
        {
          priority: 2, // Medium priority
        }
      );

      console.log(`Tip received: $${amount} from ${fan.display_name}`);
    } catch (error) {
      console.error('Error handling tip received:', error);
    }
  }

  /**
   * Handle purchase completed
   * Thank and upsell
   */
  private async handlePurchaseCompleted(payload: any): Promise<void> {
    const { data } = payload;
    const creatorFanvueId = data.creator.id;
    const fanvueUserId = data.subscriber.id;
    const amount = data.amount;

    try {
      const creator = await this.db.creators.findOne({
        fanvue_id: creatorFanvueId,
      });

      if (!creator) {
        console.log(`Creator not found: ${creatorFanvueId}`);
        return;
      }

      const fan = await this.db.fans.findOne({
        creator_id: creator.id,
        fanvue_fan_id: fanvueUserId,
      });

      if (!fan) {
        console.log(`Fan not found: ${fanvueUserId}`);
        return;
      }

      // Update fan metrics
      await this.db.fans.update(fan.id, {
        total_purchases: (fan.total_purchases || 0) + amount,
        lifetime_value: (fan.lifetime_value || 0) + amount,
      });

      // Generate thank you message
      await this.messageQueue.add(
        'generate_response',
        {
          creator_id: creator.id,
          fan_id: fan.id,
          message_type: 'purchase_thank_you',
          context: `Fan purchased PPV content for $${amount}`,
          goal: 'retention',
        }
      );

      console.log(`Purchase: $${amount} from ${fan.display_name}`);
    } catch (error) {
      console.error('Error handling purchase completed:', error);
    }
  }
}

/**
 * Message Generation Job Handler
 * Runs in background worker process
 */
export class MessageGenerationWorker {
  constructor(
    private claudeAI: ClaudeAIGenerator,
    private fanvueApi: FanvueAPI,
    private db: Database
  ) {}

  /**
   * Process message generation job
   */
  async generateAndQueueResponse(job: any): Promise<void> {
    const { creator_id, fan_id, message_type, goal, context } = job.data;

    try {
      // Get creator and fan
      const creator = await this.db.creators.findById(creator_id);
      const fan = await this.db.fans.findById(fan_id);

      if (!creator || !fan) {
        throw new Error('Creator or fan not found');
      }

      let generatedMessage;

      // Generate message based on type
      switch (message_type) {
        case 'welcome':
          generatedMessage = await this.claudeAI.generateWelcomeMessage(creator, fan);
          break;
        case 're_engagement':
          generatedMessage = await this.claudeAI.generateReEngagementMessage(creator, fan);
          break;
        case 'high_tip_upsell':
          generatedMessage = await this.claudeAI.generateUpsellMessage(
            creator,
            fan,
            'Exclusive premium content'
          );
          break;
        default:
          generatedMessage = await this.claudeAI.generateMessage(creator, fan, {
            goal: goal || 'engagement',
            context,
          });
      }

      // Check confidence score
      const minConfidence = creator.settings.auto_approve_threshold || 0.8;

      // Save message draft to database
      const savedMessage = await this.db.messages.create({
        creator_id,
        fan_id,
        source_type: 'ai_generated',
        status: generatedMessage.confidence >= minConfidence ? 'approved' : 'pending',
        draft: {
          generated_text: generatedMessage.text,
          ai_confidence: generatedMessage.confidence,
          generated_by: 'claude',
          generation_tokens: generatedMessage.tokensUsed.prompt,
          prompt_tokens: generatedMessage.tokensUsed.completion,
        },
        created_at: new Date(),
      });

      // If auto-approved, send immediately
      if (savedMessage.status === 'approved') {
        await this.sendMessage(creator_id, fan_id, savedMessage.id, generatedMessage.text);
      }

      console.log(
        `Generated message for ${fan.display_name}: confidence=${generatedMessage.confidence.toFixed(2)}`
      );
    } catch (error) {
      console.error('Error generating message:', error);
      throw error;
    }
  }

  /**
   * Send message via Fanvue API
   */
  private async sendMessage(
    creator_id: string,
    fan_id: string,
    message_id: string,
    text: string
  ): Promise<void> {
    try {
      const fan = await this.db.fans.findById(fan_id);
      const creator = await this.db.creators.findById(creator_id);

      if (!fan.fanvue_chat_id || !creator) {
        throw new Error('Missing fan chat ID or creator');
      }

      // Send via Fanvue API
      await this.fanvueApi.sendMessage(fan.fanvue_chat_id, text);

      // Update message status
      await this.db.messages.update(message_id, {
        status: 'sent',
        final_text: text,
        sent_at: new Date(),
      });

      console.log(`Message sent to ${fan.display_name}`);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
}
