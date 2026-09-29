import { Types } from "mongoose";
import { Concept, type ConceptDoc } from "../../models/Concept.js";
import { RecallAttempt } from "../../models/RecallAttempt.js";
import { ReviewState } from "../../models/ReviewState.js";
import type { QuestionType } from "../../models/RecallAttempt.js";
import { AppError, conflict, notFound } from "../../utils/errors.js";
import { updateConceptMastery } from "../concept/conceptService.js";
import { getEvaluator } from "../evaluator/index.js";
import { buildRecallQuestion } from "../question/questionService.js";
import { getScheduler, type ReviewStateSnapshot } from "../scheduler/index.js";

type ConceptLike = Pick<
  ConceptDoc,
  "name" | "description" | "requiredKnowledgePoints" | "difficulty"
> & { _id: Types.ObjectId };

export async function createImmediateRecalls(input: {
  studySessionId: string;
  concepts: ConceptLike[];
  userId?: string;
}) {
  const created = [];
  const now = new Date();

  for (const concept of input.concepts) {
    const existingPending = await RecallAttempt.findOne({
      conceptId: concept._id,
      submittedAt: { $exists: false },
    });
    if (existingPending) {
      created.push(existingPending);
      continue;
    }

    const attempt = await RecallAttempt.create({
      userId: input.userId ?? "local-user",
      conceptId: concept._id,
      studySessionId: new Types.ObjectId(input.studySessionId),
      questionType: "explain",
      question: buildRecallQuestion(concept.name, "explain"),
    });
    created.push(attempt);

    const review = await ReviewState.findOne({ conceptId: concept._id });
    if (!review) {
      await ReviewState.create({
        userId: input.userId ?? "local-user",
        conceptId: concept._id,
        state: "new",
        dueAt: now,
        intervalDays: 0,
        stability: 0,
        difficulty: (concept.difficulty ?? 3) / 5,
        consecutiveSuccesses: 0,
      });
    } else if (review.dueAt > now) {
      review.dueAt = now;
      await review.save();
    }
  }

  return created;
}

export async function getRecall(id: string) {
  const attempt = await RecallAttempt.findById(id);
  if (!attempt) throw notFound("Recall attempt not found", "RECALL_NOT_FOUND");
  const concept = await Concept.findById(attempt.conceptId);
  if (!concept) throw notFound("Concept missing for this recall", "MISSING_CONCEPT");
  return { attempt, concept };
}

export async function submitRecall(
  id: string,
  input: { answer: string; confidence: number; userId?: string },
) {
  const answer = input.answer?.trim();
  if (!answer) {
    throw new AppError("Answer cannot be empty", 400, "EMPTY_ANSWER");
  }
  const confidence = Number(input.confidence);
  if (!Number.isFinite(confidence) || confidence < 1 || confidence > 10) {
    throw new AppError("Confidence must be a number from 1 to 10", 400, "VALIDATION_ERROR");
  }

  const attempt = await RecallAttempt.findById(id);
  if (!attempt) throw notFound("Recall attempt not found", "RECALL_NOT_FOUND");
  if (input.userId && attempt.userId && input.userId !== attempt.userId) {
    throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  }
  if (attempt.submittedAt) {
    throw conflict("This recall has already been submitted", "ALREADY_SUBMITTED");
  }

  const concept = await Concept.findById(attempt.conceptId);
  if (!concept) throw notFound("Concept missing for this recall", "MISSING_CONCEPT");
  if (input.userId && concept.userId && input.userId !== concept.userId) {
    throw new AppError("You do not have access to this resource", 403, "FORBIDDEN");
  }
  if (!concept.requiredKnowledgePoints?.length) {
    throw new AppError("Concept has no knowledge points to evaluate", 400, "MISSING_CONCEPT");
  }

  const evaluator = getEvaluator();
  const evaluationBody = await evaluator.evaluate({
    conceptName: concept.name,
    conceptDescription: concept.description,
    requiredKnowledgePoints: concept.requiredKnowledgePoints,
    answer,
    questionType: attempt.questionType,
  });

  const evaluation = {
    ...evaluationBody,
    evaluatorVersion: evaluator.version,
  };

  attempt.userId = input.userId ?? attempt.userId ?? concept.userId ?? "local-user";
  attempt.answer = answer;
  attempt.confidence = confidence;
  attempt.evaluation = evaluation;
  attempt.submittedAt = new Date();
  await attempt.save();

  const updatedConcept =
    (await updateConceptMastery(String(concept._id), evaluation.overallCoverage)) ?? concept;

  const previousDoc = await ReviewState.findOne({ conceptId: concept._id });
  const previous: ReviewStateSnapshot | null = previousDoc
    ? {
        conceptId: String(previousDoc.conceptId),
        state: previousDoc.state,
        dueAt: previousDoc.dueAt,
        intervalDays: previousDoc.intervalDays,
        stability: previousDoc.stability,
        difficulty: previousDoc.difficulty,
        lastRecallAt: previousDoc.lastRecallAt,
        lastOutcome: previousDoc.lastOutcome,
        consecutiveSuccesses: previousDoc.consecutiveSuccesses,
        updatedAt: previousDoc.updatedAt,
      }
    : null;

  const scheduled = getScheduler().scheduleNextReview({
    conceptId: String(concept._id),
    coverage: evaluation.overallCoverage,
    now: new Date(),
    previous,
    conceptDifficulty: updatedConcept.difficulty,
  });

  const review = await ReviewState.findOneAndUpdate(
    { conceptId: concept._id },
    {
      userId: String(concept.userId ?? "local-user"),
      conceptId: concept._id,
      state: scheduled.state,
      dueAt: scheduled.dueAt,
      intervalDays: scheduled.intervalDays,
      stability: scheduled.stability,
      difficulty: scheduled.difficulty,
      lastRecallAt: scheduled.lastRecallAt,
      lastOutcome: scheduled.lastOutcome,
      consecutiveSuccesses: scheduled.consecutiveSuccesses,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { attempt, concept: updatedConcept, review };
}

export async function ensureDueRecallAttempts(): Promise<void> {
  const now = new Date();
  const due = await ReviewState.find({ dueAt: { $lte: now } });
  for (const review of due) {
    const pending = await RecallAttempt.findOne({
      conceptId: review.conceptId,
      submittedAt: { $exists: false },
    });
    if (pending) continue;
    const concept = await Concept.findById(review.conceptId);
    if (!concept) continue;
    const last = await RecallAttempt.findOne({
      conceptId: concept._id,
      submittedAt: { $exists: true },
    }).sort({ submittedAt: -1 });
    const questionType: QuestionType = last?.evaluation?.suggestedRecallType ?? "explain";
    await RecallAttempt.create({
      conceptId: concept._id,
      studySessionId: concept.studySessionId,
      questionType,
      question: buildRecallQuestion(concept.name, questionType),
    });
  }
}

export async function listDueRecalls() {
  await ensureDueRecallAttempts();
  const attempts = await RecallAttempt.find({ submittedAt: { $exists: false } }).sort({
    createdAt: 1,
  });
  const conceptIds = attempts.map((a) => a.conceptId);
  const concepts = await Concept.find({ _id: { $in: conceptIds } });
  const byId = new Map(concepts.map((c) => [String(c._id), c]));
  return attempts.map((attempt) => ({
    attempt,
    concept: byId.get(String(attempt.conceptId)) ?? null,
  }));
}
