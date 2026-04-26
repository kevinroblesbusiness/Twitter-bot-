# 🚀 REAL Deployment Checklist - VERIFY EVERY STEP

**This is NOT theoretical. These are actual tests that must pass.**

---

## PHASE 1: Code Verification (Do This First)

### 1.1 Backend Compiles
```bash
cd backend
npm install
npm run build
```
✓ **MUST** see `dist/` folder created with `.js` files
✓ **MUST NOT** see any TypeScript errors

**If fails**: Check `tsconfig.json`, run `npm install` again

### 1.2 Frontend Builds
```bash
cd frontend
npm install
npm run build
```
✓ **MUST** see `.next/` folder created
✓ **MUST NOT** see build errors

**If fails**: Clear node_modules, run `npm install` again

### 1.3 Database Schema is Valid SQL
```bash
cd ..
psql -f DATABASE_SCHEMA.sql
```
✓ **MUST NOT** see SQL syntax errors

**If fails**: Check `DATABASE_SCHEMA.sql` for syntax issues

---

## PHASE 2: Local Environment Setup

### 2.1 Install Docker
```bash
docker --version
```
✓ **MUST** return Docker version

### 2.2 Create .env File
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with:
```
FANVUE_CLIENT_ID=test_client_id
FANVUE_CLIENT_SECRET=test_client_secret
FANVUE_REDIRECT_URI=http://localhost:3001/api/auth/callback
FANVUE_WEBHOOK_SECRET=test_webhook_secret
ANTHROPIC_API_KEY=sk-test-key
DATABASE_URL=postgresql://fanvue:password@postgres:5432/fanvue_chatbot
REDIS_URL=redis://redis:6379
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

✓ **MUST** have all keys set (even if fake for testing)

---

## PHASE 3: Docker Deployment

### 3.1 Start All Services
```bash
docker-compose up
```

**WATCH FOR THESE LOGS** (in order):
```
postgres_1   | ready to accept connections
redis_1      | Ready to accept connections
backend_1    | 📦 Initializing database...
backend_1    | ✅ Database connected
backend_1    | 🔴 Initializing Redis...
backend_1    | ✅ Redis connected
backend_1    | ⚙️ Starting message processing worker...
backend_1    | ✅ Server running on http://localhost:3001
frontend_1   | ready - started server on 0.0.0.0:3000
```

✓ **MUST** see all these messages
✗ **MUST NOT** see error or connection failed messages

**If any fail**: 
- Check port conflicts: `lsof -i :3001` (stop other processes)
- Check env vars: `docker-compose config`
- Check logs: `docker-compose logs backend`

### 3.2 Verify Services Are Running
```bash
# In another terminal
curl http://localhost:3001/health
```

✓ **MUST** return `{"status":"ok","timestamp":"..."}`

---

## PHASE 4: API Endpoint Testing

### 4.1 Test Database Connection
```bash
curl http://localhost:3001/health
```
✓ **Response**: `{"status":"ok"}`

### 4.2 Test OAuth Setup
```bash
curl http://localhost:3001/api/auth/login
```
✓ **MUST** redirect (HTTP 302)
✓ **Response headers** should have `Location: https://app.fanvue.com/oauth/authorize?...`

### 4.3 Test Frontend Loads
```bash
curl http://localhost:3000
```
✓ **MUST** return HTML (not error)

---

## PHASE 5: Real Fanvue Integration Testing

### 5.1 Register OAuth App
1. Go to https://api.fanvue.com/docs/welcome
2. Create OAuth application
3. Set callback: `http://localhost:3001/api/auth/callback`
4. Copy credentials

### 5.2 Update .env
Edit `backend/.env`:
```
FANVUE_CLIENT_ID=your_real_id
FANVUE_CLIENT_SECRET=your_real_secret
FANVUE_WEBHOOK_SECRET=your_real_webhook_secret
```

### 5.3 Restart Backend
```bash
docker-compose restart backend
```

### 5.4 Test OAuth Flow
```
1. Go to http://localhost:3000
2. Click "Login with Fanvue"
3. Authorize the app
4. Should redirect back with creator_id in URL
```

✓ **MUST** redirect back to http://localhost:3000?creator_id=...
✗ **MUST NOT** see error page

---

## PHASE 6: Message Processing Pipeline

