import { getPool, queryOne, queryMany, execute } from './database.js';
import { v4 as uuidv4 } from 'uuid';

export interface FanDetail {
  id: string;
  fan_id: string;
  creator_id: string;
  name: string | null;
  age: number | null;
  birthday: string | null;
  location: string | null;
  job_title: string | null;
  company: string | null;
  education: string | null;
  hobbies: string[];
  relationship_status: string | null;
  partner_name: string | null;
  kids: Array<{ name: string; age?: number }>;
  pets: Array<{ name: string; type: string }>;
  favorite_things: string[];
  goals: string[];
  fears: string[];
  first_message_date: string | null;
  last_active: string | null;
  emotional_triggers: string[];
  created_at: string;
  updated_at: string;
}

export interface FanRequest {
  id: string;
  fan_id: string;
  creator_id: string;
  date_requested: string;
  request_text: string;
  request_type: string | null;
  status: string;
  content_id: string | null;
  creator_note: string | null;
  fulfilled_date: string | null;
  fulfillment_url: string | null;
  created_at: string;
  updated_at: string;
}

// Get or create fan details for a fan
export async function getFanDetails(fanId: string): Promise<FanDetail | null> {
  return await queryOne<FanDetail>(
    `SELECT * FROM fan_details WHERE fan_id = $1`,
    [fanId]
  );
}

