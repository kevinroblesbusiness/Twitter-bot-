import Anthropic from '@anthropic-ai/sdk';

interface Fan {
  id: string;
  display_name: string;
  subscription_tier: string;
  preference_tags?: string[];
  engagement_score?: number;
  total_lifetime?: number;
  average_ppv_price?: number;
}

interface Creator {
  id: string;
  name: string;
  message_tone?: string;
  ai_profile?: {
    common_phrases?: string[];
    style_keywords?: string[];
  };
}

interface ContentItem {
  id: string;
  filename: string;
  price: number;
  tags: string[];
  duration_seconds?: number;
  views: number;
  purchases: number;
}

interface GeneratedMessage {
  text: string;
  confidence: number;
  tokensUsed: {
    prompt: number;
    completion: number;
  };
}

export class ClaudeAIGenerator {
  private client: Anthropic;
  private model = 'claude-sonnet-4-6';
  private maxTokens = 300;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateMessage(
    creator: Creator,
    fan: Fan,
    content: ContentItem,
    originalRequest: string
  ): Promise<GeneratedMessage> {
    const systemPrompt = this.buildSystemPrompt(creator);
    const userPrompt = this.buildUserPrompt(creator, fan, content, originalRequest);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const messageContent = response.content[0];
    if (messageContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const confidence = this.calculateConfidence(messageContent.text);

    return {
      text: messageContent.text,
      confidence,
      tokensUsed: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
      },
    };
  }

  private buildSystemPrompt(creator: Creator): string {
    let prompt = `You are ${creator.name}, a content creator on Fanvue.

Your message tone should be: ${creator.message_tone || 'friendly and personal'}

Writing guidelines:
- Keep messages under 200 characters when possible
- Be authentic and personal, not generic
- Use conversational language
- Never be salesy or pushy
- Acknowledge the fan's loyalty if appropriate
- Sound like a real person, not a bot`;

    if (creator.ai_profile?.style_keywords) {
      prompt += `\n\nYour writing style: ${creator.ai_profile.style_keywords.join(', ')}`;
    }

    return prompt;
  }

  private buildUserPrompt(
    creator: Creator,
    fan: Fan,
    content: ContentItem,
    originalRequest: string
  ): string {
    let prompt = `Write a personalized DM to ${fan.display_name}.

About them:
- Subscriber tier: ${fan.subscription_tier}
- They just asked: "${originalRequest}"
- Lifetime spent: $${fan.total_lifetime || 0}

Content to recommend:
- Title: ${content.filename}
- Price: $${content.price}
- ${content.duration_seconds ? `Duration: ${Math.floor(content.duration_seconds / 60)} min` : 'Photo set'}
- Tags: ${content.tags.slice(0, 3).join(', ')}

Write ONLY the message itself (no labels, no meta text). Keep it under 150 words. Sound personal and authentic.`;

    return prompt;
  }

  private calculateConfidence(message: string): number {
    let confidence = 0.75;

    if (message.length > 30 && message.length < 300) {
      confidence += 0.1;
    }

    if (message.includes('?') || message.includes('!')) {
      confidence += 0.1;
    }

    if (message.toLowerCase().includes('hey') || message.toLowerCase().includes('hi')) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }
}

export function createClaudeGenerator(): ClaudeAIGenerator {
  return new ClaudeAIGenerator();
}
