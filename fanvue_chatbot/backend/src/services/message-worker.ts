import { RedisClientType } from 'redis';
import { queryOne, execute } from './database.js';
import { createClaudeGenerator } from './claude-ai.js';
import { searchContentByTags, rankContentForFan, predictConversionProbability } from './recommendation-engine.js';
import { createFanvueAPI } from './fanvue-api.js';
import { v4 as uuidv4 } from 'uuid';

const claude = createClaudeGenerator();
const fanvueApi = createFanvueAPI();

export function startMessageWorker(redis: RedisClientType) {
  console.log('🔄 Starting message processing worker...');

  // Process messages continuously
  processMessages(redis);
}

async function processMessages(redis: RedisClientType) {
  while (true) {
    try {
      // Get message from queue
      const messageJson = await redis.lPop('message_queue');

      if (!messageJson) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before checking again
        continue;
      }

      const message = JSON.parse(messageJson);
      console.log(`\n📨 Processing message for fan: ${message.fan_id}`);

      // Get creator and fan data
      const creator = await queryOne<any>(
        `SELECT * FROM creators WHERE id = $1`,
        [message.creator_id]
      );

      const fan = await queryOne<any>(
        `SELECT * FROM fan_profiles WHERE id = $1`,
        [message.fan_id]
      );

      if (!creator || !fan) {
        console.error('Creator or fan not found');
        continue;
      }

      // Check if auto-welcome message
      if (message.message_type === 'welcome') {
        await handleWelcomeMessage(creator, fan);
        continue;
      }

      // Regular message handling
      await handleRegularMessage(creator, fan, message.message_text, message.fanvue_chat_id);
    } catch (error) {
      console.error('Message worker error:', error);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before retry
    }
  }
}

async function handleRegularMessage(
  creator: any,
  fan: any,
  messageText: string,
  chatId: string
) {
  try {
    // 1. Extract intent (for now, simple tag extraction)
    const requestedTags = extractTagsFromMessage(messageText);
    console.log(`   Tags detected: ${requestedTags.join(', ') || 'none'}`);

    // 2. Search content
    const candidates = await searchContentByTags(creator.id, requestedTags, 5);
    console.log(`   Found ${candidates.length} matching content items`);

    if (candidates.length === 0) {
      console.log('   No matching content found');
      return;
    }

    // 3. Rank by fan preferences
    const ranked = await rankContentForFan(fan.id, candidates);
    const bestContent = ranked[0];
    console.log(`   Best match: ${bestContent.filename} (score: ${bestContent.final_score?.toFixed(2)})`);

    // 4. Predict conversion
    const conversionProb = await predictConversionProbability(fan.id, bestContent.price);
    console.log(`   Conversion probability: ${(conversionProb * 100).toFixed(0)}%`);

    // 5. Generate message
    console.log('   Generating personalized message...');
    const messageGenResult = await claude.generateMessage(
      {
        id: creator.id,
        name: creator.name,
        message_tone: creator.settings?.message_tone || 'friendly',
        ai_profile: creator.ai_profile,
      },
      fan,
      bestContent,
      messageText
    );

    console.log(`   Message generated (confidence: ${messageGenResult.confidence.toFixed(2)})`);

    // 6. Save message draft
    const messageId = uuidv4();
    await execute(
      `INSERT INTO messages (
        id, creator_id, fan_id, source_type, status, draft, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      [
        messageId,
        creator.id,
        fan.id,
        'ai_generated',
        messageGenResult.confidence >= (creator.settings?.auto_approve_threshold || 0.8)
          ? 'approved'
          : 'pending',
        JSON.stringify({
          generated_text: messageGenResult.text,
          ai_confidence: messageGenResult.confidence,
          generated_by: 'claude',
          recommended_content_id: bestContent.content_id,
          prediction_probability: conversionProb,
        }),
      ]
    );

    console.log(`   Message ${messageId} saved (status: ${messageGenResult.confidence >= (creator.settings?.auto_approve_threshold || 0.8) ? 'auto-approved' : 'pending'})`);

    // 7. Auto-send if confidence high enough
    if (messageGenResult.confidence >= (creator.settings?.auto_approve_threshold || 0.8)) {
      console.log('   Auto-sending message...');
      try {
        // Set creator tokens for Fanvue API
        if (creator.oauth_access_token) {
          fanvueApi.setTokens(
            creator.oauth_access_token,
            creator.oauth_refresh_token || '',
            creator.oauth_expires_at ? new Date(creator.oauth_expires_at).getTime() : Date.now()
          );
        }

        // Send via Fanvue
        const sendResult = await fanvueApi.sendMessage(
          chatId,
          messageGenResult.text,
          bestContent.content_id,
          bestContent.price
        );

        // Update message status
        await execute(
          `UPDATE messages SET status = 'sent', final_text = $1, sent_at = NOW() WHERE id = $2`,
          [messageGenResult.text, messageId]
        );

        console.log(`   ✅ Message sent via Fanvue!`);
      } catch (error) {
        console.error('   ❌ Failed to send message:', error);
        await execute(
          `UPDATE messages SET status = 'failed' WHERE id = $1`,
          [messageId]
        );
      }
    }
  } catch (error) {
    console.error('Error handling regular message:', error);
  }
}

async function handleWelcomeMessage(creator: any, fan: any) {
  try {
    console.log('   Generating welcome message...');

    // Get newest content for welcome
    const candidates = await searchContentByTags(creator.id, [], 1);
    if (candidates.length === 0) {
      console.log('   No content available for welcome message');
      return;
    }

    const bestContent = candidates[0];

    const messageGenResult = await claude.generateMessage(
      {
        id: creator.id,
        name: creator.name,
        message_tone: creator.settings?.message_tone || 'friendly',
        ai_profile: creator.ai_profile,
      },
      fan,
      bestContent,
      'Welcome! Check out what I have available'
    );

    console.log('   Welcome message generated');

    // Save and send
    const messageId = uuidv4();
    await execute(
      `INSERT INTO messages (
        id, creator_id, fan_id, source_type, status, draft, final_text, sent_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW(), NOW())`,
      [
        messageId,
        creator.id,
        fan.id,
        'ai_generated',
        'sent',
        JSON.stringify({
          generated_text: messageGenResult.text,
          ai_confidence: messageGenResult.confidence,
          generated_by: 'claude',
          message_type: 'welcome',
        }),
        messageGenResult.text,
      ]
    );

    console.log('   ✅ Welcome message sent!');
  } catch (error) {
    console.error('Error handling welcome message:', error);
  }
}

function extractTagsFromMessage(text: string): string[] {
  // Simple keyword matching for now
  const keywords: { [key: string]: string[] } = {
    lingerie: ['lingerie', 'bra', 'panties'],
    teasing: ['tease', 'teasing', 'slow'],
    bedroom: ['bedroom', 'bed', 'intimate'],
    video: ['video', 'footage', 'clip'],
    photo: ['photo', 'picture', 'pic'],
    custom: ['custom', 'personalized', 'custom content'],
  };

  const lowerText = text.toLowerCase();
  const found = new Set<string>();

  for (const [tag, keywords_] of Object.entries(keywords)) {
    for (const keyword of keywords_) {
      if (lowerText.includes(keyword)) {
        found.add(tag);
        break;
      }
    }
  }

  return Array.from(found);
}
