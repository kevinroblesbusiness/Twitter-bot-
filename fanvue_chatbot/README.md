# Fanvue AI Chatbot Platform

A SaaS platform that automates fan engagement for content creators using AI-powered message generation.

## Overview

This platform helps Fanvue/OnlyFans creators scale their fan engagement by:

1. **Automatically generating personalized messages** using Claude AI
2. **Learning creator voice/tone** from past messages
3. **Managing fan relationships** with a built-in CRM
4. **Smart recommendations** for content promotions
5. **Freeing up creator time** while increasing fan interaction

### Key Statistics (Competitive Baseline)

- **25-30% cost savings** on chat labor
- **90% message automation** potential
- **Customizable approval workflow** (human-in-the-loop)
- **Multi-platform support** (Fanvue, OnlyFans, Fansly)

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Fanvue OAuth app credentials

### Installation

```bash
# Clone repository
git clone <repo>
cd fanvue_chatbot

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Run migrations
npm run migrate --prefix backend

# Start development servers
npm run dev --prefix backend  # http://localhost:3001
npm run dev --prefix frontend # http://localhost:3000
```

### Get Fanvue OAuth Credentials

1. Go to [Fanvue Developer Portal](https://api.fanvue.com/docs/welcome)
2. Create new OAuth application
3. Set callback URL to `http://localhost:3000/auth/callback`
4. Copy `client_id` and `client_secret` to `.env`

---

## Architecture

```
Fanvue Platform
    ↓
Webhook Events (message, subscription, tip, purchase)
    ↓
[Backend API] - Express.js
    ├── OAuth Management
    ├── Fanvue API Client
    ├── Webhook Handlers
    ├── Message Generation Queue (Bull + Redis)
    └── Database (PostgreSQL)
    ↓
[Claude AI Engine]
    ├── Personalized message generation
    ├── Creator voice matching
    └── Confidence scoring
    ↓
[Frontend Dashboard] - Next.js
    ├── Creator auth
    ├── Message queue (approval interface)
    ├── Fan CRM
    ├── Analytics dashboard
    └── Settings
```

### Core Data Models

**Creator**
- Fanvue account info
- OAuth tokens
- Settings (tone, auto-approve threshold)
- AI training data (voice samples, style)

**Fan**
- Profile info
- Subscription status
- Lifetime value metrics
- Preferences & interests
- Conversation history

**Message**
- AI-generated draft
- Status (pending, approved, sent, failed)
- Final text (what was sent)
- Fan response tracking

**Conversation**
- Thread of messages with a fan
- Context for AI generation
- Inferred topics

---

## Project Structure

```
fanvue_chatbot/
├── backend/                    # Express.js API
│   ├── src/
│   │   ├── api/               # Route handlers
│   │   ├── services/          # Business logic
│   │   ├── models/            # Database models
│   │   └── config/            # Configuration
│   ├── migrations/            # Database migrations
│   └── package.json
├── frontend/                   # Next.js Dashboard
│   ├── app/                   # Pages & layouts
│   ├── components/            # React components
│   └── package.json
├── docs/                      # Documentation
├── DATABASE_SCHEMA.sql        # PostgreSQL schema
└── IMPLEMENTATION_ROADMAP.md  # Development plan
```

---

## Key Features

### 1. AI Message Generation

Powered by Claude API with:
- Personalized context (fan history, tier, purchase behavior)
- Creator voice matching (learns from past messages)
- Multiple message templates (welcome, upsell, re-engagement)
- Confidence scoring

```python
message = await claude.generateMessage(
    creator=creator_profile,
    fan=fan_data,
    goal="engagement",
    context="Fan just tipped $50"
)
# → "Hey Sarah! Thanks so much for that generous tip! 💕..."
```

### 2. Webhook Integration

Auto-triggered on:
- **message.received** - Queue AI response
- **subscriber.created** - Send welcome message
- **tip.received** - Thank you + upsell
- **purchase.completed** - Confirm delivery

### 3. Message Approval Workflow

1. AI generates draft
2. Confidence check (auto-approve if > threshold)
3. If not auto-approved, human reviews in dashboard
4. Editor can modify before sending
5. Message sent via Fanvue API
6. Response tracking & analytics

### 4. Fan CRM

- Track all fan interactions
- Segment by tier, engagement, churn risk
- Lifetime value calculations
- Conversation history

### 5. Analytics

- Total messages sent/approved
- Response rates
- Revenue impact per message type
- AI cost tracking
- Creator performance metrics

---

## API Endpoints

### Authentication

```
POST   /api/auth/login              # Initiate OAuth
GET    /api/auth/callback           # OAuth callback
POST   /api/auth/logout             # Logout
```

### Creator Management

```
GET    /api/creators/me             # Get profile
PUT    /api/creators/me             # Update settings
GET    /api/creators/me/stats       # Dashboard stats
```

### Messages

```
GET    /api/messages                # List messages (queue)
GET    /api/messages/:id            # Get message details
POST   /api/messages/:id/approve    # Approve & send
POST   /api/messages/:id/reject     # Reject draft
```

### Fans (CRM)

```
GET    /api/fans                    # List all fans
GET    /api/fans/:id                # Get fan profile
PUT    /api/fans/:id                # Update preferences
GET    /api/fans/:id/conversations  # Chat history
```

### Analytics

```
GET    /api/analytics/dashboard     # Overview stats
GET    /api/analytics/messages      # Message metrics
GET    /api/analytics/revenue       # Revenue tracking
```

---

## Configuration

### Creator Settings

```json
{
  "message_tone": "friendly|flirty|professional",
  "auto_approve_threshold": 0.8,        // 0-1 confidence score
  "daily_message_limit": 100,
  "enable_smart_ppv": true,
  "enable_auto_welcome": true,
  "enable_sentiment_analysis": true
}
```

### Auto-Approval Rules

- Confidence > threshold → Auto-approve
- Confidence < threshold → Require human approval
- Can be disabled per creator

---

## Webhook Security

Every webhook includes signature verification:

```typescript
// Verify incoming webhook
const payload = fanvueApi.parseWebhookPayload(
  requestBody,
  signatureHeader
);
```

Signatures use HMAC-SHA256 with webhook secret.

---

## Database Schema

### Key Tables

- `creators` - Creator accounts & settings
- `fans` - Fan profiles with engagement metrics
- `messages` - Message drafts, approvals, sends
- `conversations` - Thread groupings
- `analytics_events` - All tracked events

See `DATABASE_SCHEMA.sql` for complete schema.

---

## Testing

### Manual Testing

```bash
# Start with test creator account
npm run seed:creators --prefix backend

# Test webhook locally with ngrok
ngrok http 3001

# Send test webhook
curl -X POST http://localhost:3001/webhooks/fanvue \
  -H "X-Fanvue-Signature: ..." \
  -d '{"event_type":"message.received",...}'
```

### Automated Tests

```bash
npm run test --prefix backend
npm run test --prefix frontend
```

---

## Deployment

### Environment Variables Required

```
# Fanvue
FANVUE_CLIENT_ID
FANVUE_CLIENT_SECRET
FANVUE_WEBHOOK_SECRET

# Claude AI
ANTHROPIC_API_KEY

# Database
DATABASE_URL

# Redis
REDIS_URL

# Application
NODE_ENV
```

### Production Deployment

```bash
# Build frontend
npm run build --prefix frontend

# Deploy backend to Railway/Render
# Deploy frontend to Vercel
# Set up PostgreSQL on production
# Set up Redis on production
# Configure webhook URL in Fanvue dashboard
```

---

## Roadmap

- [x] Fanvue API integration
- [x] Claude AI message generation
- [x] Webhook handling
- [x] Basic message approval workflow
- [ ] Creator voice training
- [ ] Multi-platform support (OnlyFans, Fansly)
- [ ] Agency dashboard (multi-creator)
- [ ] Advanced automation rules
- [ ] A/B testing for messages
- [ ] White-label SaaS version

---

## Contributing

See `CONTRIBUTING.md` for guidelines.

---

## Support

- 📖 [API Documentation](./docs/API.md)
- 🏗️ [Architecture Guide](./docs/ARCHITECTURE.md)
- 🚀 [Deployment Guide](./docs/DEPLOYMENT.md)
- 📋 [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md)
- 📚 [Fanvue API Docs](https://api.fanvue.com/docs/welcome)

---

## License

MIT

---

## Contact

Kevin Robles - [@kevinrobles](https://github.com/kevinroblesbusiness)

---

**Built with:**
- Claude API (message generation)
- Express.js (backend)
- Next.js (frontend)
- PostgreSQL (data)
- Redis (queue)
- Bull (job processing)
- TypeScript (type safety)

