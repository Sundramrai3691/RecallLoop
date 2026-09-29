import { query } from "../../db/postgres.js";

export async function recordLearningEvent(input: { userId: string; type: string; entityType?: string; entityId?: string; payload?: Record<string, unknown> }) {
  const result = await query(`INSERT INTO learning_events (user_id,type,entity_type,entity_id,payload) VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at`, [input.userId,input.type,input.entityType ?? null,input.entityId ?? null,JSON.stringify(input.payload ?? {})]);
  return result.rows[0];
}
