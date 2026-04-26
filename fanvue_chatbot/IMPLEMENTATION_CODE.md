# Implementation Code - The Actual Logic

**Level**: Developer - Copy-paste ready
**Goal**: Show EXACTLY what code to write for each step

---

## Database Queries You'll Write

### 1. Store Fan Profile

```python
# When fan interacts, save/update their profile
def update_fan_profile(creator_id, fan_data, interaction):
    """
    Every time a fan does something, update their profile
    """
    fan_id = fan_data['fanvue_fan_id']
    
    # Check if fan exists
    existing_fan = db.query(Fan).filter(
        Fan.creator_id == creator_id,
        Fan.fanvue_fan_id == fan_id
    ).first()
    
    if not existing_fan:
        # Create new fan
        fan = Fan(
            creator_id=creator_id,
            fanvue_fan_id=fan_id,
            display_name=fan_data.get('display_name'),
            fanvue_username=fan_data.get('username'),
            subscription_tier='free'
        )
        db.add(fan)
    else:
        fan = existing_fan
    
    # Update interaction history
    if interaction:
        fan.interaction_history = fan.interaction_history or []
        fan.interaction_history.append({
            'date': datetime.now().isoformat(),
            'type': interaction['type'],  # 'message', 'purchase', 'view'
            'content': interaction.get('text'),
            'tags_expressed': interaction.get('tags', []),
            'amount': interaction.get('amount'),
            'sentiment': interaction.get('sentiment')
        })
    
    # Update engagement metrics
    fan.last_interaction_at = datetime.now()
    fan.message_count += 1
    
    db.commit()
    return fan
```

### 2. Extract Tags from Fan Message

```python
from anthropic import Anthropic

def extract_intent_from_message(fan_message):
    """
    Use Claude to understand what fan asked for
    """
    client = Anthropic()
    
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        system="""You are a content recommendation analyzer.
        Your job is to extract what type of content the fan is asking for.
        
        Return JSON with:
        {
            "requested_tags": ["tag1", "tag2"],
            "content_type": "video" | "photo" | "audio" | "any",
            "sentiment": "positive" | "neutral" | "negative",
            "urgency": "high" | "normal" | "low",
            "price_sensitivity": "low" | "medium" | "high"
        }
        
        For example:
        Fan says: "Do you have lingerie content?"
        Response: {
            "requested_tags": ["lingerie"],
            "content_type": "any",
            "sentiment": "positive",
            "urgency": "normal",
            "price_sensitivity": "medium"
        }""",
        messages=[
            {
                "role": "user",
                "content": f"Fan message: \"{fan_message}\"\n\nExtract the intent as JSON."
            }
        ]
    )
    
    import json
    try:
        result = json.loads(response.content[0].text)
        return result
    except:
        # Fallback if Claude returns invalid JSON
        return {
            "requested_tags": [],
            "content_type": "any",
            "sentiment": "positive",
            "urgency": "normal",
            "price_sensitivity": "medium"
        }
```

### 3. Search Content Vault by Tags

```python
def search_content_by_tags(creator_id, requested_tags, limit=5):
    """
    Find content matching fan's request by tags
    """
    # Query database for content with matching tags
    matching_content = db.query(ContentVault).filter(
        ContentVault.creator_id == creator_id,
        # Check if any of the requested tags are in the content's tags
        ContentVault.tags.overlap(requested_tags)
    ).all()
    
    # Add match scores
    scored_content = []
    for content in matching_content:
        # Calculate how many tags match
        matching_tags = set(content.tags) & set(requested_tags)
        match_score = len(matching_tags) / max(len(requested_tags), 1)
        
        scored_content.append({
            'content': content,
            'match_score': match_score,
            'matching_tags': list(matching_tags)
        })
    
    # Sort by match score
    scored_content.sort(key=lambda x: x['match_score'], reverse=True)
    
    return scored_content[:limit]
```

