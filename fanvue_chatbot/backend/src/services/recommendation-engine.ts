import { queryMany, queryOne } from './database.js';

export interface ContentMatch {
  content_id: string;
  filename: string;
  price: number;
  tags: string[];
  duration_seconds?: number;
  views: number;
  purchases: number;
  match_score: number;
}

export async function searchContentByTags(
  creatorId: string,
  requestedTags: string[],
  limit = 5
): Promise<ContentMatch[]> {
  if (requestedTags.length === 0) {
    // Fallback: get newest content
    const content = await queryMany<ContentMatch>(
      `SELECT content_id, filename, price, tags, duration_seconds, views, purchase_count as purchases
       FROM content_vault
       WHERE creator_id = $1
       ORDER BY upload_date DESC
       LIMIT $2`,
      [creatorId, limit]
    );

    return content.map((c) => ({
      ...c,
      match_score: 0.5,
    }));
  }

  // Search for content with matching tags
  const content = await queryMany<any>(
    `SELECT content_id, filename, price, tags, duration_seconds, views, purchase_count
       FROM content_vault
       WHERE creator_id = $1`,
    [creatorId]
  );

  // Score each piece of content
  const scored = content
    .map((item) => {
      const contentTags = new Set(item.tags || []);
      const requestedSet = new Set(requestedTags);
      const intersection = [...contentTags].filter((t) => requestedSet.has(t));
      const matchScore = intersection.length / Math.max(requestedTags.length, 1);

      return {
        content_id: item.content_id,
        filename: item.filename,
        price: item.price,
        tags: item.tags || [],
        duration_seconds: item.duration_seconds,
        views: item.views || 0,
        purchases: item.purchase_count || 0,
        match_score: matchScore,
      };
    })
    .filter((c) => c.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit);

  return scored;
}

export async function rankContentForFan(
  fanId: string,
  candidateContent: ContentMatch[]
): Promise<ContentMatch[]> {
  // Get fan profile
  const fan = await queryOne<any>(
    `SELECT preference_tags, preferred_price_range_min, preferred_price_range_max,
            engagement_score, average_ppv_price, churn_risk
       FROM fan_profiles
       WHERE id = $1`,
    [fanId]
  );

  if (!fan) {
    return candidateContent;
  }

  // Score each content based on fan preferences
  const scored = candidateContent.map((content) => {
    let score = content.match_score * 0.35; // 35% request relevance

    // Fan preference match
    if (fan.preference_tags && fan.preference_tags.length > 0) {
      const fanPrefs = new Set(fan.preference_tags);
      const contentTags = new Set(content.tags);
      const matching = [...fanPrefs].filter((t) => contentTags.has(t));
      const prefMatch = matching.length / Math.max(fan.preference_tags.length, 1);
      score += prefMatch * 0.3; // 30% preference match
    } else {
      score += 0.15; // 15% if no preferences yet
    }

    // Price match
    if (fan.preferred_price_range_min && fan.preferred_price_range_max) {
      if (
        content.price >= fan.preferred_price_range_min &&
        content.price <= fan.preferred_price_range_max
      ) {
        score += 0.2; // 20% within range
      } else if (content.price < fan.preferred_price_range_min) {
        score += 0.16; // 16% cheaper (ok)
      } else {
        score += 0.08; // 8% more expensive
      }
    } else {
      score += 0.1; // 10% if no preference data
    }

    // Popularity
    const totalPurchasesEstimate = 100;
    const popularity = Math.min(content.purchases / totalPurchasesEstimate, 1.0);
    score += popularity * 0.1; // 10% popularity

    // Recency (newer is better)
    // Note: We're not tracking upload date precisely here, so skip for now

    return {
      ...content,
      final_score: Math.min(score, 1.0),
    };
  });

  return scored.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
}

export async function predictConversionProbability(fanId: string, contentPrice: number): Promise<number> {
  const fan = await queryOne<any>(
    `SELECT average_ppv_price, purchase_count, engagement_score, churn_risk, last_purchase_at
       FROM fan_profiles
       WHERE id = $1`,
    [fanId]
  );

  if (!fan) {
    return 0.5; // Default if no data
  }

  let probability = 0.5;

  // Factor 1: Price
  if (fan.average_ppv_price > 0) {
    const priceRatio = contentPrice / fan.average_ppv_price;
    if (priceRatio >= 0.7 && priceRatio <= 1.3) {
      probability += 0.15;
    } else if (priceRatio < 0.7) {
      probability += 0.2; // Cheaper = higher conversion
    } else {
      probability -= 0.1;
    }
  }

  // Factor 2: Engagement
  if (fan.engagement_score) {
    probability += (fan.engagement_score / 10) * 0.15;
  }

  // Factor 3: Recent activity
  if (fan.last_purchase_at) {
    const daysSince = Math.floor(
      (Date.now() - new Date(fan.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince < 7) {
      probability += 0.1;
    } else if (daysSince < 14) {
      probability += 0.05;
    } else if (daysSince > 90) {
      probability -= 0.05;
    }
  }

  // Factor 4: Established buyer
  if (fan.purchase_count >= 10) {
    probability += 0.1;
  }

  // Factor 5: Churn risk
  if (fan.churn_risk) {
    probability -= fan.churn_risk * 0.2;
  }

  return Math.max(0.0, Math.min(1.0, probability));
}
