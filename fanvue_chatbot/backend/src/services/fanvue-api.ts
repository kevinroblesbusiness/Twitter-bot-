import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
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
    private webhookSecret: string
  ) {
    this.client = axios.create({
      baseURL: 'https://api.fanvue.com/v1',
      headers: {
        'X-Fanvue-API-Version': '2025-06-26',
        'Content-Type': 'application/json',
      },
    });
  }

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

  async exchangeCodeForToken(code: string): Promise<TokenData> {
    try {
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
    } catch (error) {
      console.error('Failed to exchange code for token:', error);
      throw error;
    }
  }

  async refreshAccessToken(): Promise<TokenData> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
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
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  setTokens(accessToken: string, refreshToken: string, expiresAt: number) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
  }

  getTokens() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.expiresAt,
    };
  }

  private async ensureValidToken() {
    if (!this.accessToken) {
      throw new Error('No access token');
    }

    if (this.expiresAt && Date.now() > this.expiresAt - 60000) {
      await this.refreshAccessToken();
    }

    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
  }

  async getUnreadMessages(limit = 50, offset = 0) {
    await this.ensureValidToken();

    const response = await this.client.get('/users/self/chats', {
      params: { filter: 'unread', limit, offset },
    });

    return response.data.data || [];
  }

  async getFans(limit = 100, offset = 0) {
    await this.ensureValidToken();

    const response = await this.client.get('/users/self/subscriptions', {
      params: { limit, offset },
    });

    return response.data.data || [];
  }

  async sendMessage(chatId: string, message: string, ppvContentId?: string, ppvPrice?: number) {
    await this.ensureValidToken();

    const payload: any = { message, attachments: [] };

    if (ppvContentId && ppvPrice) {
      payload.price = ppvPrice;
    }

    const response = await this.client.post(`/chats/${chatId}/messages`, payload);
    return response.data;
  }

  verifyWebhookSignature(requestBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(requestBody)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  parseWebhookPayload(requestBody: string, signature: string): any {
    if (!this.verifyWebhookSignature(requestBody, signature)) {
      throw new Error('Invalid webhook signature');
    }

    return JSON.parse(requestBody);
  }
}

export function createFanvueAPI(): FanvueAPI {
  return new FanvueAPI(
    process.env.FANVUE_CLIENT_ID || '',
    process.env.FANVUE_CLIENT_SECRET || '',
    process.env.FANVUE_REDIRECT_URI || '',
    process.env.FANVUE_WEBHOOK_SECRET || ''
  );
}