### 4. Rank Content by Fan Preferences

```python
def rank_content_for_fan(fan, candidate_content):
    """
    Rank which content is BEST for THIS specific fan
    """
    ranked = []
    
    for item in candidate_content:
        content = item['content']
        
        # Score 1: How relevant is the request match?
        request_relevance = item['match_score']  # 0.0-1.0
        
        # Score 2: How much does this match fan's past preferences?
        fan_preference_match = 0.0
        if fan.preference_tags:
            fan_tags_set = set(fan.preference_tags)
            content_tags_set = set(content.tags)
            matching_fan_prefs = fan_tags_set & content_tags_set
            fan_preference_match = len(matching_fan_prefs) / max(len(fan_tags_set), 1)
        
        # Score 3: Is the price in fan's range?
        price_match = 0.0
        if fan.preferred_price_range_min and fan.preferred_price_range_max:
            if (fan.preferred_price_range_min <= content.price <= 
                fan.preferred_price_range_max):
                price_match = 1.0
            elif content.price < fan.preferred_price_range_min:
                price_match = 0.8  # OK, cheaper than usual
            else:
                price_match = 0.4  # More expensive, might not convert
        else:
            price_match = 0.5  # Unknown preference
        
        # Score 4: Is content popular?
        total_purchases_possible = 100  # Estimate
        popularity = min(content.purchase_count / total_purchases_possible, 1.0)
        
        # Score 5: Is it recent?
        days_old = (datetime.now() - content.upload_date).days
        recency = max(1.0 - (days_old / 30), 0.0)  # Older = lower score
        
        # WEIGHTED FINAL SCORE
        final_score = (
            request_relevance * 0.35 +      # 35% - Does it match their request?
            fan_preference_match * 0.30 +   # 30% - Matches their history?
            price_match * 0.20 +            # 20% - Right price?
            popularity * 0.10 +             # 10% - Is it popular?
            recency * 0.05                  # 5% - Is it new?
        )
        
        ranked.append({
            'content': content,
            'final_score': final_score,
            'breakdown': {
                'request_relevance': request_relevance,
                'fan_preference_match': fan_preference_match,
                'price_match': price_match,
                'popularity': popularity,
                'recency': recency
            }
        })
    
    # Sort by final score
    ranked.sort(key=lambda x: x['final_score'], reverse=True)
    return ranked
```

### 5. Predict Conversion Likelihood

```python
def predict_conversion_probability(fan, content):
    """
    What's the chance this fan will buy this content?
    """
    
    probability = 0.5  # Base 50%
    
    # Factor 1: Price reasonableness
    if fan.average_ppv_price > 0:
        price_ratio = content.price / fan.average_ppv_price
        if 0.7 <= price_ratio <= 1.3:
            probability += 0.15  # Within typical range
        elif price_ratio < 0.7:
            probability += 0.20  # Cheaper than usual (higher conversion)
        else:
            probability -= 0.10  # More expensive (lower conversion)
    
    # Factor 2: Fan engagement level
    probability += (fan.engagement_score / 10) * 0.15  # Up to +0.15
    
    # Factor 3: Recency of last purchase
    if fan.last_purchase_date:
        days_since = (datetime.now() - fan.last_purchase_date).days
        if days_since < 7:
            probability += 0.10  # Recently bought (hot fan)
        elif days_since < 14:
            probability += 0.05
        elif days_since > 90:
            probability -= 0.05  # Long time since purchase
    
    # Factor 4: Spending trend
    if fan.purchase_count >= 10:
        probability += 0.10  # Established buyer
    
    # Factor 5: Churn risk
    probability -= fan.churn_risk * 0.20  # High churn = lower conversion
    
    # Cap between 0.0 and 1.0
    return max(0.0, min(1.0, probability))
```

### 6. Generate Personalized Message with Claude

