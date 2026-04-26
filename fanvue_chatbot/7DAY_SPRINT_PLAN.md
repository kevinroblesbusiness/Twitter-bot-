# 7-DAY SPRINT - Ship MVP with Real Fan Context

## The Real Problem We're Solving

Fan messages: "How's your dog Toby?"
Why it works: We TRACKED that he has a dog named Toby
How: 20 key data points per fan + Claude references them

---

## FAN PROFILE SCHEMA (20 Key Fields)

```
FAN_PROFILE:
├── Basic
│   ├── name
│   ├── age
│   ├── birthday
│   └── location
│
├── Life Details
│   ├── job_title
│   ├── company
│   ├── education
│   └── hobbies[3] // top 3
│
├── Relationship
│   ├── status (single/complicated/etc)
│   ├── partner_name (if mentioned)
│   └── kids[3] // names if mentioned
│
├── Personal
│   ├── pets[5] // {name, type} - dog Toby, cat Whiskers
│   ├── favorite_things[5] // music, food, movies
│   ├── goals[3] // career, fitness, etc
│   └── fears[2] // things they've mentioned
│
└── Engagement
    ├── first_message_date
    ├── last_active
    ├── content_requests[] // {date, what_they_asked, what_we_tagged}
    └── emotional_triggers[] // what gets them engaged
```

---

## Request/Promise Tracking

When fan asks: "Can you do a video in a bathrobe?"

```
FAN_REQUEST:
{
  fan_id: "steve_123",
  date_asked: "2025-04-26",
  request: "video in bathrobe",
  priority: "high",
  content_id: null, // waiting for us to create/tag
  status: "pending_creation",
  created_by: "creator_username",
  internal_note: "He likes slow, teasing content"
}
```

Then when we create/tag content:
```
Update:
{
  content_id: "ppv_456",
  status: "ready_to_send",
  fulfilled_date: "2025-04-27"
}
```

Next time Steve messages, Claude gets:
- "Steve asked for bathrobe video 1 day ago"
- "We have it ready as ppv_456"
- "Reference: 'Got that bathrobe video you wanted'"

---

## 7-DAY SPRINT BREAKDOWN

### DAY 1 (Monday): Foundation + Fan Schema
**Goal**: Database + tracking system working

Tasks (parallel):
1. [ ] Add 20-field fan profile table
2. [ ] Create fan_requests table
3. [ ] Create personal_details table (dog Toby, job, etc)
4. [ ] Create API to update fan details
5. [ ] Create API to track requests
6. [ ] Write database queries to GET fan context

**Deliverable**: Can save "Steve has dog Toby, age 28, job software engineer"

---

### DAY 2 (Tuesday): Claude Integration with Context
**Goal**: Claude gets 20-field fan context in every message

Tasks (parallel):
1. [ ] Modify Claude prompt to include 20 fields
2. [ ] Create "build_fan_context" function
3. [ ] Modify message generation to USE context
4. [ ] Test Claude mentions personal details

**Test**:
```
Fan: "Hi"
System loads: {name: Steve, pets: [{name: Toby, type: dog}], age: 28}
Claude generates: "Hey Steve! How's Toby doing?"
```

✓ If Claude references Toby = SUCCESS

---

### DAY 3 (Wednesday): Request Tracking System
**Goal**: Tag and track custom requests

Tasks (parallel):
1. [ ] Add "requests" section to fan detail page
2. [ ] Create "tag_custom_content" workflow
3. [ ] Build request history UI
4. [ ] Create fulfillment tracker

**Workflow**:
- Fan asks: "Bathrobe video?"
- Creator tags existing content OR creates new
- System marks "fulfilled"
- Claude knows about it next message

---

### DAY 4 (Thursday): Full Integration Test
**Goal**: End-to-end with real context

1. [ ] Create test fan "Steve" with 20 details
2. [ ] Send webhook messages
3. [ ] Verify Claude uses details
4. [ ] Test request tracking
5. [ ] Test message personalization

**Test Cases**:
- [ ] "How are you?" → Claude mentions dog
- [ ] "Got my bathrobe request?" → Claude remembers
- [ ] Multiple personalized details in one message

---

### DAY 5 (Friday): Dashboard for Creator
**Goal**: Easy interface to manage fan details + requests

1. [ ] Fan profile page with 20 fields editable
2. [ ] Request tracker (what fans asked for)
3. [ ] Request fulfillment workflow
4. [ ] Quick notes section

**Interface**:
```
FAN: Steve
Age: 28 | Birthday: 3/14 | Job: Software Engineer
Pets: 🐕 Toby (Golden Retriever)
Hobbies: Gaming, Fitness, Photography
Relationship: Single

PENDING REQUESTS:
- "Bathrobe video" (asked 1 day ago) [Create/Tag Content]
- "Custom dance" (asked 3 days ago) [Waiting for approval]

INTERNAL NOTES:
- Likes slow, teasing content
- Engages more with personal touches
```

---

### DAY 6 (Saturday): Quality + Edge Cases
**Goal**: No bugs, everything works

1. [ ] Handle missing data gracefully
2. [ ] Claude doesn't make up details
3. [ ] Request fulfillment works end-to-end
4. [ ] Mobile dashboard responsive
5. [ ] Test with real fan messages

**Edge Cases**:
- [ ] Fan has no pets → Claude doesn't mention
- [ ] Birthday today → Claude acknowledges
- [ ] Request fulfilled 2 weeks ago → Claude doesn't repeat
- [ ] Fan hasn't shared details → Generic messages

---

