import { createHash } from "node:crypto";
import { canonicalHttpPilotQuestions, pilotQuestionBenchmark, type PilotQuestion } from "./pilotQuestionBank.js";

const canonicalTargets = new Set([
  "HTTP caching\u0000Can distinguish freshness from validation.",
  "HTTP request lifecycle\u0000Can explain method, status, headers, and body roles.",
]);
const supportedTypes = new Set(["mcq", "rapid_recall", "short_explanation", "scenario", "descriptive", "transfer"]);
const supportedLevels = new Set(["recognition", "recall", "explanation", "application", "depth", "transfer"]);

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function containsPointEvidenceTerm(question: PilotQuestion, text: string): boolean {
  const tokens = normalizedText(text).split(" ");
  const anchors = question.canonicalConceptName === "HTTP caching"
    ? ["fresh", "stale", "validat", "validator", "etag", "max age"]
    : ["method", "status", "header", "bod", "request", "response", "precondition"];
  return anchors.some((anchor) => anchor.includes(" ")
    ? normalizedText(text).includes(anchor)
    : tokens.some((token) => token.startsWith(anchor)));
}

function nearDuplicateScore(left: string, right: string): number {
  const a = new Set(normalizedText(left).split(" ").filter((word) => word.length > 2));
  const b = new Set(normalizedText(right).split(" ").filter((word) => word.length > 2));
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / Math.max(1, a.size + b.size - intersection);
}