```python
def generate_personalized_message(creator, fan, recommended_content, original_request):
    """
    Generate message that sounds like the creator, references the fan,
    and recommends the specific content with price
    """
    from anthropic import Anthropic
    
    client = Anthropic()
    
    # Build system prompt from creator profile
    system_prompt = f"""You are {creator.name}, a content creator on Fanvue.

YOUR PERSONALITY:
- Tone: {creator.settings.message_tone}
{f'- Common phrases: {", ".join(creator.ai_profile.get("common_phrases", []))}' if creator.ai_profile.get("common_phrases") else ''}
{f'- Style: {", ".join(creator.ai_profile.get("style_keywords", []))}' if creator.ai_profile.get("style_keywords") else ''}

ABOUT THIS FAN:
- Name: {fan.display_name}
- They've been with you since: {fan.subscription_status.get('subscribed_since', 'recently')}
- Total spent: ${fan.spending_history.get('total_lifetime', 0)}
- Purchase count: {fan.spending_history.get('purchase_count', 0)}
- What they like: {', '.join(fan.preference_tags) if fan.preference_tags else 'discovering new content'}

YOUR TASK:
1. Acknowledge their request: "{original_request}"
2. Sound natural and personal (NOT like a bot)
3. Mention the specific content you're recommending
4. Include the price (${recommended_content.price})
5. Make them feel recognized/special
6. Create a tiny bit of urgency (new, limited, etc.)

IMPORTANT:
- Keep it under 150 words
- Use their name naturally (not every sentence)
- Be authentic - they can tell if you're being fake
- Don't mention multiple products (just this one)
- Don't be pushy or salesy"""
    
    user_prompt = f"""Fan {fan.display_name} just asked: "{original_request}"

Here's the content I think they'll love:
- Title: {recommended_content.filename}
- Price: ${recommended_content.price}
- Duration: {f'{recommended_content.duration_seconds // 60} min' if recommended_content.duration_seconds else 'photo set'}
- Why they'll love it: {', '.join(recommended_content.tags[:3])}

Write a personal response that feels natural and doesn't sound like it was written by a bot."""
    
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    )
    
    message_text = response.content[0].text
    
    return {
        'text': message_text,
        'tokens_used': response.usage.output_tokens,
        'confidence': 0.85  # Base confidence for Claude-generated
    }
```

### 7. Save Draft Message

```python
def save_message_draft(creator_id, fan_id, draft_text, content_id, confidence_score):
    """
    Save the AI-generated message draft to database
    """
    message = Message(
        creator_id=creator_id,
        fan_id=fan_id,
        source_type='ai_generated',
        status='pending',  # Waiting for approval
        
        draft={
            'generated_text': draft_text,
            'ai_confidence': confidence_score,
            'generated_by': 'claude',
            'generation_timestamp': datetime.now().isoformat()
        },
        
        metadata={
            'recommended_content_id': str(content_id),
            'context': 'personalized_recommendation'
        }
    )
    
    db.add(message)
    db.commit()
    
    return message
```

### 8. Auto-Approve or Queue for Review

```python
def decide_approval_action(message, creator_settings):
    """
    Should we auto-send or ask creator for approval?
    """
    confidence_score = message.draft.get('ai_confidence', 0.5)
    auto_approve_threshold = creator_settings.get('auto_approve_threshold', 0.8)
    
    if confidence_score >= auto_approve_threshold:
        # AUTO-SEND
        return {
            'action': 'auto_send',
            'reason': f'Confidence {confidence_score:.2f} >= threshold {auto_approve_threshold}'
        }
    else:
        # QUEUE FOR APPROVAL
        return {
            'action': 'queue_approval',
            'reason': f'Confidence {confidence_score:.2f} < threshold {auto_approve_threshold}',
            'priority': 'high' if confidence_score >= 0.7 else 'normal'
        }
```

### 9. Send via Fanvue API

