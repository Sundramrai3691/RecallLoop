import { createLlmProvider } from "../../lib/llm/createProvider.js";
import { isMockLlm } from "../../config/env.js";
import { LlmEvaluator } from "./llmEvaluator.js";
import { MockEvaluator } from "./mockEvaluator.js";
import type { Evaluator } from "./types.js";

let cached: Evaluator | undefined;

export function getEvaluator(): Evaluator {
  if (!cached) {
    cached = isMockLlm()
      ? new MockEvaluator()
      : new LlmEvaluator(createLlmProvider());
  }
  return cached;
}

export function resetEvaluatorForTests(): void {
  cached = undefined;
}

export type { Evaluator, EvaluateAnswerInput, ExtractedConcept } from "./types.js";
export { MOCK_EVALUATOR_VERSION, LLM_EVALUATOR_VERSION } from "./types.js";
export { parseEvaluationJson, parseConceptExtractionJson, deriveCoverage } from "./validate.js";
export { MockEvaluator } from "./mockEvaluator.js";
