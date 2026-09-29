import { Concept } from "../../models/Concept.js";
import { RecallAttempt } from "../../models/RecallAttempt.js";
import { ReviewState } from "../../models/ReviewState.js";
import { Skill } from "../../models/Skill.js";

export async function getConceptState(userId: string, conceptId: string) {
  const concept = await Concept.findOne({ _id: conceptId, userId });
  if (!concept) return null;

  const review = await ReviewState.findOne({ conceptId: concept._id });
  const recalls = await RecallAttempt.find({ conceptId: concept._id, userId }).sort({ createdAt: -1 }).limit(20);
  const successRate = recalls.length
    ? recalls.filter((r) => r.evaluation && r.evaluation.overallCoverage >= 0.75).length / recalls.length
    : 0;
  const mistakeCount = recalls.reduce((count, r) => count + (r.evaluation?.mistakes?.length ?? 0), 0);

  return {
    conceptId: String(concept._id),
    conceptName: concept.name,
    mastery: concept.mastery,
    confidence: recalls[0]?.confidence ?? 0,
    recallSuccessRate: successRate,
    mistakeCount,
    lastRecallAt: recalls[0]?.submittedAt ?? null,
    nextReviewAt: review?.dueAt ?? null,
    status:
      concept.mastery < 0.35
        ? "needs_review"
        : concept.mastery < 0.6
          ? "weak"
          : concept.mastery < 0.8
            ? "learning"
            : "stable",
  };
}

export async function getWeakConcepts(userId: string, limit = 10) {
  const concepts = await Concept.find({ userId }).sort({ mastery: 1, updatedAt: -1 }).limit(limit * 2);
  const weak = [] as any[];

  for (const concept of concepts) {
    const state = await getConceptState(userId, String(concept._id));
    if (state && (state.mastery < 0.7 || state.status === "weak" || state.status === "needs_review")) {
      weak.push(state);
    }
    if (weak.length >= limit) break;
  }

  return weak;
}

export async function getWeakSkills(userId: string) {
  const skills = await Skill.find({ userId }).sort({ currentMastery: 1, priority: -1 });
  return skills.map((skill) => ({
    skillId: String(skill._id),
    name: skill.name,
    priority: skill.priority,
    targetMastery: skill.targetMastery,
    currentMastery: skill.currentMastery,
    status: skill.currentMastery < 0.6 ? "weak" : skill.currentMastery < 0.8 ? "learning" : "stable",
  }));
}

export async function getLearnerSummary(userId: string) {
  const concepts = await Concept.find({ userId });
  const weakConcepts = await getWeakConcepts(userId, 10);
  const weakSkills = await getWeakSkills(userId);
  const dueReviews = await ReviewState.find({ dueAt: { $lte: new Date() } }).populate("conceptId");
  const dueCount = dueReviews.filter((review) => {
    const concept = review.conceptId as any;
    return concept && concept.userId === userId;
  }).length;

  const masteryValues = concepts.map((concept) => concept.mastery || 0);
  const averageMastery = masteryValues.length
    ? masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length
    : 0;

  const recentMistakes = await RecallAttempt.find({ userId, "evaluation.mistakes.0": { $exists: true } })
    .sort({ submittedAt: -1 })
    .limit(10)
    .lean();

  return {
    totalConcepts: concepts.length,
    averageMastery,
    dueConcepts: dueCount,
    weakConceptCount: weakConcepts.length,
    weakSkills,
    weakConcepts,
    recentMistakes: recentMistakes.map((attempt) => ({
      conceptId: String(attempt.conceptId),
      mistakes: attempt.evaluation?.mistakes ?? [],
      submittedAt: attempt.submittedAt,
    })),
    derivedFrom: [
      "concept mastery",
      "recall coverage",
      "review due dates",
      "confidence and mistake history",
    ],
    heuristics: [
      "weak concepts are those below 0.7 mastery or marked weak by review state",
      "status is derived with deterministic thresholds",
    ],
  };
}