```python
def send_message_via_fanvue(creator_id, fan_id, message_text, content_id, content_price):
    """
    Actually send the message through Fanvue API with PPV link
    """
    from services.fanvue_api import FanvueAPI
    
    # Get creator's Fanvue tokens
    creator = db.query(Creator).get(creator_id)
    fanvue_api = FanvueAPI(
        access_token=creator.oauth_access_token,
        refresh_token=creator.oauth_refresh_token
    )
    
    # Get fan's chat ID
    fan = db.query(Fan).get(fan_id)
    chat_id = fan.fanvue_chat_id
    
    # Send message with PPV
    response = fanvue_api.send_message(
        chat_id=chat_id,
        message_text=message_text,
        ppv_content_id=content_id,
        ppv_price=content_price
    )
    
    # Update message status
    message = db.query(Message).filter(
        Message.creator_id == creator_id,
        Message.fan_id == fan_id
    ).order_by(Message.created_at.desc()).first()
    
    message.status = 'sent'
    message.final_text = message_text
    message.sent_at = datetime.now()
    message.metadata['fanvue_message_id'] = response.get('message_id')
    message.metadata['ppv_link'] = response.get('ppv_link')
    
    db.commit()
    
    return response
```

### 10. Track Outcome (Buy or Not)

```python
def process_purchase_webhook(webhook_data):
    """
    Fan bought the PPV - update profile and analytics
    """
    fan_id = webhook_data['fan_id']
    content_id = webhook_data['content_id']
    amount = webhook_data['amount']
    
    # Load fan
    fan = db.query(Fan).get(fan_id)
    
    # Update spending
    fan.spending_history['ppv_spent'] += amount
    fan.spending_history['total_lifetime'] += amount
    fan.spending_history['purchases_count'] += 1
    fan.spending_history['last_purchase_date'] = datetime.now()
    
    # Calculate new average
    fan.spending_history['average_ppv_price'] = (
        fan.spending_history['ppv_spent'] / 
        fan.spending_history['purchases_count']
    )
    
    # Extract tags from purchased content
    content = db.query(ContentVault).get(content_id)
    for tag in content.tags:
        if tag not in fan.preference_tags:
            fan.preference_tags.append(tag)
    
    # Add to interaction history
    fan.interaction_history.append({
        'date': datetime.now().isoformat(),
        'type': 'ppv_purchase',
        'content_id': str(content_id),
        'tags': content.tags,
        'amount': amount
    })
    
    # Log analytics
    analytics = AnalyticsEvent(
        creator_id=fan.creator_id,
        fan_id=fan_id,
        event_type='ppv_purchase',
        revenue_impact=amount,
        metadata={
            'content_id': str(content_id),
            'tags': content.tags
        }
    )
    db.add(analytics)
    db.commit()
    
    # Recalculate churn risk (lower after purchase)
    fan.churn_risk = max(0, fan.churn_risk - 0.1)
    db.commit()
```

---

## Complete End-to-End Function

