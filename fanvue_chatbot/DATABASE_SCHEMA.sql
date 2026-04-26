-- ============================================================================
-- Fanvue AI Chatbot Platform - Database Schema
-- PostgreSQL
-- ============================================================================

-- ============================================================================
-- CREATORS TABLE
-- ============================================================================

CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Fanvue Integration
  fanvue_id VARCHAR(255) UNIQUE NOT NULL,
  fanvue_username VARCHAR(255) NOT NULL,

  -- Creator Info
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  profile_image_url TEXT,
  bio TEXT,

  -- OAuth Token Storage (encrypted in production)
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_expires_at TIMESTAMP,

  -- Creator Settings
  settings JSONB DEFAULT '{
    "message_tone": "friendly",
    "auto_approve_threshold": 0.8,
    "daily_message_limit": 100,
    "enable_smart_ppv": true,
    "enable_auto_welcome": true,
    "enable_sentiment_analysis": true
  }'::JSONB,

  -- AI Training Data
  ai_profile JSONB DEFAULT '{
    "voice_samples": [],
    "tone_keywords": [],
    "common_phrases": [],
    "style_embeddings": []
  }'::JSONB,

  -- Stats
  total_fans INTEGER DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0.00,
  messages_generated INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_synced_at TIMESTAMP,

  -- Status
  is_active BOOLEAN DEFAULT true,
  stripe_customer_id VARCHAR(255)
);

CREATE INDEX idx_creators_fanvue_id ON creators(fanvue_id);
CREATE INDEX idx_creators_email ON creators(email);

-- ============================================================================
-- FAN PROFILES TABLE (CRM)
-- ============================================================================

CREATE TABLE fan_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,

  -- Fanvue Data
  fanvue_fan_id VARCHAR(255) NOT NULL,
  fanvue_username VARCHAR(255),

  -- Fan Info
  display_name VARCHAR(255),
  profile_image_url TEXT,

  -- Subscription Status
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free', -- free, subscriber, vip
  subscription_started_at TIMESTAMP,
  subscription_expires_at TIMESTAMP,
  is_active_subscriber BOOLEAN DEFAULT false,

  -- Engagement Metrics
  lifetime_value DECIMAL(10, 2) DEFAULT 0.00,
  total_tips DECIMAL(10, 2) DEFAULT 0.00,
  total_purchases DECIMAL(10, 2) DEFAULT 0.00,
  message_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,

  -- Fan Preferences (learned)
  preferences JSONB DEFAULT '{
    "interests": [],
    "message_frequency": "medium",
    "content_types": [],
    "preferred_time": null
  }'::JSONB,

  -- Sentiment & Analysis
  sentiment_score DECIMAL(3, 2), -- -1 to 1
  engagement_level VARCHAR(50), -- high, medium, low
  churn_risk DECIMAL(3, 2), -- 0-1 probability

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_interaction_at TIMESTAMP,
  last_message_received_at TIMESTAMP,

  UNIQUE(creator_id, fanvue_fan_id)
);

CREATE INDEX idx_fan_profiles_creator_id ON fan_profiles(creator_id);
CREATE INDEX idx_fan_profiles_fanvue_id ON fan_profiles(fanvue_fan_id);
CREATE INDEX idx_fan_profiles_churn_risk ON fan_profiles(churn_risk);
CREATE INDEX idx_fan_profiles_engagement ON fan_profiles(engagement_level);

-- ============================================================================
-- FAN DETAILS TABLE (20-Field Personal Profile)
-- ============================================================================

CREATE TABLE fan_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL UNIQUE REFERENCES fan_profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,

  -- Basic (4 fields)
  name VARCHAR(255),
  age INTEGER,
  birthday DATE,
  location VARCHAR(255),

  -- Life Details (4 fields)
  job_title VARCHAR(255),
  company VARCHAR(255),
  education VARCHAR(255),
  hobbies TEXT[] DEFAULT '{}', -- top 3 hobbies

  -- Relationship (3 fields)
  relationship_status VARCHAR(50), -- single, in_relationship, complicated, etc
  partner_name VARCHAR(255),
  kids JSONB DEFAULT '[]', -- [{name: "...", age: ...}]

  -- Personal (6 fields)
  pets JSONB DEFAULT '[]', -- [{name: "Toby", type: "dog"}]
  favorite_things TEXT[] DEFAULT '{}', -- music, food, movies, etc
  goals TEXT[] DEFAULT '{}', -- career, fitness, personal goals
  fears TEXT[] DEFAULT '{}', -- things they've mentioned

  -- Engagement (3 fields)
  first_message_date TIMESTAMP,
  last_active TIMESTAMP,
  emotional_triggers TEXT[] DEFAULT '{}', -- what gets them engaged

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fan_details_fan_id ON fan_details(fan_id);
CREATE INDEX idx_fan_details_creator_id ON fan_details(creator_id);

-- ============================================================================
-- FAN REQUESTS TABLE (Track Custom Content Requests)
-- ============================================================================

