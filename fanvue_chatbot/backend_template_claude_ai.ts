/**
 * Claude AI Message Generator
 * Generates personalized fan messages using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

interface Fan {
  id: string;
  display_name: string;
  tier: 'free' | 'subscriber' | 'vip';
  lifetime_value: number;
  last_message?: string;
  interests?: string[];
  engagement_level: 'high' | 'medium' | 'low';
}

interface Creator {
  id: string;
  name: string;
  tone: 'friendly' | 'flirty' | 'professional';
  voice_samples?: string[]; // Past messages to learn from
  style_keywords?: string[]; // e.g., ['casual', 'playful', 'mysterious']
}

interface MessageGenerationOptions {
  context?: string; // Optional context (e.g., "fan just tipped $50")
  goal?: 'engagement' | 'sales' | 'retention'; // What do we want to achieve
  contentType?: string; // What are we promoting
  maxLength?: number; // Max message length
  includeConfidence?: boolean; // Return confidence score
}

interface GeneratedMessage {
  text: string;
  confidence: number; // 0-1 score of how "authentic" it sounds
  tokensUsed: {
    prompt: number;
    completion: number;
  };
  suggestedActions?: string[]; // e.g., ['ask_about_interests', 'mention_ppv']
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

  /**
   * Generate a personalized message for a fan
   */
  async generateMessage(
    creator: Creator,
    fan: Fan,
    options: MessageGenerationOptions = {}
  ): Promise<GeneratedMessage> {
    const systemPrompt = this.buildSystemPrompt(creator);
    const userPrompt = this.buildUserPrompt(creator, fan, options);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxLength || this.maxTokens,
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

    return {
      text: messageContent.text,
      confidence: this.calculateConfidence(creator, fan, messageContent.text),
      tokensUsed: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
      },
      suggestedActions: this.extractSuggestedActions(messageContent.text),
    };
  }

  /**
   * Build system prompt from creator profile
   */
  private buildSystemPrompt(creator: Creator): string {
    let prompt = `You are writing a direct message as ${creator.name}, a content creator on Fanvue.

Your message tone should be: ${creator.tone}

Writing guidelines:
- Keep messages under 280 characters when possible
- Be authentic and personal, not generic
- Use conversational language
- If the fan has shown specific interests, reference them
- Suggest content or engagement naturally when relevant
- Never be salesy or pushy
- Acknowledge their loyalty if they're a long-time supporter`;

    if (creator.style_keywords && creator.style_keywords.length > 0) {
      prompt += `\n\nYour writing style includes: ${creator.style_keywords.join(', ')}`;
    }

    if (creator.voice_samples && creator.voice_samples.length > 0) {
      prompt += `\n\nExamples of your typical messages:\n`;
      creator.voice_samples.slice(0, 3).forEach((sample) => {
        prompt += `- "${sample}"\n`;
      });
      prompt += `\nMatch this tone and style.`;
    }

    return prompt;
  }

  /**
   * Build user prompt with fan context
   */
  private buildUserPrompt(
    creator: Creator,
    fan: Fan,
    options: MessageGenerationOptions
  ): string {
    let prompt = `Write a personalized message to ${fan.display_name}.`;

    if (fan.tier === 'vip') {
      prompt += ` They are a VIP subscriber with $${fan.lifetime_value} lifetime value - acknowledge their loyalty.`;
    } else if (fan.tier === 'subscriber') {
      prompt += ` They are an active subscriber.`;
    } else {
      prompt += ` They are a free subscriber/fan.`;
    }

    if (fan.engagement_level === 'high') {
      prompt += ` They are highly engaged.`;
    } else if (fan.engagement_level === 'low') {
      prompt += ` They haven't been as active lately - try to re-engage them.`;
    }

    if (fan.interests && fan.interests.length > 0) {
      prompt += ` They've shown interest in: ${fan.interests.join(', ')}.`;
    }

    if (options.context) {
      prompt += `\n\nContext: ${options.context}`;
    }

    if (options.goal) {
      prompt += `\n\nGoal: ${this.getGoalInstruction(options.goal)}`;
    }

    if (options.contentType) {
      prompt += `\n\nYou're promoting: ${options.contentType}`;
    }

    prompt += `\n\nWrite only the message itself - no labels or meta commentary.`;

    return prompt;
  }

  /**
   * Get specific instruction based on goal
   */
  private getGoalInstruction(goal: string): string {
    const goals: Record<string, string> = {
      engagement: 'Engage them in conversation. Ask a question or start a fun discussion.',
      sales: 'Encourage them to purchase your PPV content or become a subscriber.',
      retention: 'Thank them for their support and remind them why they love following you.',
    };
    return goals[goal] || goals.engagement;
  }

  /**
   * Calculate confidence score (0-1)
   * Higher = more likely to be authentic and well-received
   */
  private calculateConfidence(creator: Creator, fan: Fan, message: string): number {
    let score = 0.75; // Base score

    // Bonus for personalization
    if (message.includes(fan.display_name)) {
      score += 0.1;
    }

    // Bonus for appropriate length
    if (message.length > 30 && message.length < 280) {
      score += 0.05;
    }

    // Bonus for engagement (questions, exclamation marks)
    if (message.includes('?') || message.includes('!')) {
      score += 0.05;
    }

    // Penalty for generic patterns
    if (this.hasGenericPatterns(message)) {
      score -= 0.15;
    }

    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Detect generic/templated messages
   */
  private hasGenericPatterns(message: string): boolean {
    const genericPatterns = [
      /^hi (?:there|babe|beautiful)/i,
      /thanks for (the )?support/i,
      /let me know if you want/i,
      /feel free to (dm|message) me/i,
      /i love (all )?my fans/i,
    ];

    return genericPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Extract suggested actions from message
   * Could be used to auto-trigger follow-up actions
   */
  private extractSuggestedActions(message: string): string[] {
    const actions: string[] = [];

    if (message.includes('?')) {
      actions.push('wait_for_response');
    }

    if (
      message.toLowerCase().includes('exclusive') ||
      message.toLowerCase().includes('content')
    ) {
      actions.push('track_ppv_interest');
    }

    if (message.toLowerCase().includes('tip') || message.includes('💰')) {
      actions.push('track_tip_request');
    }

    return actions;
  }

  /**
   * Generate multiple message variations
   * Useful for A/B testing or giving creator choices
   */
  async generateMessageVariations(
    creator: Creator,
    fan: Fan,
    options: MessageGenerationOptions = {},
    count = 3
  ): Promise<GeneratedMessage[]> {
    const variations: GeneratedMessage[] = [];

    for (let i = 0; i < count; i++) {
      const message = await this.generateMessage(creator, fan, {
        ...options,
        maxLength: options.maxLength || 300,
      });
      variations.push(message);
    }

    // Sort by confidence
    return variations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate welcome message for new subscriber
   */
  async generateWelcomeMessage(creator: Creator, fan: Fan): Promise<GeneratedMessage> {
    return this.generateMessage(creator, fan, {
      goal: 'engagement',
      context: 'New subscriber just joined',
      maxLength: 200,
    });
  }

  /**
   * Generate re-engagement message for inactive fan
   */
  async generateReEngagementMessage(creator: Creator, fan: Fan): Promise<GeneratedMessage> {
    const daysInactive = Math.floor((Date.now() - Date.parse(fan.last_message || '')) / (1000 * 60 * 60 * 24));

    return this.generateMessage(creator, fan, {
      goal: 'retention',
      context: `This fan has been inactive for ${daysInactive} days`,
      maxLength: 250,
    });
  }

  /**
   * Generate PPV/upsell message
   */
  async generateUpsellMessage(
    creator: Creator,
    fan: Fan,
    contentDescription: string
  ): Promise<GeneratedMessage> {
    return this.generateMessage(creator, fan, {
      goal: 'sales',
      contentType: contentDescription,
      maxLength: 280,
      context: 'Suggesting premium content',
    });
  }
}

export default ClaudeAIGenerator;
