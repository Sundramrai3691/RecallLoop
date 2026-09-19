import { parseJsonObject } from "../../lib/llm/json.js";
import {
  conceptExtractionSchema,
  recallEvaluationSchema,
  type ParsedConceptExtraction,
  type ParsedEvaluation,
} from "./schemas.js";

export function parseEvaluationJson(raw: string): ParsedEvaluation {
  const parsed = parseJsonObject(raw);
  return recallEvaluationSchema.parse(parsed);
}

export function parseConceptExtractionJson(raw: string): ParsedConceptExtraction {
  const parsed = parseJsonObject(raw);
  return conceptExtractionSchema.parse(parsed);
}

export function deriveCoverage(
  results: { status: "correct" | "partial" | "missing" }[],
): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((acc, r) => {
    if (r.status === "correct") return acc + 1;
    if (r.status === "partial") return acc + 0.5;
    return acc;
  }, 0);
  return Number((sum / results.length).toFixed(4));
}
