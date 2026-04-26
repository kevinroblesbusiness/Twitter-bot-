# Fanvue AI Chatbot Platform - Project Structure

```
fanvue_chatbot/
├── backend/                          # Node.js/Express API
│   ├── src/
│   │   ├── api/
│   │   │   ├── auth/                # OAuth, JWT handling
│   │   │   │   ├── oauth.ts
│   │   │   │   └── middleware.ts
│   │   │   ├── webhooks/            # Fanvue webhook receivers
│   │   │   │   ├── message.ts
│   │   │   │   ├── subscription.ts
│   │   │   │   └── tip.ts
│   │   │   ├── creators/            # Creator management
│   │   │   │   ├── controller.ts
│   │   │   │   ├── service.ts
│   │   │   │   └── routes.ts
│   │   │   ├── fans/                # Fan CRM
│   │   │   │   ├── controller.ts
│   │   │   │   ├── service.ts
│   │   │   │   └── routes.ts
│   │   │   └── messages/            # Message generation & sending
│   │   │       ├── controller.ts
│   │   │       ├── service.ts
│   │   │       ├── routes.ts
│   │   │       └── generator.ts
│   │   ├── services/
│   │   │   ├── fanvue-api.ts        # Fanvue API client
│   │   │   ├── claude-ai.ts         # Claude integration
│   │   │   ├── message-queue.ts     # Redis job queue
│   │   │   └── analytics.ts         # Analytics & metrics
│   │   ├── models/
│   │   │   ├── creator.ts
│   │   │   ├── fan.ts
│   │   │   ├── message.ts
│   │   │   └── index.ts
│   │   ├── config/
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   └── env.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── errors.ts
│   │   │   └── validators.ts
│   │   └── index.ts
│   ├── migrations/                  # Database migrations
│   │   └── 001_initial_schema.sql
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                         # Next.js Dashboard
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── callback/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── messages/
│   │   │   │   ├── page.tsx          # Message queue
│   │   │   │   └── [id]/page.tsx     # Edit/approve
│   │   │   ├── fans/
│   │   │   │   ├── page.tsx          # Fan list/CRM
│   │   │   │   └── [id]/page.tsx     # Fan detail
│   │   │   ├── analytics/page.tsx    # Dashboard stats
│   │   │   ├── settings/page.tsx     # Creator settings
│   │   │   └── profile/page.tsx      # Creator profile
│   │   ├── api/                      # API routes
│   │   │   ├── auth/[...auth0].ts
│   │   │   └── trpc/[trpc].ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── dashboard/                # Dashboard-specific
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── stats.tsx
│   │   ├── messages/                 # Message-related
│   │   │   ├── message-queue.tsx
│   │   │   ├── message-editor.tsx
│   │   │   └── message-preview.tsx
│   │   └── fans/                     # Fan CRM
│   │       ├── fan-list.tsx
│   │       ├── fan-profile.tsx
│   │       └── fan-filters.tsx
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── auth.ts
│   │   └── utils.ts
│   ├── package.json
│   ├── next.config.js
│   └── tsconfig.json
│
├── shared/                           # Shared types & utilities
│   ├── types/
│   │   ├── api.ts
│   │   ├── models.ts
│   │   └── fanvue.ts
│   └── constants.ts
│
├── scripts/
│   ├── setup-db.ts                  # Database initialization
│   ├── seed-creators.ts             # Sample data
│   └── test-fanvue-api.ts           # API testing
│
├── docs/
│   ├── API.md                        # API documentation
│   ├── ARCHITECTURE.md               # System architecture
│   ├── DEPLOYMENT.md                 # Deployment guide
│   └── CONTRIBUTING.md               # Contribution guidelines
│
├── docker-compose.yml                # Local dev environment
├── README.md
└── .github/
    └── workflows/
        └── ci.yml                    # GitHub Actions CI/CD
```

## Key Implementation Notes

### Backend Modules

1. **Fanvue API Client** (`fanvue-api.ts`)
   - OAuth token management
   - API request builder with retry logic
   - Webhook signature verification

2. **Claude Integration** (`claude-ai.ts`)
   - Prompt templates for message generation
   - Creator context injection
   - Response generation and caching

3. **Message Queue** (`message-queue.ts`)
   - Async job processing with Bull
   - Retry logic for failed sends
   - Message draft approval workflow

### Frontend Pages

- `/dashboard` - Overview stats, recent activity
- `/messages` - Approve/edit AI-generated messages
- `/fans` - CRM view of all fans, search, filter
- `/analytics` - Revenue impact, message metrics
- `/settings` - Creator profile, AI settings, automation rules

### Database Schema

Key tables:
- `creators` - Creator accounts
- `fans` - Fan profiles with metadata
- `messages` - Message history with drafts
- `fanvue_oauth_tokens` - Stored OAuth tokens
- `analytics_events` - Track all interactions
- `creator_ai_profiles` - Voice/tone training data