```python
async def handle_fan_message(webhook_data):
    """
    Complete workflow: message in → recommendation → send
    """
    
    # Extract data
    creator_id = webhook_data['creator_id']
    fan_data = webhook_data['fan_data']
    message_text = webhook_data['message_text']
    
    # 1. Update fan profile
    fan = update_fan_profile(creator_id, fan_data, {
        'type': 'message',
        'text': message_text
    })
    
    # 2. Extract intent
    intent = extract_intent_from_message(message_text)
    
    # 3. Search content
    candidates = search_content_by_tags(
        creator_id, 
        intent['requested_tags'],
        limit=5
    )
    
    if not candidates:
        # Fallback: send newest content
        candidates = search_content_newest(creator_id, limit=5)
    
    # 4. Rank for this fan
    ranked = rank_content_for_fan(fan, candidates)
    
    # 5. Get top result
    best_match = ranked[0]['content'] if ranked else None
    
    if not best_match:
        # No content available
        return {
            'status': 'no_content',
            'message': 'No matching content found'
        }
    
    # 6. Predict conversion
    conversion_prob = predict_conversion_probability(fan, best_match)
    
    # 7. Generate message
    message_draft = generate_personalized_message(
        creator=db.query(Creator).get(creator_id),
        fan=fan,
        recommended_content=best_match,
        original_request=message_text
    )
    
    # 8. Save draft
    saved_message = save_message_draft(
        creator_id=creator_id,
        fan_id=fan.id,
        draft_text=message_draft['text'],
        content_id=best_match.id,
        confidence_score=message_draft.get('confidence', 0.85)
    )
    
    # 9. Decide approval
    approval = decide_approval_action(saved_message, 
        db.query(Creator).get(creator_id).settings)
    
    if approval['action'] == 'auto_send':
        # 10. Send automatically
        response = send_message_via_fanvue(
            creator_id=creator_id,
            fan_id=fan.id,
            message_text=message_draft['text'],
            content_id=best_match.id,
            content_price=best_match.price
        )
        
        return {
            'status': 'sent',
            'message_id': response['message_id'],
            'auto_approved': True,
            'conversion_probability': conversion_prob
        }
    else:
        # Creator will review before sending
        return {
            'status': 'awaiting_approval',
            'message_id': saved_message.id,
            'priority': approval['priority'],
            'reason': approval['reason'],
            'conversion_probability': conversion_prob
        }
```

---

## SQL Queries for Dashboard

### Get Fan's Purchase History

```sql
SELECT 
    m.created_at,
    cv.filename,
    cv.price,
    cv.tags,
    f.display_name
FROM messages m
JOIN content_vault cv ON m.metadata->>'recommended_content_id' = cv.content_id::text
JOIN fans f ON m.fan_id = f.id
WHERE m.creator_id = $1
    AND m.status = 'sent'
    AND m.fan_response IS NOT NULL
ORDER BY m.created_at DESC;
```

### Get Top Performing Content

```sql
SELECT 
    cv.content_id,
    cv.filename,
    cv.price,
    COUNT(m.id) as recommendation_count,
    COUNT(CASE WHEN m.fan_response IS NOT NULL THEN 1 END) as conversion_count,
    ROUND(
        100.0 * COUNT(CASE WHEN m.fan_response IS NOT NULL THEN 1 END) / 
        NULLIF(COUNT(m.id), 0),
        2
    ) as conversion_rate,
    SUM(CAST(m.metadata->>'ppv_revenue' AS DECIMAL)) as total_revenue
FROM content_vault cv
LEFT JOIN messages m ON cv.content_id::text = m.metadata->>'recommended_content_id'
WHERE cv.creator_id = $1
GROUP BY cv.content_id, cv.filename, cv.price
ORDER BY conversion_count DESC;
```

### Identify High-Value Fans

```sql
SELECT 
    f.id,
    f.display_name,
    SUM(CAST(ae.revenue_impact AS DECIMAL)) as lifetime_value,
    COUNT(DISTINCT m.id) as interaction_count,
    MAX(m.sent_at) as last_interaction,
    AVG(CAST(m.metadata->>'ppv_revenue' AS DECIMAL)) as average_purchase,
    ROUND(
        100.0 * COUNT(CASE WHEN ae.event_type = 'ppv_purchase' THEN 1 END) /
        NULLIF(COUNT(DISTINCT m.id), 0),
        2
    ) as conversion_rate
FROM fans f
LEFT JOIN messages m ON f.id = m.fan_id
LEFT JOIN analytics_events ae ON f.id = ae.fan_id
WHERE f.creator_id = $1
GROUP BY f.id, f.display_name
HAVING SUM(CAST(ae.revenue_impact AS DECIMAL)) > 50
ORDER BY lifetime_value DESC;
```

---

This is the real code. This is what runs the system. Everything else is just organization around these core functions.

