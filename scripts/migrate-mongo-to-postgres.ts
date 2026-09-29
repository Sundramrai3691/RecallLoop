import fs from "node:fs/promises";
import path from "node:path";
import { query, postgres } from "../server/src/db/postgres.js";

const sourceDirectory = process.env.LEGACY_EXPORT_DIR;
if (!sourceDirectory) throw new Error("Set LEGACY_EXPORT_DIR to a directory containing JSON exports; no source data was invented.");

async function readCollection(name: string): Promise<any[]> {
  const filename = path.join(sourceDirectory!, `${name}.json`);
  try { return JSON.parse(await fs.readFile(filename, "utf8")); } catch (error) { throw new Error(`Cannot read required legacy export ${filename}: ${error instanceof Error ? error.message : String(error)}`); }
}

async function mapped(collection: string, sourceId: string) {
  const result = await query<{ target_id: string }>(`SELECT target_id FROM legacy_id_map WHERE source_collection=$1 AND source_id=$2`, [collection, sourceId]);
  return result.rows[0]?.target_id ?? null;
}
async function remember(collection: string, sourceId: string, table: string, targetId: string) {
  await query(`INSERT INTO legacy_id_map (source_collection,source_id,target_table,target_id) VALUES ($1,$2,$3,$4) ON CONFLICT (source_collection,source_id) DO NOTHING`, [collection,sourceId,table,targetId]);
}
async function insertMapped(collection: string, sourceId: string, table: string, insert: () => Promise<string>) {
  const existing = await mapped(collection, sourceId); if (existing) return existing;
  const targetId = await insert(); await remember(collection, sourceId, table, targetId); return targetId;
}

