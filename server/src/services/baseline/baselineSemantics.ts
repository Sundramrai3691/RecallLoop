export interface BaselineEvidenceQuestion {
  conceptId: string;
  knowledgePointId: string | null;
  knowledgePointResults: Array<{ point: string; status: "correct" | "partial" | "missing" }> | null;
}

export function summarizeBaselineEvidence(questions: BaselineEvidenceQuestion[]) {
  const unique = new Map<string, "correct" | "partial" | "missing">();
  for (const question of questions) {
    for (const result of question.knowledgePointResults ?? []) {
      const label = result.point.trim().toLowerCase().replace(/\s+/g, " ");
      const key = question.knowledgePointId ?? `${question.conceptId}:${label}`;
      if (!label) continue;
      const previous = unique.get(key);
      const rank = (status: string) => status === "correct" ? 2 : status === "partial" ? 1 : 0;
      if (!previous || rank(result.status) < rank(previous)) unique.set(key, result.status);
    }
  }
  const evidenceCount = unique.size;
  const mastery = evidenceCount
    ? [...unique.values()].reduce((sum, status) => sum + (status === "correct" ? 1 : status === "partial" ? 0.5 : 0), 0) / evidenceCount
    : null;
  const status = mastery === null ? "Not assessed" : evidenceCount < 3 ? "Early signal" : mastery < 0.35 ? "Needs work" : mastery < 0.7 ? "Developing" : "Strong";
  return { evidenceCount, mastery, status };
}
