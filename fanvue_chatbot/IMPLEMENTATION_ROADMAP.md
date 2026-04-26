# Fanvue AI Chatbot - Implementation Roadmap

## Overview

This document outlines the step-by-step implementation plan for building the Fanvue AI Chatbot platform.

---

## Phase 1: Foundation (Weeks 1-4)

### Week 1: Project Setup & OAuth

**Goal**: Establish development environment and Fanvue authentication

Tasks:
1. [ ] Create Next.js + Express project structure
2. [ ] Set up PostgreSQL database (local + production)
3. [ ] Set up Redis for job queue
4. [ ] Register OAuth application with Fanvue
5. [ ] Implement OAuth flow in backend
   - Generate authorization URL
   - Exchange code for token
   - Refresh token mechanism
   - Secure token storage (encrypted in DB)

Files to create:
- `backend/src/api/auth/oauth.ts` - OAuth endpoints
- `backend/src/config/database.ts` - DB connection
- `backend/src/config/redis.ts` - Redis setup

### Week 2: Database Schema & Models

**Goal**: Build data layer

Tasks:
1. [ ] Run migrations to create tables (use `DATABASE_SCHEMA.sql`)
2. [ ] Create Typeorm/Prisma models
3. [ ] Build repository/service classes for:
   - Creators (CRUD, settings)
   - Fans (CRM operations)
   - Messages (storage, retrieval)
   - Team members (for agencies)
4. [ ] Create indexes for performance

Files to create:
- `backend/src/models/*.ts` - ORM models
- `backend/migrations/*.ts` - DB migrations

### Week 3: Fanvue API Integration

**Goal**: Connect to Fanvue API

Tasks:
1. [ ] Implement `FanvueAPI` client class
   - All API endpoints
   - Webhook signature verification
   - Error handling & retries
   - Rate limit handling
2. [ ] Create webhook receiver endpoint
3. [ ] Test OAuth token refresh
4. [ ] Manually test API endpoints with cURL

Files already created:
- `backend_template_fanvue_api.ts` - Reference implementation

### Week 4: Claude AI Integration

**Goal**: Message generation engine

Tasks:
1. [ ] Implement `ClaudeAIGenerator` class
   - Personalized message generation
   - Confidence scoring
   - Message variation generation
   - Welcome/re-engagement/upsell templates
2. [ ] Create prompt templates for different scenarios
3. [ ] Test with real creator data
4. [ ] Implement caching for tokens used/cost tracking

Files already created:
- `backend_template_claude_ai.ts` - Reference implementation

---

## Phase 2: MVP Backend (Weeks 5-8)

### Week 5: Webhook Processing

**Goal**: Handle Fanvue events

Tasks:
1. [ ] Implement webhook handlers for:
   - `message.received`
   - `subscriber.created`
   - `tip.received`
   - `purchase.completed`
2. [ ] Set up Bull job queue for async processing
3. [ ] Create message generation jobs
4. [ ] Add error handling & retry logic
5. [ ] Test webhooks locally with ngrok

Files to create:
- `backend/src/api/webhooks/*.ts` - Webhook handlers
- `backend/src/services/message-queue.ts` - Job queue setup

Reference:
- `backend_template_webhook_handler.ts` - Implementation example

### Week 6: API Endpoints

**Goal**: Creator + Message management APIs

Tasks:
1. [ ] Build creator endpoints:
   - GET `/api/creators/me` - Current creator profile
   - PUT `/api/creators/me` - Update settings
   - GET `/api/creators/me/oauth-status` - OAuth token status
2. [ ] Build fan endpoints:
   - GET `/api/fans` - List fans with filtering
   - GET `/api/fans/:id` - Fan details
   - PUT `/api/fans/:id` - Update fan preferences
3. [ ] Build message endpoints:
   - GET `/api/messages` - Message history/queue
   - GET `/api/messages/:id` - Message details
   - POST `/api/messages/:id/approve` - Approve & send
   - POST `/api/messages/:id/reject` - Reject draft
