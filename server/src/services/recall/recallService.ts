import { AppError, conflict, notFound } from "../../utils/errors.js";
import { getEvaluator } from "../evaluator/index.js";
import { getScheduler, type ReviewStateSnapshot } from "../scheduler/index.js";
import { getAttempt, getConcept, getReview, submitAttempt } from "../../repositories/legacyPostgresRepositories.js";
import { recordLearningEvent } from "../events/learningEventService.js";
import type { QuestionType } from "../../domain/recallTypes.js";

export async function getRecall(id: string, userId: string) {
  const attempt = await getAttempt(id, userId);
  if (!attempt) throw notFound("Recall attempt not found", "RECALL_NOT_FOUND");
  const concept = await getConcept(attempt.conceptId, userId);
  if (!concept) throw notFound("Concept missing for this recall", "MISSING_CONCEPT");
  return { attempt, concept };
}

export async function submitRecall(id: string, input: { answer: string; confidence: number; userId: string }) {
  const answer = input.answer?.trim();
  if (!answer) throw new AppError("Answer cannot be empty", 400, "EMPTY_ANSWER");
  const confidence = Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < 1 || confidence > 10) throw new AppError("Confidence must be a number from 1 to 10", 400, "VALIDATION_ERROR");
  const { attempt, concept } = await getRecall(id, input.userId);
  if (attempt.submittedAt) throw conflict("This recall has already been submitted", "ALREADY_SUBMITTED");
  const evaluator = getEvaluator();
  const evaluationBody = await evaluator.evaluate({ conceptName: concept.name, conceptDescription: concept.description, requiredKnowledgePoints: concept.requiredKnowledgePoints, answer, questionType: attempt.questionType as QuestionType });
  const evaluation = { ...evaluationBody, evaluatorVersion: evaluator.version };
  const previous = await getReview(input.userId, concept.id);
  const previousSnapshot: ReviewStateSnapshot | null = previous ? { conceptId: concept.id, state: previous.state, dueAt: previous.dueAt, intervalDays: previous.intervalDays, stability: previous.stability, difficulty: previous.difficulty, lastRecallAt: previous.lastRecallAt, lastOutcome: previous.lastOutcome, consecutiveSuccesses: previous.consecutiveSuccesses, updatedAt: previous.updatedAt } : null;
  const mastery = Number((Number(concept.mastery) * 0.4 + evaluation.overallCoverage * 0.6).toFixed(4));
  const scheduled = getScheduler().scheduleNextReview({ conceptId: concept.id, coverage: evaluation.overallCoverage, now: new Date(), previous: previousSnapshot, conceptDifficulty: concept.difficulty });
  const updated = await submitAttempt(input.userId, id, answer, confidence, evaluation, scheduled, concept.id, mastery);
  if (!updated) throw conflict("This recall has already been submitted", "ALREADY_SUBMITTED");
  await recordLearningEvent({ userId: input.userId, type: "RECALL_SUBMITTED", entityType: "RecallAttempt", entityId: id, payload: { confidence, overallCoverage: evaluation.overallCoverage } });
  await recordLearningEvent({ userId: input.userId, type: "EVALUATION_COMPLETED", entityType: "RecallAttempt", entityId: id, payload: { mistakes: evaluation.mistakes } });
  await recordLearningEvent({ userId: input.userId, type: "REVIEW_SCHEDULED", entityType: "ReviewState", entityId: concept.id, payload: { dueAt: scheduled.dueAt, outcome: scheduled.lastOutcome } });
  const refreshed = await getRecall(id, input.userId);
  return { attempt: refreshed.attempt, concept: refreshed.concept, review: await getReview(input.userId, concept.id) };
}

export async function listDueRecalls(userId: string) {
  const result = await (await import("../../db/postgres.js")).query<any>(`SELECT r.id FROM recall_attempts r JOIN review_states rs ON rs.user_id=r.user_id AND rs.concept_id=r.concept_id WHERE r.user_id=$1 AND r.submitted_at IS NULL AND rs.due_at <= now() ORDER BY rs.due_at`, [userId]);
  const rows = [];
  for (const row of result.rows) rows.push(await getRecall(row.id, userId));
  return rows.map((row) => ({ attempt: row.attempt, concept: row.concept }));
}
