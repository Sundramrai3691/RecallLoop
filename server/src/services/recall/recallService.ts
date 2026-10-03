import { AppError, conflict, notFound } from "../../utils/errors.js";
import { getEvaluator } from "../evaluator/index.js";
import { getScheduler, type ReviewStateSnapshot } from "../scheduler/index.js";
import { getAttempt, getConcept, getReview, revealNextHint, submitAttempt } from "../../repositories/legacyPostgresRepositories.js";
import type { QuestionType } from "../../domain/recallTypes.js";
import { evidenceWeight, evaluateMcq } from "../question/questionService.js";
import { query } from "../../db/postgres.js";
import { recommendNextAction } from "../recommendation/practiceRecommendationService.js";

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
  const [dimensionHistory,recentAttempts,requiredResult] = await Promise.all([
    query<any>(`SELECT dimension,AVG(score)::float AS score FROM recall_dimension_results d JOIN recall_attempts r ON r.id=d.recall_attempt_id WHERE r.user_id=$1 AND r.concept_id=$2 GROUP BY dimension`,[input.userId,concept.id]),
    query<any>(`SELECT e.overall_coverage,e.missing_concepts FROM recall_attempts r JOIN recall_evaluations e ON e.recall_attempt_id=r.id WHERE r.user_id=$1 AND r.concept_id=$2 ORDER BY r.submitted_at DESC LIMIT 20`,[input.userId,concept.id]),
    query<any>(`SELECT EXISTS(SELECT 1 FROM learner_skills s JOIN goals g ON g.id=s.goal_id WHERE s.user_id=$1 AND g.status='active' AND lower(s.name)=lower($2)) AS required`,[input.userId,concept.name]),
  ]);
  const dimensions: Record<string,number|null> = Object.fromEntries(["recognition","recall","explanation","application","depth","transfer"].map((name)=>[name,dimensionHistory.rows.find((row)=>row.dimension===name)?.score ?? null]));
  dimensions[dimension]=evidenceCoverage;
  let consecutiveFailures=0;
  for(const previousAttempt of recentAttempts.rows){if(Number(previousAttempt.overall_coverage)<.55)consecutiveFailures++;else break;}
  const repeatedPoint=evaluation.missingConcepts[0] ?? null;
  const repeatedCount=repeatedPoint?recentAttempts.rows.filter((row)=>row.missing_concepts.includes(repeatedPoint)).length:0;
  const recommendation=recommendNextAction({conceptName:concept.name,mastery,latestCoverage:evidenceCoverage,dimensions,consecutiveFailures,repeatedMissingPoint:repeatedPoint,repeatedMissingCount:repeatedCount,goalRequired:Boolean(requiredResult.rows[0]?.required)});
  const updated = await submitAttempt(input.userId, id, answer ?? "", confidence, { ...evaluation, dimension }, scheduled, concept.id, mastery, { selectedOptionId: input.selectedOptionId, resultStatus: status, evidenceWeight: hintWeight, recommendation });
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

export async function confirmReviewDate(userId: string, conceptId: string, dueAtInput: string) {
  const date = new Date(dueAtInput);
  if (!Number.isFinite(date.getTime())) throw new AppError("dueAt must be a valid date",400,"VALIDATION_ERROR");
  const result = await (await import("../../db/postgres.js")).query<any>(`UPDATE review_states rs SET due_at=$3,updated_at=now() FROM personal_concepts c WHERE rs.user_id=$1 AND rs.concept_id=$2 AND c.id=rs.concept_id AND c.user_id=$1 RETURNING rs.*`,[userId,conceptId,date]);
  if (!result.rows[0]) throw notFound("Review state not found","REVIEW_NOT_FOUND");
  const review = await getReview(userId,conceptId);
  return review;
}