4. [ ] Add authentication middleware
5. [ ] Add rate limiting

Files to create:
- `backend/src/api/creators/routes.ts`
- `backend/src/api/fans/routes.ts`
- `backend/src/api/messages/routes.ts`
- `backend/src/api/auth/middleware.ts`

### Week 7: Analytics & Metrics

**Goal**: Track performance

Tasks:
1. [ ] Create analytics event system
2. [ ] Track:
   - Messages sent/approved
   - Response rates
   - Revenue impact
   - AI confidence scores
   - Token usage/costs
3. [ ] Build analytics repository
4. [ ] Create basic stats endpoints

Files to create:
- `backend/src/services/analytics.ts`
- `backend/src/api/analytics/routes.ts`

### Week 8: Testing & Polish

**Goal**: Bug fixes, performance optimization

Tasks:
1. [ ] Write integration tests for API endpoints
2. [ ] Test webhook payload handling
3. [ ] Load test message generation
4. [ ] Optimize database queries
5. [ ] Error handling edge cases

---

## Phase 3: Frontend MVP (Weeks 9-12)

### Week 9: Authentication & Dashboard Layout

**Goal**: Creator login and base UI

Tasks:
1. [ ] Implement OAuth callback page
2. [ ] Build main dashboard layout:
   - Sidebar navigation
   - Top header with user menu
   - Main content area
3. [ ] Create basic pages:
   - `/dashboard` - Home/stats
   - `/messages` - Message queue
   - `/fans` - Fan list
   - `/settings` - Creator settings

Files to create:
- `frontend/app/(auth)/callback/page.tsx`
- `frontend/app/(dashboard)/layout.tsx`
- `frontend/components/dashboard/sidebar.tsx`
- `frontend/components/dashboard/header.tsx`

### Week 10: Message Queue & Approval

**Goal**: Core workflow for message drafts

Tasks:
1. [ ] Build message queue page:
   - List pending AI-generated messages
   - Show draft + creator name
   - Preview + edit functionality
   - Approve/Reject buttons
2. [ ] Message editor component:
   - Text editing
   - Save draft
   - Character count
3. [ ] Message preview:
   - Show how it looks to fan
   - Show confidence score

Files to create:
- `frontend/app/(dashboard)/messages/page.tsx`
- `frontend/app/(dashboard)/messages/[id]/page.tsx`
- `frontend/components/messages/message-queue.tsx`
- `frontend/components/messages/message-editor.tsx`

### Week 11: Fan CRM

**Goal**: View and manage fans

Tasks:
1. [ ] Fan list page:
   - Table of all fans
   - Filter by tier, engagement, churn risk
   - Sort by lifetime value, last interaction
   - Search by name
2. [ ] Fan detail page:
   - Profile info
   - Chat history with them
   - Stats (total spent, response rate)
   - Actions (send message, add note)
3. [ ] Fan segments:
   - VIP subscribers
   - Inactive (churn risk)
   - High value
   - New

Files to create:
- `frontend/app/(dashboard)/fans/page.tsx`
- `frontend/app/(dashboard)/fans/[id]/page.tsx`
- `frontend/components/fans/fan-list.tsx`
- `frontend/components/fans/fan-filters.tsx`

### Week 12: Analytics & Settings

**Goal**: Insights and configuration

Tasks:
1. [ ] Analytics dashboard:
   - Total fans, revenue, messages sent
   - Messages approved rate
   - Top responding fans
   - Revenue trends (chart)
2. [ ] Creator settings:
   - Profile info
   - Message tone preference
   - Auto-approval threshold
   - Enable/disable auto-response, auto-welcome
   - Team members (agencies)

Files to create:
- `frontend/app/(dashboard)/analytics/page.tsx`
- `frontend/app/(dashboard)/settings/page.tsx`
- `frontend/components/dashboard/stats.tsx`

