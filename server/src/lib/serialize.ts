export function serializeSession(session: any) {
  return { id: String(session.id ?? session._id), userId: session.userId, title: session.title, rawMaterial: session.rawMaterial, sourceType: session.sourceType, startedAt: session.startedAt, completedAt: session.completedAt ?? null, status: session.status, createdAt: session.createdAt, updatedAt: session.updatedAt };
}
export function serializeConcept(concept: any) {
  return { id: String(concept.id ?? concept._id), studySessionId: String(concept.studySessionId), name: concept.name, description: concept.description, parentConceptId: concept.parentConceptId ? String(concept.parentConceptId) : null, requiredKnowledgePoints: concept.requiredKnowledgePoints, difficulty: concept.difficulty, mastery: Number(concept.mastery), createdAt: concept.createdAt, updatedAt: concept.updatedAt };
}
export function serializeAttempt(attempt: any) {
  return { id: String(attempt.id ?? attempt._id), conceptId: String(attempt.conceptId), studySessionId: String(attempt.studySessionId), question: attempt.question, questionType: attempt.questionType, answer: attempt.answer ?? null, confidence: attempt.confidence ?? null, evaluation: attempt.evaluation ?? null, submittedAt: attempt.submittedAt ?? null, createdAt: attempt.createdAt };
}
export function serializeReview(review: any | null) {
  if (!review) return null;
  return { conceptId: String(review.conceptId), state: review.state, dueAt: review.dueAt, intervalDays: review.intervalDays, stability: Number(review.stability), difficulty: Number(review.difficulty), lastRecallAt: review.lastRecallAt ?? null, lastOutcome: review.lastOutcome ?? null, consecutiveSuccesses: review.consecutiveSuccesses, updatedAt: review.updatedAt };
}
export function serializeUser(user: any) {
  return { id: String(user.id ?? user._id), name: user.name, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt };
}