### DAY 7 (Sunday): Ship
1. [ ] Final testing
2. [ ] Deploy to production
3. [ ] Update webhook URL
4. [ ] Test with real Fanvue account

---

## WHAT MAKES US BETTER THAN SUBSTY

**Substy**: Generic AI messages with behavior learning
**Us**: Emotional connection through specific personal facts

Examples:

**Substy**: "Hey! Check out this new content 😉"
**Us**: "Hey Steve! Finished that bathrobe video you asked about + I know you like slow teasing content 👀"

**Substy**: AI learns preference over time
**Us**: You IMMEDIATELY tell system what fan wants, Claude references it next message

**Substy**: Generic recommendations
**Us**: "Remember you asked for dance content? Got something new 💃"

---

## Database Tables (DAY 1)

```sql
-- FAN PROFILE with 20 key fields
CREATE TABLE fan_details (
  fan_id UUID PRIMARY KEY,
  
  -- Basic (4)
  name VARCHAR(255),
  age INTEGER,
  birthday DATE,
  location VARCHAR(255),
  
  -- Life (4)
  job_title VARCHAR(255),
  company VARCHAR(255),
  education VARCHAR(255),
  hobbies TEXT[], -- ["gaming", "fitness", "photography"]
  
  -- Relationships (3)
  relationship_status VARCHAR(50),
  partner_name VARCHAR(255),
  kids JSONB, -- [{name, age}]
  
  -- Personal (6)
  pets JSONB, -- [{name: "Toby", type: "dog"}]
  favorite_things TEXT[],
  goals TEXT[],
  fears TEXT[],
  
  -- Engagement (3)
  first_message_date TIMESTAMP,
  last_active TIMESTAMP,
  emotional_triggers TEXT[] -- ["personal details", "slow content"]
);

-- Track what fans ask for
CREATE TABLE fan_requests (
  id UUID PRIMARY KEY,
  fan_id UUID REFERENCES fan_details(fan_id),
  date_requested TIMESTAMP,
  request_text TEXT,
  request_type VARCHAR(50), -- "video", "photo", "custom", "bathrobe"
  status VARCHAR(50), -- "pending", "in_progress", "fulfilled"
  content_id UUID, -- link to what we created/tagged
  creator_note TEXT,
  fulfilled_date TIMESTAMP
);
```

---

## Claude Prompt Update

```
SYSTEM PROMPT:

You are [Creator Name].

THIS FAN'S DETAILS (use if available):
- Name: {fan.name}
- Age: {fan.age}, Birthday: {fan.birthday}
- Job: {fan.job_title}
- Location: {fan.location}
- Pets: {fan.pets} // e.g. "Dog named Toby"
- Hobbies: {fan.hobbies} // e.g. ["gaming", "fitness"]
- Relationship: {fan.relationship_status}
- Goals: {fan.goals}

RECENT REQUESTS FROM THIS FAN:
{fan.requests} // e.g. "Asked for bathrobe video 2 days ago (fulfilled)"

ENGAGEMENT TIPS:
- This fan likes: {fan.emotional_triggers}
- Don't mention details they haven't shared
- Reference specific requests if fulfilled

Write a personal message that sounds like you, references 1-2 details they've shared, and feels authentic.
```

---

## How This Actually Works

**Day 1 - Fan first message**:
User: "Hi there 😊"
System: Creates fan profile, Claude generates welcome
Message: "Hey! Thanks for subscribing 💕"

**Day 2 - Fan shares details**:
Fan: "I'm Steve, 28, software engineer, have a dog named Toby"
Creator: Manually enters into system OR system auto-extracts
System: Updates fan_details table

**Day 3 - Fan requests something**:
Fan: "Do you have videos in lingerie?"
System: Creates fan_request
Creator: Tags existing content OR creates new
System: Links content to request, marks fulfilled

**Day 4 - Next fan message**:
Fan: "How's that lingerie video coming?"
Claude gets:
```
Name: Steve
Age: 28
Job: Software Engineer
Pets: Dog Toby
Request: "Lingerie videos" (fulfilled)
```
Claude generates: "Hey Steve! Got that lingerie video ready - I know you like slow teasing content 😉"

---

## Why This Beats Competition

| Feature | Substy | Us |
|---------|--------|-----|
| Learns preferences | Over weeks | Immediately (we tag) |
| Personal references | Generic behavior | Specific facts (Toby) |
| Request tracking | None | Full system |
| Creator control | No | Full control |
| Emotional connection | Algorithm | Real personal details |

---

## SHIP TIMELINE

- **Monday EOD**: Fan schema + tracking system (DATABASE WORKS)
- **Tuesday EOD**: Claude context integration (CLAUDE REFERENCES DETAILS)
- **Wednesday EOD**: Request system (TRACK WHAT FANS WANT)
- **Thursday EOD**: Full integration (END-TO-END WORKS)
- **Friday EOD**: Creator dashboard (EASY MANAGEMENT)
- **Saturday**: Quality + bugs (NOTHING BROKEN)
- **Sunday**: Deploy (LIVE)

---

## YOU NEED TO TELL ME

1. **Which 20 fields matter most?** (I included my guess)
2. **Should system auto-extract details?** (Or manual entry only?)
3. **How do fans request content?** (Comment in message? Separate form?)
4. **Auto-tagging or manual?** (Can system tag based on fan request?)
5. **What's your API limit?** (How many fan details per call?)

Answer these and I build it.

---

**This is what $10M developer does:**
- Understands emotional connection matters
- Builds tracking for 20 key details
- Makes Claude reference specific facts
- Tracks fan requests
- Gives creator control
- Ships in 7 days

Not hallucinating. Real system. Real advantage.

Ready?
