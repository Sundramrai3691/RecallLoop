import { Concept } from "../models/Concept.js";
import { RecallAttempt } from "../models/RecallAttempt.js";
import { ReviewState } from "../models/ReviewState.js";
import { StudySession } from "../models/StudySession.js";
import { User } from "../models/User.js";

export function serializeSession(session: InstanceType<typeof StudySession>) {
  return {
    id: String(session._id),
    userId: session.userId,
    title: session.title,
    rawMaterial: session.rawMaterial,
    sourceType: session.sourceType,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function serializeConcept(concept: InstanceType<typeof Concept>) {
  return {
    id: String(concept._id),
    studySessionId: String(concept.studySessionId),
    name: concept.name,
    description: concept.description,
    parentConceptId: concept.parentConceptId ? String(concept.parentConceptId) : null,
    requiredKnowledgePoints: concept.requiredKnowledgePoints,
    difficulty: concept.difficulty,
    mastery: concept.mastery,
    createdAt: concept.createdAt,
    updatedAt: concept.updatedAt,
  };
}

export function serializeAttempt(attempt: InstanceType<typeof RecallAttempt>) {
  return {
    id: String(attempt._id),
    conceptId: String(attempt.conceptId),
    studySessionId: String(attempt.studySessionId),
    question: attempt.question,
    questionType: attempt.questionType,
    answer: attempt.answer ?? null,
    confidence: attempt.confidence ?? null,
    evaluation: attempt.evaluation ?? null,
    submittedAt: attempt.submittedAt ?? null,
    createdAt: attempt.createdAt,
  };
}

export function serializeReview(review: InstanceType<typeof ReviewState> | null) {
  if (!review) return null;
  return {
    conceptId: String(review.conceptId),
    state: review.state,
    dueAt: review.dueAt,
    intervalDays: review.intervalDays,
    stability: review.stability,
    difficulty: review.difficulty,
    lastRecallAt: review.lastRecallAt ?? null,
    lastOutcome: review.lastOutcome ?? null,
    consecutiveSuccesses: review.consecutiveSuccesses,
    updatedAt: review.updatedAt,
  };
}

export function serializeUser(user: InstanceType<typeof User>) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