---

## Phase 4: Advanced Features (Weeks 13-16)

### Week 13: Creator Voice Training

**Goal**: Learn creator's tone/style

Tasks:
1. [ ] Upload past messages feature
2. [ ] Extract tone/style embeddings
3. [ ] Fine-tune prompts based on style
4. [ ] Show style preview

### Week 14: Smart Automation Rules

**Goal**: Set up auto-response workflows

Tasks:
1. [ ] Rule builder UI
2. [ ] Triggers:
   - New subscriber
   - Inactive for X days
   - Made purchase
   - Sent tip > $X
3. [ ] Actions:
   - Generate message
   - Auto-approve if confidence > X
   - Wait for approval

### Week 15: Multi-Platform Support

**Goal**: Add OnlyFans, Fansly

Tasks:
1. [ ] Add platform selector
2. [ ] OnlyFans API integration
3. [ ] Fansly API integration
4. [ ] Unified message queue

### Week 16: Agency Features

**Goal**: Multi-creator management

Tasks:
1. [ ] Invite team members
2. [ ] Per-creator/per-team-member dashboards
3. [ ] Performance tracking by employee
4. [ ] Revenue reporting by creator

---

## Implementation Tips

### Development Environment Setup

```bash
# Backend
npm install express typescript dotenv axios bull redis pg
npm install -D @types/node ts-node nodemon

# Frontend
npx create-next-app@latest --typescript
npm install @tanstack/react-query @tanstack/react-table
npm install shadcn-ui

# Database
npm install typeorm pg
```

### Key Integration Points

```
Fanvue Webhook
    ↓
[Webhook Handler] → Verify Signature
    ↓
[Queue Job] → Generate AI Message
    ↓
[Claude API] → Create Draft
    ↓
[Database] → Store Message
    ↓
[Frontend] → Show for Approval
    ↓
[Manual Approval] → Send via Fanvue API
```

### Environment Variables

```
# .env.backend
ANTHROPIC_API_KEY=sk-...
FANVUE_CLIENT_ID=...
FANVUE_CLIENT_SECRET=...
FANVUE_WEBHOOK_SECRET=...
FANVUE_CALLBACK_URL=http://localhost:3000/auth/callback

DATABASE_URL=postgresql://user:pass@localhost:5432/chatbot
REDIS_URL=redis://localhost:6379

NODE_ENV=development
```

### Testing Webhooks Locally

```bash
# Use ngrok to expose local server
ngrok http 3001

# Set webhook URL in Fanvue dashboard to:
https://your-ngrok-id.ngrok.io/webhooks/fanvue

# Test webhook with curl
curl -X POST http://localhost:3001/webhooks/fanvue \
  -H "Content-Type: application/json" \
  -H "X-Fanvue-Signature: $(echo -n '{}' | openssl dgst -sha256 -hex -mac HMAC -macopt key:$(echo $WEBHOOK_SECRET))" \
  -d '{"event_type":"message.received",...}'
```

---

## Success Metrics

**MVP Launch (Week 12)**
- [ ] 1 creator can login and approve AI-generated messages
- [ ] Messages are sent successfully via Fanvue API
- [ ] Auto-welcome works for new subscribers
- [ ] Basic analytics dashboard shows stats

**Growth Phase (Week 16+)**
- [ ] 10+ creators on platform
- [ ] 90% message auto-approval rate
- [ ] $X monthly recurring revenue
- [ ] Multi-platform support (OnlyFans + Fansly)

---

## Next Immediate Actions

1. **Set up development environment** (today)
2. **Register Fanvue OAuth app** (tomorrow)
3. **Create database schema** (tomorrow)
4. **Implement OAuth flow** (next 2 days)
5. **Build Fanvue API client** (next 3 days)
6. **Create webhook receiver** (next 2 days)

**Target MVP Demo**: 3 weeks from now

