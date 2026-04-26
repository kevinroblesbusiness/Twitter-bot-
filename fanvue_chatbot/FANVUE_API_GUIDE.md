# Fanvue API Integration Guide

## Overview

This guide explains how to integrate with the Fanvue API for the AI Chatbot platform.

---

## Authentication Flow

### 1. OAuth 2.0 Setup

**Step 1: Register Your App**
- Go to: https://api.fanvue.com/developers/applications
- Create new OAuth application
- Get `client_id` and `client_secret`

**Step 2: Authorization URL**
```
https://app.fanvue.com/oauth/authorize?
  client_id={YOUR_CLIENT_ID}
  &redirect_uri={YOUR_CALLBACK_URL}
  &response_type=code
  &scope=chats:read chats:write users:read subscriptions:read tips:read content:read
```

**Step 3: Exchange Code for Token**
```bash
curl -X POST https://api.fanvue.com/v1/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "{AUTH_CODE}",
    "client_id": "{CLIENT_ID}",
    "client_secret": "{CLIENT_SECRET}",
    "redirect_uri": "{CALLBACK_URL}"
  }'
```

Response:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

---

## API Endpoints

### Messages API

**Get Unread Messages**
```bash
GET /v1/users/self/chats?filter=unread
Authorization: Bearer {ACCESS_TOKEN}
X-Fanvue-API-Version: 2025-06-26
```

Response:
```json
{
  "data": [
    {
      "id": "msg_123",
      "chat_id": "chat_456",
      "creator": {},
      "subscriber": {
        "id": "sub_789",
        "username": "fan_username",
        "display_name": "Fan Name"
      },
      "message": "Hey, what's new?",
      "created_at": "2025-04-26T12:00:00Z",
      "is_unread": true
    }
  ]
}
```

**Send a Message**
```bash
POST /v1/chats/{CHAT_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
X-Fanvue-API-Version: 2025-06-26
Content-Type: application/json

{
  "message": "Thanks for the tip! Here's some exclusive content...",
  "attachments": [] // optional
}
```

**List All Fans/Subscribers**
```bash
GET /v1/users/self/subscriptions
Authorization: Bearer {ACCESS_TOKEN}
X-Fanvue-API-Version: 2025-06-26
```

Response:
```json
{
  "data": [
    {
      "id": "sub_123",
      "subscriber": {
        "id": "user_456",
        "username": "fan_username",
        "display_name": "Fan Name",
        "profile_image": "..."
      },
      "tier": "standard", // or "vip"
      "subscribed_at": "2025-01-15T10:00:00Z",
      "expires_at": "2025-05-15T10:00:00Z",
      "amount": 9.99,
      "currency": "USD"
    }
  ]
}
```

---

## Webhooks

### Setting Up Webhooks

1. Go to your application settings in Fanvue Developer Dashboard
2. Add webhook URL: `https://yourapp.com/webhooks/fanvue`
3. Select events you want to receive

### Events Available

#### 1. message.received
Triggered when a creator receives a message from a fan.

```json
{
  "event_type": "message.received",
  "event_id": "evt_123456",
  "created_at": "2025-04-26T12:00:00Z",
  "data": {
    "message_id": "msg_789",
    "chat_id": "chat_456",
    "creator": {
      "id": "user_123",
      "username": "creator_username"
    },
    "subscriber": {
      "id": "sub_456",
      "username": "fan_username",
      "display_name": "Fan Name"
    },
    "message": "Hey! Do you have any photos of...?",
    "created_at": "2025-04-26T12:00:00Z"
  }
}
```

#### 2. subscriber.created
Triggered when a new subscriber joins.

```json
{
  "event_type": "subscriber.created",
  "event_id": "evt_234567",
  "created_at": "2025-04-26T12:00:00Z",
  "data": {
    "subscription_id": "sub_123",
    "creator": {
      "id": "user_123",
      "username": "creator_username"
    },
    "subscriber": {
      "id": "sub_456",
      "username": "fan_username",
      "display_name": "Fan Name"
    },
    "tier": "standard",
    "amount": 9.99,
    "currency": "USD"
  }
}
```