### 6.1 Add Test Content to Vault
In Fanvue:
1. Upload a test video or photo
2. **TAG IT**: `["lingerie", "video"]` (or any tags)
3. Set price: `$10`

### 6.2 Send Test Message via Webhook
```bash
curl -X POST http://localhost:3001/webhooks/fanvue \
  -H "Content-Type: application/json" \
  -H "X-Fanvue-Signature: test" \
  -d '{
    "event_type": "message.received",
    "data": {
      "creator": {"id": "your_fanvue_id"},
      "subscriber": {"id": "test_fan", "display_name": "Test Fan"},
      "message": "Do you have lingerie content?",
      "chat_id": "test_chat_123"
    }
  }'
```

### 6.3 Check Backend Logs
```bash
docker-compose logs backend
```

✓ **MUST** see:
```
📬 Webhook received: message.received
   Tags detected: lingerie, video
   Found X matching content items
   Best match: your_video.mp4
   Generating personalized message...
   Message generated (confidence: 0.XX)
```

✗ **MUST NOT** see error messages

### 6.4 Check Message Queue
```bash
curl "http://localhost:3001/api/messages/pending?creator_id=YOUR_CREATOR_ID"
```

✓ **MUST** return JSON array with pending messages
✓ **Response** should include generated message text

---

## PHASE 7: Dashboard Testing

### 7.1 Access Dashboard
```
http://localhost:3000
```

✓ **Login page** should load

### 7.2 Test Message Approval
```
1. Click "Login with Fanvue"
2. Authorize
3. Should see message approval queue
4. Should see pending message with AI text
5. Click "Approve & Send"
```

✓ **MUST** send to Fanvue (check backend logs)
✗ **MUST NOT** see JavaScript errors

### 7.3 Test Fan CRM
```
1. Go to /fans
2. Should load
3. Should show fan list
```

---

## PHASE 8: Production Readiness Checklist

Before shipping to production:

- [ ] All environment variables set correctly
- [ ] Database backups configured
- [ ] Redis persistence enabled
- [ ] HTTPS enabled (SSL certificate)
- [ ] Rate limiting configured
- [ ] Error logging set up (Sentry, DataDog, etc.)
- [ ] Monitoring configured
- [ ] Webhook URL set in Fanvue dashboard
- [ ] Auto-approval threshold configured
- [ ] Creator content tagged properly

---

## TROUBLESHOOTING

### Backend won't start
```bash
docker-compose logs backend
```
**Common issues**:
- Database not ready: Wait 10 seconds, restart backend
- Port 3001 in use: Change PORT in .env or kill process
- Redis not ready: Wait 5 seconds, restart backend

### Webhook signature fails
```
❌ Invalid webhook signature
```
**Fix**: Make sure `FANVUE_WEBHOOK_SECRET` matches in Fanvue dashboard

### Database schema fails
```
⚠️ Schema file not found
```
**Fix**: Copy `DATABASE_SCHEMA.sql` to correct location or run migrations manually

### Frontend won't load
```bash
docker-compose logs frontend
```
**Common issues**:
- Port 3000 in use: Change port or kill process
- Build failed: Clear `frontend/.next`, rebuild

### Messages don't generate
```bash
docker-compose logs backend | grep "Generating"
```
**Common issues**:
- `ANTHROPIC_API_KEY` not set or invalid
- No content in vault with matching tags
- Fan not created yet (wait for webhook to create)

---

## Quick Health Check (Run Anytime)

```bash
# All services running?
docker-compose ps

# Backend healthy?
curl http://localhost:3001/health

# Database connected?
docker-compose exec postgres psql -U fanvue -d fanvue_chatbot -c "SELECT 1"

# Redis connected?
docker-compose exec redis redis-cli ping

# Frontend loaded?
curl http://localhost:3000 | grep -q "<html" && echo "✅ Frontend OK"
```

---

## FINAL VERIFICATION

When everything works, you should see:

1. ✅ OAuth login works
2. ✅ Messages received via webhook
3. ✅ Content searched by tags
4. ✅ Messages generated by Claude
5. ✅ Messages approved in dashboard
6. ✅ Messages sent via Fanvue
7. ✅ Fan profiles updated
8. ✅ No errors in logs

**If ALL of these work, you're ready to ship.**

---

**DO NOT skip these steps. Each one catches a real bug.**