try {
  const [users, goals, skills, sessions, concepts, recalls, reviews, events] = await Promise.all([
    readCollection("users"), readCollection("goals"), readCollection("skills"), readCollection("studysessions"), readCollection("concepts"), readCollection("recallattempts"), readCollection("reviewstates"), readCollection("learningevents"),
  ]);
  {
    for (const row of users) await insertMapped("users", String(row._id ?? row.id), "app_users", async () => (await query<{ id: string }>(`INSERT INTO app_users (email,password_hash,name) VALUES ($1,$2,$3) RETURNING id`, [row.email,row.passwordHash,row.name])).rows[0].id);
    for (const row of goals) { const userId = await mapped("users", String(row.userId)); if (!userId) throw new Error(`Orphan goal ${row._id}: user ${row.userId} is missing`); await insertMapped("goals", String(row._id ?? row.id), "goals", async () => (await query<{ id: string }>(`INSERT INTO goals (user_id,title,description,goal_type,target_date,weekly_time_budget_minutes,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [userId,row.title,row.description ?? "",row.goalType ?? "learning",row.targetDate ?? null,row.weeklyTimeBudgetMinutes ?? 240,row.status ?? "active"])).rows[0].id); }
    for (const row of skills) { const userId = await mapped("users", String(row.userId)); const goalId = await mapped("goals", String(row.goalId)); if (!userId || !goalId) throw new Error(`Orphan skill ${row._id}: user or goal mapping is missing`); await insertMapped("skills", String(row._id ?? row.id), "learner_skills", async () => (await query<{ id: string }>(`INSERT INTO learner_skills (user_id,goal_id,name,description,priority,target_mastery,current_mastery) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [userId,goalId,row.name,row.description ?? "",row.priority ?? 50,row.targetMastery ?? 0.8,row.currentMastery ?? 0.3])).rows[0].id); }
    for (const row of sessions) { const userId = await mapped("users", String(row.userId)); if (!userId) throw new Error(`Orphan study session ${row._id}: user mapping is missing`); await insertMapped("studysessions", String(row._id ?? row.id), "study_sessions", async () => (await query<{ id: string }>(`INSERT INTO study_sessions (user_id,title,raw_material,source_type,started_at,completed_at,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [userId,row.title,row.rawMaterial ?? "",row.sourceType ?? "manual",row.startedAt ?? new Date(),row.completedAt ?? null,row.status ?? "in_progress"])).rows[0].id); }
    for (const row of concepts) { const userId = await mapped("users", String(row.userId)); const sessionId = await mapped("studysessions", String(row.studySessionId)); if (!userId || !sessionId) throw new Error(`Orphan concept ${row._id}: user or study session mapping is missing`); await insertMapped("concepts", String(row._id ?? row.id), "personal_concepts", async () => (await query<{ id: string }>(`INSERT INTO personal_concepts (user_id,study_session_id,name,description,required_knowledge_points,difficulty,mastery) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [userId,sessionId,row.name,row.description ?? "",row.requiredKnowledgePoints ?? [],row.difficulty ?? 3,row.mastery ?? 0])).rows[0].id); }
    for (const row of recalls) { const userId = await mapped("users", String(row.userId)); const conceptId = await mapped("concepts", String(row.conceptId)); const sessionId = await mapped("studysessions", String(row.studySessionId)); if (!userId || !conceptId || !sessionId) throw new Error(`Orphan recall ${row._id}: dependent mapping is missing`); const targetId = await insertMapped("recallattempts", String(row._id ?? row.id), "recall_attempts", async () => (await query<{ id: string }>(`INSERT INTO recall_attempts (user_id,concept_id,study_session_id,question_type,question,answer,confidence,submitted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [userId,conceptId,sessionId,row.questionType ?? "explain",row.question,row.answer ?? null,row.confidence ?? null,row.submittedAt ?? null])).rows[0].id); if (row.evaluation) { const evaluation = row.evaluation; const evaluationId = (await query<{ id: string }>(`INSERT INTO recall_evaluations (recall_attempt_id,overall_coverage,missing_concepts,mistakes,strengths,feedback,suggested_recall_type,evaluator_version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (recall_attempt_id) DO UPDATE SET overall_coverage=EXCLUDED.overall_coverage RETURNING id`, [targetId,evaluation.overallCoverage,evaluation.missingConcepts ?? [],evaluation.mistakes ?? [],evaluation.strengths ?? [],evaluation.feedback,evaluation.suggestedRecallType ?? "explain",evaluation.evaluatorVersion ?? "legacy"])).rows[0].id; for (const point of evaluation.knowledgePointResults ?? []) await query(`INSERT INTO recall_knowledge_point_results (evaluation_id,point,status,evidence,feedback) VALUES ($1,$2,$3,$4,$5)`, [evaluationId,point.point,point.status,point.evidence ?? "",point.feedback ?? ""]); } }
    for (const row of reviews) { const userId = await mapped("users", String(row.userId)); const conceptId = await mapped("concepts", String(row.conceptId)); if (!userId || !conceptId) throw new Error(`Orphan review ${row._id}: dependent mapping is missing`); await insertMapped("reviewstates", String(row._id ?? row.id), "review_states", async () => (await query<{ id: string }>(`INSERT INTO review_states (user_id,concept_id,state,due_at,interval_days,stability,difficulty,last_recall_at,last_outcome,consecutive_successes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (user_id,concept_id) DO UPDATE SET due_at=EXCLUDED.due_at RETURNING id`, [userId,conceptId,row.state,row.dueAt,row.intervalDays ?? 0,row.stability ?? 0,row.difficulty ?? 0.5,row.lastRecallAt ?? null,row.lastOutcome ?? null,row.consecutiveSuccesses ?? 0])).rows[0].id); }
    for (const row of events) { const userId = await mapped("users", String(row.userId)); if (!userId) throw new Error(`Orphan learning event ${row._id}: user mapping is missing`); await query(`INSERT INTO learning_events (user_id,type,entity_type,payload,created_at) VALUES ($1,$2,$3,$4,$5)`, [userId,row.type,row.entityType ?? null,JSON.stringify(row.payload ?? {}),row.createdAt ?? new Date()]); }
  }
  console.log(JSON.stringify({ users: users.length, goals: goals.length, skills: skills.length, sessions: sessions.length, concepts: concepts.length, recalls: recalls.length, reviews: reviews.length, events: events.length }));
} finally { await postgres.end(); }