#### 3. tip.received
Triggered when a fan sends a tip.

```json
{
  "event_type": "tip.received",
  "event_id": "evt_345678",
  "created_at": "2025-04-26T12:00:00Z",
  "data": {
    "tip_id": "tip_123",
    "creator": {
      "id": "user_123",
      "username": "creator_username"
    },
    "subscriber": {
      "id": "sub_456",
      "username": "fan_username"
    },
    "amount": 10.00,
    "currency": "USD",
    "message": "Keep up the great work!"
  }
}
```

#### 4. purchase.completed
Triggered when a fan buys PPV content.

```json
{
  "event_type": "purchase.completed",
  "event_id": "evt_456789",
  "created_at": "2025-04-26T12:00:00Z",
  "data": {
    "purchase_id": "purchase_123",
    "creator": {
      "id": "user_123",
      "username": "creator_username"
    },
    "subscriber": {
      "id": "sub_456",
      "username": "fan_username"
    },
    "content_id": "content_789",
    "amount": 19.99,
    "currency": "USD"
  }
}
```

### Webhook Signature Verification

Every webhook includes an `X-Fanvue-Signature` header. Verify it:

```python
import hmac
import hashlib
import json

def verify_webhook(request_body: str, signature: str, webhook_secret: str) -> bool:
    """Verify Fanvue webhook signature"""
    expected = hmac.new(
        webhook_secret.encode(),
        request_body.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

# In your webhook handler:
@app.post("/webhooks/fanvue")
async def handle_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Fanvue-Signature")
    
    if not verify_webhook(body, signature, WEBHOOK_SECRET):
        return {"error": "Invalid signature"}, 401
    
    data = json.loads(body)
    event_type = data["event_type"]
    
    # Handle event
    if event_type == "message.received":
        # Queue AI message generation
        pass
    elif event_type == "subscriber.created":
        # Create fan profile, queue welcome message
        pass
    
    return {"success": True}
```

---

## Rate Limits

- **General API**: 100 requests/minute per access token
- **Webhook Delivery**: Retries with exponential backoff (5, 30, 300 seconds)
- **Message Sending**: 50 messages/minute

---

## Implementation Checklist

- [ ] Register OAuth application
- [ ] Implement OAuth flow in backend
- [ ] Store and refresh OAuth tokens securely
- [ ] Set up webhook receiver endpoint
- [ ] Verify webhook signatures
- [ ] Implement message.received webhook handler
- [ ] Implement subscriber.created webhook handler
- [ ] Build message sending endpoint
- [ ] Build fan listing endpoint
- [ ] Implement error handling & retries
- [ ] Add rate limit handling
- [ ] Test with Fanvue sandbox (if available)

---

## Error Handling

Common HTTP status codes:

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Continue |
| 401 | Unauthorized | Refresh token |
| 403 | Forbidden | Check scopes |
| 429 | Rate limited | Back off & retry |
| 500 | Server error | Retry with exponential backoff |

---

## Testing

### Using cURL

```bash
# Get access token (after OAuth flow)
TOKEN="..."

# List unread messages
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Fanvue-API-Version: 2025-06-26" \
     https://api.fanvue.com/v1/users/self/chats?filter=unread

# Send a message
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "X-Fanvue-API-Version: 2025-06-26" \
     -H "Content-Type: application/json" \
     -d '{"message":"Hello!"}' \
     https://api.fanvue.com/v1/chats/chat_123/messages

# List fans
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Fanvue-API-Version: 2025-06-26" \
     https://api.fanvue.com/v1/users/self/subscriptions
```

---

## Resources

- [Fanvue API Docs](https://api.fanvue.com/docs/welcome)
- [OAuth Guide](https://api.fanvue.com/docs/authentication/quick-start)
- [Webhooks Overview](https://api.fanvue.com/docs/webhooks/webhooks/webhooks-overview)
- [Example Chatbots](https://api.fanvue.com/docs/tutorials/example-chatbots)

