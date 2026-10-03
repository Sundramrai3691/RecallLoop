export function serializeSession(session: any) {
  return { id: String(session.id ?? session._id), userId: session.userId, title: session.title, rawMaterial: session.rawMaterial, sourceType: session.sourceType, startedAt: session.startedAt, completedAt: session.completedAt ?? null, status: session.status, createdAt: session.createdAt, updatedAt: session.updatedAt };
}
export function serializeConcept(concept: any) {
  return { id: String(concept.id ?? concept._id), studySessionId: String(concept.studySessionId), name: concept.name, description: concept.description, parentConceptId: concept.parentConceptId ? String(concept.parentConceptId) : null, requiredKnowledgePoints: concept.requiredKnowledgePoints, difficulty: concept.difficulty, mastery: Number(concept.mastery), createdAt: concept.createdAt, updatedAt: concept.updatedAt };
}
export function serializeAttempt(attempt: any) {
  const question = attempt.question && { id: attempt.question.id, assessmentLevel: attempt.question.assessmentLevel, difficulty: attempt.question.difficulty, title: attempt.question.title, context: attempt.question.context, prompt: attempt.question.prompt, estimatedMinutes: attempt.question.estimatedMinutes, options: attempt.question.options, revealedHints: attempt.question.revealedHints, hintsRemaining: attempt.question.hintsRemaining };
  return { id: String(attempt.id ?? attempt._id), conceptId: String(attempt.conceptId), studySessionId: String(attempt.studySessionId), question: attempt.question?.prompt ?? attempt.question, questionData: question, questionType: attempt.questionType, questionId: attempt.question?.id ?? null, answer: attempt.answer ?? null, selectedOptionId: attempt.selectedOptionId ?? null, confidence: attempt.confidence ?? null, hintsUsed: attempt.hintsUsed ?? 0, maxHintLevel: attempt.maxHintLevel ?? 0, startedAt: attempt.startedAt ?? attempt.createdAt, timeTakenSeconds: attempt.timeTakenSeconds ?? null, resultStatus: attempt.resultStatus ?? null, repetitionReason: attempt.repetitionReason ?? null, remediationId: attempt.remediationId ?? null, evidenceWeight: attempt.evidenceWeight ?? 1, recommendation: attempt.recommendation ?? null, evaluation: attempt.evaluation ?? null, submittedAt: attempt.submittedAt ?? null, createdAt: attempt.createdAt };
}
export function serializeReview(review: any | null) {
  if (!review) return null;
  return { conceptId: String(review.conceptId), state: review.state, dueAt: review.dueAt, intervalDays: review.intervalDays, stability: Number(review.stability), difficulty: Number(review.difficulty), lastRecallAt: review.lastRecallAt ?? null, lastOutcome: review.lastOutcome ?? null, consecutiveSuccesses: review.consecutiveSuccesses, updatedAt: review.updatedAt };
}
export function serializeUser(user: any) {
  return { id: String(user.id ?? user._id), name: user.name, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt };
}