export function validatePilotQuestionBank(questions: readonly PilotQuestion[] = canonicalHttpPilotQuestions): string[] {
  const issues: string[] = [];
  if (questions.length < 20 || questions.length > 30) issues.push(`pilot-count: expected 20–30 questions, got ${questions.length}`);
  const slugs = new Set<string>();
  const prompts = new Map<string, string>();
  const pointCounts = new Map<string, number>();
  const levelCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const difficultyCounts = new Map<number, number>();
  for (const question of questions) {
    const prefix = question.slug || "<missing-slug>";
    if (!question.slug || slugs.has(question.slug)) issues.push(`${prefix}: missing or duplicate stable slug`);
    slugs.add(question.slug);
    if (!canonicalTargets.has(`${question.canonicalConceptName}\u0000${question.knowledgePoint}`)) issues.push(`${prefix}: unmapped canonical concept/point pair`);
    if (!containsPointEvidenceTerm(question, question.expectedAnswer)) issues.push(`${prefix}: expected answer has no terminology tied to the mapped canonical point`);
    if (!supportedTypes.has(question.questionType)) issues.push(`${prefix}: unsupported question type ${question.questionType}`);
    if (!supportedLevels.has(question.assessmentLevel)) issues.push(`${prefix}: unsupported cognitive level ${question.assessmentLevel}`);
    if (!Number.isInteger(question.revision) || question.revision < 1) issues.push(`${prefix}: revision must be a positive integer`);
    if (!Number.isInteger(question.difficulty) || question.difficulty < 1 || question.difficulty > 5) issues.push(`${prefix}: difficulty must be an integer from 1 to 5`);
    if (!question.objective.trim() || !question.prompt.trim() || !question.expectedAnswer.trim()) issues.push(`${prefix}: objective, prompt, and expected answer are required`);
    if (!/^https:\/\//.test(question.source.url) || !question.source.title.trim() || !question.source.publisher.trim() || !question.source.license.trim() || !question.source.notes.includes("Accessed 2026-10-18")) issues.push(`${prefix}: source provenance is incomplete`);
    if (!question.rubric.length || new Set(question.rubric.map((dimension) => dimension.id)).size !== question.rubric.length || question.rubric.some((dimension) => !dimension.id || !dimension.label || dimension.weight <= 0 || !dimension.fullCredit || !dimension.partialCredit || !dimension.insufficient)) issues.push(`${prefix}: rubric dimensions are absent or invalid`);
    if (question.hints.length > 3 || question.hints.some((hint) => !hint.trim())) issues.push(`${prefix}: hints must contain at most three non-empty steps`);
    const promptKey = normalizedText(question.prompt);
    if (prompts.has(promptKey)) issues.push(`${prefix}: exact duplicate prompt with ${prompts.get(promptKey)}`);
    prompts.set(promptKey, prefix);
    pointCounts.set(question.knowledgePoint, (pointCounts.get(question.knowledgePoint) ?? 0) + 1);
    levelCounts.set(question.assessmentLevel, (levelCounts.get(question.assessmentLevel) ?? 0) + 1);
    typeCounts.set(question.questionType, (typeCounts.get(question.questionType) ?? 0) + 1);
    difficultyCounts.set(question.difficulty, (difficultyCounts.get(question.difficulty) ?? 0) + 1);
    if (question.questionType === "mcq") {
      const optionIds = question.options?.map((option) => option.id) ?? [];
      const optionTexts = question.options?.map((option) => normalizedText(option.text)) ?? [];
      if (!question.options || question.options.length !== 4 || new Set(optionIds).size !== optionIds.length || new Set(optionTexts).size !== optionTexts.length || optionIds.filter((id) => id === question.correctOptionId).length !== 1) issues.push(`${prefix}: MCQ needs four distinct options and exactly one correct key`);
      if (question.distractorRationales.length !== 3 || question.distractorRationales.some((rationale) => !optionIds.includes(rationale.optionId) || rationale.optionId === question.correctOptionId || !rationale.misconception.trim() || !rationale.explanation.trim())) issues.push(`${prefix}: each MCQ distractor needs a misconception and explanation`);
      const correct = question.options?.find((option) => option.id === question.correctOptionId);
      if (!question.explanation.trim() || !correct || normalizedText(question.expectedAnswer).length < 12) issues.push(`${prefix}: MCQ key, answer contract, or explanation is missing`);
    } else if (question.options !== null || question.correctOptionId !== null || question.distractorRationales.length) {
      issues.push(`${prefix}: free response must not carry an MCQ key or distractors`);
    }
    for (const other of questions) {
      if (other.slug >= question.slug) continue;
      if (nearDuplicateScore(question.prompt, other.prompt) >= 0.84) issues.push(`${prefix}: near duplicate prompt with ${other.slug}`);
    }
  }
  for (const point of ["Can distinguish freshness from validation.", "Can explain method, status, headers, and body roles."]) {
    if ((pointCounts.get(point) ?? 0) < 10) issues.push(`coverage:${point}: expected at least 10 questions`);
  }
  for (const level of ["recognition", "recall", "explanation", "application", "depth", "transfer"]) if (!levelCounts.has(level)) issues.push(`level-coverage:${level}: no questions`);
  for (const difficulty of [1, 2, 3, 4, 5]) if (!difficultyCounts.has(difficulty)) issues.push(`difficulty-coverage:${difficulty}: no questions`);
  for (const type of ["mcq", "rapid_recall", "short_explanation", "scenario", "descriptive", "transfer"]) if (!typeCounts.has(type)) issues.push(`type-coverage:${type}: no questions`);
  for (const fixture of pilotQuestionBenchmark) {
    const question = questions.find((item) => item.slug === fixture.questionSlug);
    if (!question) issues.push(`benchmark:${fixture.questionSlug}: question is missing`);
    else if (!fixture.answer.trim() || !fixture.rubricDimensionIds.length || fixture.rubricDimensionIds.some((id) => !question.rubric.some((dimension) => dimension.id === id))) issues.push(`benchmark:${fixture.questionSlug}: attempt or expected outcome has no supporting rubric dimensions`);
  }
  return issues;
}

export function questionContentHash(question: PilotQuestion): string {
  const content = {
    canonicalConceptName: question.canonicalConceptName,
    knowledgePoint: question.knowledgePoint,
    questionType: question.questionType,
    assessmentLevel: question.assessmentLevel,
    difficulty: question.difficulty,
    title: question.title,
    objective: question.objective,
    prompt: question.prompt,
    context: question.context,
    expectedAnswer: question.expectedAnswer,
    rubric: question.rubric,
    misconceptions: question.misconceptions,
    hints: question.hints,
    estimatedMinutes: question.estimatedMinutes,
    correctOptionId: question.correctOptionId,
    options: question.options,
    explanation: question.explanation,
    distractorRationales: question.distractorRationales,
    source: question.source,
  };
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

export function pilotQuestionInventory(questions: readonly PilotQuestion[] = canonicalHttpPilotQuestions) {
  const count = (key: (question: PilotQuestion) => string) => Object.fromEntries([...new Set(questions.map(key))].sort().map((value) => [value, questions.filter((question) => key(question) === value).length]));
  return {
    total: questions.length,
    concepts: [...new Set(questions.map((question) => question.canonicalConceptName))],
    points: Object.fromEntries([...new Set(questions.map((question) => question.knowledgePoint))].sort().map((point) => [point, questions.filter((question) => question.knowledgePoint === point).length])),
    cognitiveLevels: count((question) => question.assessmentLevel),
    difficulties: count((question) => String(question.difficulty)),
    questionTypes: count((question) => question.questionType),
  };
}
