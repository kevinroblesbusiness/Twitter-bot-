/**
 * Fanvue API Client
 * Handles OAuth, token refresh, and API calls
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface FanvueMessage {
  id: string;
  chat_id: string;
  creator: {
    id: string;
    username: string;
  };
  subscriber: {
    id: string;
    username: string;
    display_name: string;
  };
  message: string;
  created_at: string;
  is_unread: boolean;
}

interface FanvueSubscriber {
  id: string;
  subscriber: {
    id: string;
    username: string;
    display_name: string;
    profile_image: string;
  };
  tier: 'standard' | 'vip';
  subscribed_at: string;
  expires_at: string;
  amount: number;
  currency: string;
}

export class FanvueAPI {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string,
    private webhookSecret: string,
  ) {
    this.client = axios.create({
      baseURL: 'https://api.fanvue.com/v1',
      headers: {
        'X-Fanvue-API-Version': '2025-06-26',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'chats:read chats:write users:read subscriptions:read tips:read content:read',
      state,
    });

    return `https://app.fanvue.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<TokenData> {
    const response = await axios.post('https://api.fanvue.com/v1/oauth/token', {
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });

    const { access_token, refresh_token, expires_in } = response.data;

    this.accessToken = access_token;
    this.refreshToken = refresh_token;
    this.expiresAt = Date.now() + expires_in * 1000;

    return response.data;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<TokenData> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post('https://api.fanvue.com/v1/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const { access_token, refresh_token, expires_in } = response.data;

    this.accessToken = access_token;
    this.refreshToken = refresh_token;
    this.expiresAt = Date.now() + expires_in * 1000;

    return response.data;
  }

  /**
   * Restore session from stored tokens
   */
  setTokens(accessToken: string, refreshToken: string, expiresAt: number) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
  }

  /**
   * Get current tokens
   */
  getTokens() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.expiresAt,
    };
  }

  /**
   * Ensure token is fresh, refresh if needed
   */
  private async ensureValidToken() {
    if (!this.accessToken) {
      throw new Error('No access token');
    }

    if (this.expiresAt && Date.now() > this.expiresAt - 60000) {
      // Refresh if expiring within 1 minute
      await this.refreshAccessToken();
    }

    // Set authorization header
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
  }

  /**
   * Get unread messages
   */
  async getUnreadMessages(limit = 50, offset = 0): Promise<FanvueMessage[]> {
    await this.ensureValidToken();

    const response = await this.client.get('/users/self/chats', {
      params: {
        filter: 'unread',
        limit,
        offset,
      },
    });

    return response.data.data || [];
  }

  /**
   * Get all fan/subscriber list
   */
  async getFans(limit = 100, offset = 0): Promise<FanvueSubscriber[]> {
    await this.ensureValidToken();

    const response = await this.client.get('/users/self/subscriptions', {
      params: {
        limit,
        offset,
      },
    });

    return response.data.data || [];
  }

  /**
   * Send a message to a chat
   */
  async sendMessage(chatId: string, message: string): Promise<any> {
    await this.ensureValidToken();

    const response = await this.client.post(`/chats/${chatId}/messages`, {
      message,
      attachments: [],
    });

    return response.data;
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    await this.ensureValidToken();

    await this.client.put(`/messages/${messageId}`, {
      is_read: true,
    });
  }

  /**
   * Verify webhook signature
   * @param requestBody - Raw request body as string
   * @param signature - X-Fanvue-Signature header value
   */
  verifyWebhookSignature(requestBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(requestBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  /**
   * Parse webhook payload with verification
   */
  parseWebhookPayload(requestBody: string, signature: string): any {
    if (!this.verifyWebhookSignature(requestBody, signature)) {
      throw new Error('Invalid webhook signature');
    }

    return JSON.parse(requestBody);
  }
}

export default FanvueAPI;
