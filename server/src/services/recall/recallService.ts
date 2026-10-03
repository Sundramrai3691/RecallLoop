import { AppError, conflict, notFound } from "../../utils/errors.js";
import { getEvaluator } from "../evaluator/index.js";
import { getScheduler, type ReviewStateSnapshot } from "../scheduler/index.js";
import { getAttempt, getConcept, getReview, revealNextHint, submitAttempt } from "../../repositories/legacyPostgresRepositories.js";
import type { QuestionType } from "../../domain/recallTypes.js";
import { evidenceWeight, evaluateMcq } from "../question/questionService.js";

export async function getRecall(id: string, userId: string) {
  const attempt = await getAttempt(id, userId);
  if (!attempt) throw notFound("Recall attempt not found", "RECALL_NOT_FOUND");
  const concept = await getConcept(attempt.conceptId, userId);
  if (!concept) throw notFound("Concept missing for this recall", "MISSING_CONCEPT");
  return { attempt, concept };
}

export async function revealRecallHint(id: string, userId: string) {
  const attempt = await getAttempt(id,userId);
  if (!attempt) throw notFound("Recall attempt not found", "RECALL_NOT_FOUND");
  if (attempt.submittedAt) throw conflict("Hints are unavailable after submission", "ALREADY_SUBMITTED");
  const result = await revealNextHint(userId,id);
  if (!result) throw conflict("No more hints are available", "NO_HINTS_AVAILABLE");
  return result;
}

export async function submitRecall(id: string, input: { answer?: string; selectedOptionId?: string; confidence: number; userId: string }) {
  const answer = input.answer?.trim();
  const { attempt, concept } = await getRecall(id, input.userId);
  const mcq = attempt.questionType === "mcq" && attempt.question;
  if (mcq ? !input.selectedOptionId : !answer) throw new AppError(mcq ? "Select an option" : "Answer cannot be empty", 400, "EMPTY_ANSWER");
  const confidence = Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < 1 || confidence > 10) throw new AppError("Confidence must be a number from 1 to 10", 400, "VALIDATION_ERROR");
  if (attempt.submittedAt) throw conflict("This recall has already been submitted", "ALREADY_SUBMITTED");
  const evaluator = mcq ? null : getEvaluator();
  let evaluationBody;
  if (mcq) {
    const graded = evaluateMcq({ selectedOptionId: input.selectedOptionId!, correctOptionId: attempt.question.correctOptionId, knowledgePoints: attempt.question.knowledgePoints });
    evaluationBody = { ...graded, feedback: graded.correct ? "Correct. This matches the question's answer key." : attempt.question.explanation, suggestedRecallType: "short_explanation" as QuestionType };
  } else {
    evaluationBody = await evaluator!.evaluate({ conceptName: concept.name, conceptDescription: concept.description, requiredKnowledgePoints: attempt.question?.knowledgePoints ?? concept.requiredKnowledgePoints, answer: answer!, questionType: attempt.questionType as QuestionType });
  }
  const evaluation = { ...evaluationBody, evaluatorVersion: mcq ? "deterministic-mcq-1.0" : evaluator!.version };
  const hintWeight = evidenceWeight(attempt.hintsUsed ?? 0);
  const dimension = attempt.question?.assessmentLevel ?? "explanation";
  const previous = await getReview(input.userId, concept.id);
  const previousSnapshot: ReviewStateSnapshot | null = previous ? { conceptId: concept.id, state: previous.state, dueAt: previous.dueAt, intervalDays: previous.intervalDays, stability: previous.stability, difficulty: previous.difficulty, lastRecallAt: previous.lastRecallAt, lastOutcome: previous.lastOutcome, consecutiveSuccesses: previous.consecutiveSuccesses, updatedAt: previous.updatedAt } : null;
  const evidenceCoverage = evaluation.overallCoverage * hintWeight;
  const mastery = Number((Number(concept.mastery) * 0.4 + evidenceCoverage * 0.6).toFixed(4));
  const scheduled = getScheduler().scheduleNextReview({ conceptId: concept.id, coverage: evidenceCoverage, now: new Date(), previous: previousSnapshot, conceptDifficulty: concept.difficulty });
  const status = evaluation.overallCoverage >= 0.75 ? "correct" : evaluation.overallCoverage >= 0.4 ? "partial" : "incorrect";
  const updated = await submitAttempt(input.userId, id, answer ?? "", confidence, { ...evaluation, dimension }, scheduled, concept.id, mastery, { selectedOptionId: input.selectedOptionId, resultStatus: status, evidenceWeight: hintWeight });
  if (!updated) throw conflict("This recall has already been submitted", "ALREADY_SUBMITTED");
  const refreshed = await getRecall(id, input.userId);
  return { attempt: refreshed.attempt, concept: refreshed.concept, review: await getReview(input.userId, concept.id) };
}

export async function listDueRecalls(userId: string) {
  const result = await (await import("../../db/postgres.js")).query<any>(`SELECT r.id FROM recall_attempts r JOIN review_states rs ON rs.user_id=r.user_id AND rs.concept_id=r.concept_id WHERE r.user_id=$1 AND r.submitted_at IS NULL AND rs.due_at <= now() ORDER BY rs.due_at`, [userId]);
  const rows = [];
  for (const row of result.rows) rows.push(await getRecall(row.id, userId));
  return rows.map((row) => ({ attempt: row.attempt, concept: row.concept }));
}
