export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseJsonObject(raw: string): unknown {
  return JSON.parse(stripJsonFence(raw));
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "is",
  "are",
  "was",
  "be",
  "as",
  "by",
  "from",
  "that",
  "this",
  "it",
  "into",
  "then",
]);

export function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function tokenOverlap(point: string, answer: string): number {
  const pointTokens = significantTokens(point);
  if (pointTokens.length === 0) return answer.trim() ? 1 : 0;
  const answerSet = new Set(significantTokens(answer));
  const hits = pointTokens.filter((t) => answerSet.has(t)).length;
  return hits / pointTokens.length;
}