CREATE TABLE fan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES fan_profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,

  -- Request Details
  date_requested TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  request_text TEXT NOT NULL,
  request_type VARCHAR(50), -- 'video', 'photo', 'custom', 'bathrobe', etc

  -- Status Tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, fulfilled, cancelled
  content_id UUID REFERENCES messages(id) ON DELETE SET NULL, -- linked content

  -- Creator Notes
  creator_note TEXT,

  -- Fulfillment
  fulfilled_date TIMESTAMP,
  fulfillment_url TEXT, -- link to fulfilled content

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fan_requests_fan_id ON fan_requests(fan_id);
CREATE INDEX idx_fan_requests_creator_id ON fan_requests(creator_id);
CREATE INDEX idx_fan_requests_status ON fan_requests(status);
CREATE INDEX idx_fan_requests_fulfilled_date ON fan_requests(fulfilled_date);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES fan_profiles(id) ON DELETE CASCADE,

  -- Source
  source_type VARCHAR(50) NOT NULL, -- 'human_drafted', 'ai_generated'
  source_event_id VARCHAR(255), -- webhook event ID

  -- AI Generation Data
  draft JSONB DEFAULT '{
    "generated_text": null,
    "ai_confidence": 0,
    "generated_by": "claude",
    "generation_tokens": 0,
    "prompt_tokens": 0
  }'::JSONB,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, sent, failed

  -- Approval Workflow
  approved_at TIMESTAMP,
  approved_by_user_id UUID, -- which team member approved
  approval_notes TEXT,

  -- Final Message (what was actually sent)
  final_text TEXT,
  sent_at TIMESTAMP,

  -- Response Tracking
  fan_response TEXT,
  fan_response_received_at TIMESTAMP,
  response_sentiment VARCHAR(50), -- positive, neutral, negative

  -- Metadata
  metadata JSONB DEFAULT '{
    "context_used": [],
    "generation_ms": 0,
    "ai_cost": 0,
    "fanvue_message_id": null
  }'::JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_creator_id ON messages(creator_id);
CREATE INDEX idx_messages_fan_id ON messages(fan_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES fan_profiles(id) ON DELETE CASCADE,

  -- Fanvue data
  fanvue_conversation_id VARCHAR(255) UNIQUE,

  -- Conversation state
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  -- AI Context
  conversation_context JSONB DEFAULT '{}',
  inferred_topics TEXT[],

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(creator_id, fan_id)
);

CREATE INDEX idx_conversations_creator_id ON conversations(creator_id);
CREATE INDEX idx_conversations_fan_id ON conversations(fan_id);

-- ============================================================================
-- TEMPLATES TABLE
-- ============================================================================

CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE, -- null = system templates

  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'welcome', 'upsell', 'question', 'follow_up'

  template_text TEXT NOT NULL,

  -- Performance
  usage_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  revenue_generated DECIMAL(10, 2) DEFAULT 0.00,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(creator_id, name)
);

CREATE INDEX idx_templates_creator_id ON message_templates(creator_id);
CREATE INDEX idx_templates_category ON message_templates(category);

-- ============================================================================
-- ANALYTICS_EVENTS TABLE
-- ============================================================================

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  fan_id UUID REFERENCES fans(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  -- Event type
  event_type VARCHAR(100) NOT NULL, -- 'message_sent', 'message_opened', 'purchase', 'tip', etc
  event_data JSONB DEFAULT '{}',

  revenue_impact DECIMAL(10, 2) DEFAULT 0.00,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_creator_id ON analytics_events(creator_id);
CREATE INDEX idx_analytics_fan_id ON analytics_events(fan_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);

-- ============================================================================
-- TEAM_MEMBERS TABLE (for agencies)
-- ============================================================================

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'admin', 'moderator', 'viewer'

  permissions JSONB DEFAULT '{
    "can_approve_messages": false,
    "can_manage_fans": false,
    "can_view_analytics": false,
    "can_manage_team": false
  }'::JSONB,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(creator_id, email)
);

CREATE INDEX idx_team_creator_id ON team_members(creator_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamp on creators
CREATE TRIGGER update_creators_timestamp
  BEFORE UPDATE ON creators
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Auto-update timestamp on fan_profiles
CREATE TRIGGER update_fan_profiles_timestamp
  BEFORE UPDATE ON fan_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Auto-update timestamp on fan_details
CREATE TRIGGER update_fan_details_timestamp
  BEFORE UPDATE ON fan_details
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Auto-update timestamp on fan_requests
CREATE TRIGGER update_fan_requests_timestamp
  BEFORE UPDATE ON fan_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Auto-update timestamp on messages
CREATE TRIGGER update_messages_timestamp
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Timestamp update function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Creator Stats View
CREATE VIEW creator_stats AS
SELECT
  c.id,
  c.name,
  COUNT(DISTINCT f.id) as total_fans,
  COUNT(DISTINCT CASE WHEN f.is_active_subscriber THEN 1 END) as active_subscribers,
  SUM(f.lifetime_value) as total_revenue,
  COUNT(DISTINCT m.id) as total_messages_sent,
  AVG(f.sentiment_score) as avg_fan_sentiment,
  MAX(m.sent_at) as last_message_sent
FROM creators c
LEFT JOIN fan_profiles f ON c.id = f.creator_id
LEFT JOIN messages m ON c.id = m.creator_id AND m.status = 'sent'
GROUP BY c.id, c.name;

-- Fan Engagement View
CREATE VIEW fan_engagement_metrics AS
SELECT
  f.id,
  f.creator_id,
  f.display_name,
  f.lifetime_value,
  COUNT(m.id) as messages_received,
  COUNT(CASE WHEN m.fan_response IS NOT NULL THEN 1 END) as messages_responded_to,
  MAX(m.sent_at) as last_message_received,
  AVG(EXTRACT(EPOCH FROM (m.fan_response_received_at - m.sent_at))) as avg_response_time_seconds
FROM fan_profiles f
LEFT JOIN messages m ON f.id = m.fan_id
GROUP BY f.id, f.creator_id, f.display_name, f.lifetime_value;