// Create fan details if they don't exist
export async function getOrCreateFanDetails(fanId: string, creatorId: string): Promise<FanDetail> {
  let details = await getFanDetails(fanId);

  if (!details) {
    const detailId = uuidv4();
    await execute(
      `INSERT INTO fan_details (id, fan_id, creator_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [detailId, fanId, creatorId]
    );
    details = await queryOne<FanDetail>(
      `SELECT * FROM fan_details WHERE fan_id = $1`,
      [fanId]
    );
  }

  return details!;
}

// Update fan details
export async function updateFanDetails(
  fanId: string,
  updates: Partial<FanDetail>
): Promise<FanDetail | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  // Only update provided fields
  if (updates.name !== undefined) {
    fields.push(`name = $${paramCount}`);
    values.push(updates.name);
    paramCount++;
  }
  if (updates.age !== undefined) {
    fields.push(`age = $${paramCount}`);
    values.push(updates.age);
    paramCount++;
  }
  if (updates.birthday !== undefined) {
    fields.push(`birthday = $${paramCount}`);
    values.push(updates.birthday);
    paramCount++;
  }
  if (updates.location !== undefined) {
    fields.push(`location = $${paramCount}`);
    values.push(updates.location);
    paramCount++;
  }
  if (updates.job_title !== undefined) {
    fields.push(`job_title = $${paramCount}`);
    values.push(updates.job_title);
    paramCount++;
  }
  if (updates.company !== undefined) {
    fields.push(`company = $${paramCount}`);
    values.push(updates.company);
    paramCount++;
  }
  if (updates.education !== undefined) {
    fields.push(`education = $${paramCount}`);
    values.push(updates.education);
    paramCount++;
  }
  if (updates.hobbies !== undefined) {
    fields.push(`hobbies = $${paramCount}`);
    values.push(updates.hobbies);
    paramCount++;
  }
  if (updates.relationship_status !== undefined) {
    fields.push(`relationship_status = $${paramCount}`);
    values.push(updates.relationship_status);
    paramCount++;
  }
  if (updates.partner_name !== undefined) {
    fields.push(`partner_name = $${paramCount}`);
    values.push(updates.partner_name);
    paramCount++;
  }
  if (updates.kids !== undefined) {
    fields.push(`kids = $${paramCount}`);
    values.push(JSON.stringify(updates.kids));
    paramCount++;
  }
  if (updates.pets !== undefined) {
    fields.push(`pets = $${paramCount}`);
    values.push(JSON.stringify(updates.pets));
    paramCount++;
  }
  if (updates.favorite_things !== undefined) {
    fields.push(`favorite_things = $${paramCount}`);
    values.push(updates.favorite_things);
    paramCount++;
  }
  if (updates.goals !== undefined) {
    fields.push(`goals = $${paramCount}`);
    values.push(updates.goals);
    paramCount++;
  }
  if (updates.fears !== undefined) {
    fields.push(`fears = $${paramCount}`);
    values.push(updates.fears);
    paramCount++;
  }
  if (updates.emotional_triggers !== undefined) {
    fields.push(`emotional_triggers = $${paramCount}`);
    values.push(updates.emotional_triggers);
    paramCount++;
  }

  if (fields.length === 0) return getFanDetails(fanId);

  fields.push(`updated_at = NOW()`);
  values.push(fanId);

  const sql = `UPDATE fan_details SET ${fields.join(', ')} WHERE fan_id = $${paramCount} RETURNING *`;

  return await queryOne<FanDetail>(sql, values);
}

// Build fan context for Claude
export async function buildFanContext(fanId: string): Promise<string> {
  const details = await getFanDetails(fanId);
  if (!details) return '';

  const lines: string[] = [];

  // Basic info
  if (details.name) lines.push(`- Name: ${details.name}`);
  if (details.age) lines.push(`- Age: ${details.age}`);
  if (details.birthday) lines.push(`- Birthday: ${details.birthday}`);
  if (details.location) lines.push(`- Location: ${details.location}`);

  // Life details
  if (details.job_title) lines.push(`- Job: ${details.job_title}`);
  if (details.company) lines.push(`- Company: ${details.company}`);
  if (details.hobbies && details.hobbies.length > 0) {
    lines.push(`- Hobbies: ${details.hobbies.join(', ')}`);
  }

  // Relationship
  if (details.relationship_status) {
    lines.push(`- Relationship: ${details.relationship_status}`);
  }
  if (details.partner_name) lines.push(`- Partner: ${details.partner_name}`);
  if (details.kids && details.kids.length > 0) {
    const kidNames = details.kids.map(k => k.name).join(', ');
    lines.push(`- Kids: ${kidNames}`);
  }

  // Personal details
  if (details.pets && details.pets.length > 0) {
    const petDescriptions = details.pets
      .map(p => `${p.name} (${p.type})`)
      .join(', ');
    lines.push(`- Pets: ${petDescriptions}`);
  }
  if (details.favorite_things && details.favorite_things.length > 0) {
    lines.push(`- Likes: ${details.favorite_things.join(', ')}`);
  }
  if (details.goals && details.goals.length > 0) {
    lines.push(`- Goals: ${details.goals.join(', ')}`);
  }

  // Engagement
  if (details.emotional_triggers && details.emotional_triggers.length > 0) {
    lines.push(`- Gets engaged by: ${details.emotional_triggers.join(', ')}`);
  }

  return lines.length > 0 ? lines.join('\n') : '';
}

// Track a fan request
export async function createFanRequest(
  fanId: string,
  creatorId: string,
  requestText: string,
  requestType?: string
): Promise<FanRequest> {
  const requestId = uuidv4();

  await execute(
    `INSERT INTO fan_requests (id, fan_id, creator_id, request_text, request_type, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())`,
    [requestId, fanId, creatorId, requestText, requestType || null]
  );

  return await queryOne<FanRequest>(
    `SELECT * FROM fan_requests WHERE id = $1`,
    [requestId]
  ) as FanRequest;
}

// Get pending requests for a fan
export async function getFanRequests(
  fanId: string,
  status?: string
): Promise<FanRequest[]> {
  if (status) {
    return await queryMany<FanRequest>(
      `SELECT * FROM fan_requests WHERE fan_id = $1 AND status = $2 ORDER BY date_requested DESC`,
      [fanId, status]
    );
  }

  return await queryMany<FanRequest>(
    `SELECT * FROM fan_requests WHERE fan_id = $1 ORDER BY date_requested DESC`,
    [fanId]
  );
}

// Update request status
export async function updateRequestStatus(
  requestId: string,
  status: string,
  contentId?: string,
  fulfilledDate?: string
): Promise<FanRequest | null> {
  const params: any[] = [status, requestId];
  const fields = ['status = $1'];

  if (contentId) {
    fields.push(`content_id = $${params.length + 1}`);
    params.push(contentId);
  }

  if (fulfilledDate) {
    fields.push(`fulfilled_date = $${params.length + 1}`);
    params.push(fulfilledDate);
  }

  fields.push(`updated_at = NOW()`);

  const sql = `UPDATE fan_requests SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`;
  params.push(requestId);

  return await queryOne<FanRequest>(sql, params);
}

// Get recent requests from all fans
export async function getCreatorPendingRequests(creatorId: string): Promise<FanRequest[]> {
  return await queryMany<FanRequest>(
    `SELECT fr.*, fp.display_name as fan_name
     FROM fan_requests fr
     JOIN fan_profiles fp ON fr.fan_id = fp.id
     WHERE fr.creator_id = $1 AND fr.status != 'fulfilled'
     ORDER BY fr.date_requested DESC`,
    [creatorId]
  );
}
