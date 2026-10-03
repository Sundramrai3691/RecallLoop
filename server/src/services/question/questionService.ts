import type { AssessmentLevel, QuestionType } from "../../domain/recallTypes.js";

export interface QuestionDraft {
  questionType: QuestionType;
  assessmentLevel: AssessmentLevel;
  difficulty: number;
  title: string;
  context: string;
  prompt: string;
  estimatedMinutes: number;
  source: "builtin";
  options: Array<{ id: string; text: string }> | null;
  correctOptionId: string | null;
  explanation: string;
  knowledgePoints: string[];
  hints: string[];
}

const LEVEL_TYPES: Record<AssessmentLevel, QuestionType> = {
  recognition: "mcq", recall: "rapid_recall", explanation: "short_explanation",
  application: "scenario", depth: "descriptive", transfer: "transfer",
};

export function selectAssessment(input: {
  mastery: number; previousCoverage?: number | null; recentFailures?: number;
  recentSuccesses?: number; recentTypes?: QuestionType[]; availableMinutes?: number;
}): { questionType: QuestionType; assessmentLevel: AssessmentLevel; difficulty: number; repetitionReason: string | null } {
  const { mastery, previousCoverage = null, recentFailures = 0, recentSuccesses = 0, recentTypes = [], availableMinutes = 10 } = input;
  let level: AssessmentLevel = mastery < 0.35 ? "recognition" : mastery < 0.55 ? "recall" : mastery < 0.72 ? "explanation" : mastery < 0.84 ? "application" : mastery < 0.93 ? "depth" : "transfer";
  if (recentFailures >= 2 || (previousCoverage !== null && previousCoverage < 0.5)) level = mastery < 0.25 ? "recognition" : "explanation";
  else if (recentSuccesses >= 2 && level !== "transfer") level = ({ recognition: "recall", recall: "explanation", explanation: "application", application: "depth", depth: "transfer" } as const)[level] ?? level;
  if (availableMinutes < 3 && level !== "recognition") level = "recall";
  let questionType = LEVEL_TYPES[level];
  if (recentTypes.slice(0, 2).includes(questionType)) {
    const alternate: Record<AssessmentLevel, AssessmentLevel> = { recognition: "recall", recall: "explanation", explanation: "application", application: "depth", depth: "transfer", transfer: "application" };
    level = alternate[level]; questionType = LEVEL_TYPES[level];
  }
  return { questionType, assessmentLevel: level, difficulty: Math.max(1, Math.min(5, Math.round(mastery * 4) + (recentFailures ? 1 : 2))), repetitionReason: null };
}

export function buildQuestion(conceptName: string, questionType: QuestionType, knowledgePoints: string[], difficulty = 2, variant = 0): QuestionDraft {
  const points = knowledgePoints.length ? knowledgePoints : [`Explain the main mechanism behind ${conceptName}`, `Describe when ${conceptName} is useful`, `Identify an important tradeoff of ${conceptName}`];
  const targetPoint = points[Math.abs(variant) % points.length];
  const byType: Partial<Record<QuestionType, { level: AssessmentLevel; prompt: string; title: string; minutes: number; context?: string }>> = {
    mcq: { level: "recognition", title: "Quick Check", minutes: 1, prompt: `Which statement best captures this key idea about ${conceptName}: ${targetPoint}?` },
    rapid_recall: { level: "recall", title: "Rapid Fire", minutes: 1, prompt: `In one or two sentences, explain this point about ${conceptName}: ${targetPoint}` },
    short_explanation: { level: "explanation", title: "Explain", minutes: 3, prompt: `Explain ${conceptName} from memory, including its central mechanism and when it is useful.` },
    explain: { level: "explanation", title: "Explain", minutes: 4, prompt: `Without looking at your notes, explain how ${conceptName} works from start to finish.` },
    descriptive: { level: "depth", title: "Deep Recall", minutes: 5, context: `Describe the key mechanism, the decisions involved, and the tradeoffs that matter when using ${conceptName}.`, prompt: `How would you reason through ${conceptName}? Explain the approach, important tradeoffs, and likely failure cases.` },
    comparison: { level: "explanation", title: "Compare", minutes: 4, prompt: `Compare ${conceptName} with a closely related approach. When would you choose each?` },
    compare: { level: "explanation", title: "Compare", minutes: 4, prompt: `Without notes, compare ${conceptName} to a closely related approach. When would you choose it?` },
    scenario: { level: "application", title: "Apply", minutes: 4, context: `A system needs to use ${conceptName} under realistic operating constraints.`, prompt: `How would you apply ${conceptName} to this situation? Explain your choice and one tradeoff.` },
    application: { level: "application", title: "Apply", minutes: 4, prompt: `Describe a concrete situation where you would apply ${conceptName}, and walk through the steps.` },
    coding: { level: "application", title: "Practice", minutes: 5, prompt: `Describe how you would implement ${conceptName}: data flow, failure cases, and key operations.` },
    transfer: { level: "transfer", title: "Transfer Challenge", minutes: 6, context: `Consider an unfamiliar product or system with different constraints from the examples you have seen.`, prompt: `How would you adapt the principles of ${conceptName} to a new context? State your assumptions and explain what would change.` },
  };
  const spec = byType[questionType] ?? byType.explain!;
  const options = questionType === "mcq" ? [
    { id: "correct", text: targetPoint },
    { id: "a", text: `A statement unrelated to ${conceptName}: ${targetPoint} is never relevant.` },
    { id: "b", text: `${conceptName} has no operating constraints or tradeoffs.` },
    { id: "c", text: `The key idea is to ignore the mechanism and rely only on the outcome.` },
  ] : null;
  return { questionType, assessmentLevel: spec.level, difficulty, title: spec.title, context: spec.context ?? "", prompt: spec.prompt, estimatedMinutes: spec.minutes, source: "builtin", options, correctOptionId: options ? "correct" : null, explanation: options ? `This matches a required knowledge point for ${conceptName}.` : "", knowledgePoints: points, hints: ["Recall the key mechanism involved.", `Connect your answer to: ${points[0]}`, "Check the main tradeoff or a concrete use case." ] };
}

export function evidenceWeight(hintsUsed: number): number {
  return [1, 0.85, 0.7, 0.55][Math.max(0, Math.min(3, hintsUsed))];
}

export function nextHint(hints: string[], currentLevel: number): { level: number; hint: string } | null {
  if (currentLevel < 0 || currentLevel >= Math.min(hints.length, 3)) return null;
  return { level: currentLevel + 1, hint: hints[currentLevel] };
}

export function assessmentBlueprint(mode: "rapid_fire" | "deep_recall" | "mastery_check"): QuestionType[] {
  if (mode === "rapid_fire") return ["mcq","rapid_recall","mcq","rapid_recall","mcq"];
  if (mode === "deep_recall") return ["descriptive"];
  return ["mcq","rapid_recall","short_explanation","scenario","descriptive","transfer"];
}

export function evaluateMcq(input: { selectedOptionId: string; correctOptionId: string; knowledgePoints: string[] }) {
  const correct = input.selectedOptionId === input.correctOptionId;
  return { correct, overallCoverage: correct ? 1 : 0, knowledgePointResults: input.knowledgePoints.map((point) => ({ point, status: correct ? "correct" as const : "missing" as const, evidence: correct ? input.selectedOptionId : "", feedback: correct ? "Correct selection." : "Review this knowledge point." })), missingConcepts: correct ? [] : input.knowledgePoints, mistakes: correct ? [] : ["Selected an incorrect option"], strengths: correct ? input.knowledgePoints : [] };
}
