# 🚀 Fanvue AI Chatbot - Quick Start

**Status**: Production-ready code
**Build Time**: Today
**Deploy Time**: < 30 minutes

---

## What You're Getting

✅ Complete backend (Express.js + TypeScript)
✅ Recommendation engine (matching + ranking)
✅ Claude AI integration (personalized messages)
✅ Fanvue API integration (OAuth + webhooks)
✅ Message approval workflow
✅ Frontend dashboard (Next.js)
✅ Docker setup (one-click deploy)
✅ Database schema (PostgreSQL)

---

## Prerequisites

- Node.js 20+
- Docker (optional, but recommended)
- PostgreSQL 16+ (if not using Docker)
- Redis 7+ (if not using Docker)
- Fanvue OAuth credentials

---

## Step 1: Get Fanvue OAuth Credentials

1. Go to https://api.fanvue.com/docs/welcome
2. Create OAuth application
3. Set callback URL to: `http://localhost:3001/api/auth/callback`
4. Copy `client_id` and `client_secret`

---

## Step 2: Setup Environment

Create `.env` file in `backend/` directory:

```bash
# Fanvue OAuth
FANVUE_CLIENT_ID=your_client_id
FANVUE_CLIENT_SECRET=your_client_secret
FANVUE_REDIRECT_URI=http://localhost:3001/api/auth/callback
FANVUE_WEBHOOK_SECRET=your_webhook_secret

# Claude AI
ANTHROPIC_API_KEY=your_anthropic_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fanvue_chatbot
REDIS_URL=redis://localhost:6379

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## Step 3: Quick Setup (Docker)

### Option A: Docker Compose (Easiest)

```bash
cd fanvue_chatbot

docker-compose up
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Backend on port 3001
- Frontend on port 3000

Open browser: http://localhost:3000

### Option B: Manual Setup

#### Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

#### Start PostgreSQL & Redis

```bash
# PostgreSQL
createdb fanvue_chatbot

# Redis
redis-server
```

#### Initialize Database

```bash
cd backend
npm run db:init
```

#### Start Backend

```bash
cd backend
npm run dev
```

#### Start Frontend (new terminal)

```bash
cd frontend
npm run dev
```

Open browser: http://localhost:3000

---

## Step 4: Test the System

### Test Webhook Locally (with ngrok)

```bash
# Terminal 1: Start ngrok
ngrok http 3001

# Get your ngrok URL like: https://xxxx-xxxx-xxxx.ngrok.io

# Terminal 2: Update Fanvue webhook URL
# In Fanvue developer dashboard, set webhook URL to:
# https://xxxx-xxxx-xxxx.ngrok.io/webhooks/fanvue
```

### Test OAuth Flow

1. Go to http://localhost:3000
2. Click "Login with Fanvue"
3. Authorize the app
4. Should redirect to dashboard

### Test Message Processing

```bash
# Send test message via webhook with curl:

curl -X POST http://localhost:3001/webhooks/fanvue \
  -H "Content-Type: application/json" \
  -H "X-Fanvue-Signature: test-signature" \
  -d '{
    "event_type": "message.received",
    "data": {
      "creator": {"id": "creator_123"},
      "subscriber": {"id": "fan_456", "display_name": "Test Fan"},
      "message": "Do you have lingerie content?",
      "chat_id": "chat_789"
    }
  }'
```

---

## File Structure

```
backend/
├── src/
│   ├── index.ts                    # Express app
│   ├── api/
│   │   ├── auth.ts                # OAuth
│   │   ├── creators.ts            # Creator endpoints
│   │   ├── fans.ts                # Fan CRM endpoints
│   │   ├── messages.ts            # Message approval
│   │   └── webhooks.ts            # Webhook handlers
│   └── services/
│       ├── database.ts            # PostgreSQL
│       ├── redis.ts               # Redis
│       ├── fanvue-api.ts          # Fanvue API client
│       ├── claude-ai.ts           # Claude integration
│       ├── recommendation-engine.ts # Core logic
│       └── message-worker.ts      # Message processor
├── package.json
├── tsconfig.json
└── Dockerfile

frontend/
├── pages/
│   ├── _app.tsx                   # App wrapper
│   ├── index.tsx                  # Message queue
│   ├── login.tsx                  # OAuth login
│   └── fans.tsx                   # Fan CRM
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## API Endpoints

### Authentication
- `GET /api/auth/login` - Start OAuth
- `GET /api/auth/callback` - OAuth callback

### Creators
- `GET /api/creators/me` - Get profile
- `PUT /api/creators/settings` - Update settings

### Fans
- `GET /api/fans` - List fans
- `GET /api/fans/:fanId` - Fan details

### Messages
- `GET /api/messages/pending` - Pending approvals
- `POST /api/messages/:messageId/approve` - Approve & send
- `POST /api/messages/:messageId/reject` - Reject

### Webhooks
- `POST /webhooks/fanvue` - Fanvue events

---

## Database Schema

Automatically created on startup:

- `creators` - Creator accounts & settings
- `fan_profiles` - Fan CRM data
- `messages` - Message drafts & history
- `content_vault` - Creator's content library
- `analytics_events` - Event tracking

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| FANVUE_CLIENT_ID | Yes | - | OAuth client ID |
| FANVUE_CLIENT_SECRET | Yes | - | OAuth client secret |
| FANVUE_REDIRECT_URI | Yes | - | OAuth callback URL |
| FANVUE_WEBHOOK_SECRET | Yes | - | Webhook signature secret |
| ANTHROPIC_API_KEY | Yes | - | Claude API key |
| DATABASE_URL | Yes | - | PostgreSQL connection |
| REDIS_URL | Yes | - | Redis connection |
| PORT | No | 3001 | Backend port |
| NODE_ENV | No | development | Environment |
| FRONTEND_URL | No | http://localhost:3000 | Frontend URL |

---

## Deployment (Production)

### Vercel (Frontend)

```bash
cd frontend
vercel deploy
```

### Railway/Render (Backend)

1. Connect git repo
2. Set environment variables
3. Deploy

### Database

Use managed PostgreSQL:
- Supabase
- Railway
- AWS RDS
- Azure Database

---

## Troubleshooting

### Webhook signature error
- Make sure `FANVUE_WEBHOOK_SECRET` matches Fanvue dashboard

### Database connection error
- Check `DATABASE_URL` is correct
- Verify PostgreSQL is running

### Claude API error
- Verify `ANTHROPIC_API_KEY` is correct

### OAuth callback not working
- Make sure `FANVUE_REDIRECT_URI` matches OAuth app settings

---

## Next Steps

1. ✅ Set up the system
2. ✅ Test with your Fanvue account
3. ✅ Create content in your vault with TAGS
4. ✅ Set webhook URL in Fanvue dashboard
5. ✅ Test message recommendations
6. ✅ Deploy to production

---

## Support

- Check logs: `docker-compose logs -f backend`
- Verify webhook: Check Fanvue developer dashboard
- Test endpoints: Use Postman or cURL

---

## You're Ready 🚀

The system is running. When a fan messages, it will:
1. Receive via webhook
2. Load fan profile
3. Search your vault
4. Generate personalized message
5. Queue for approval (or auto-send)
6. Track outcome

**Let's ship this.** 🚀
