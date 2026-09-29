import type { QuestionType, RecallEvaluation } from "../../domain/recallTypes.js";

export const MOCK_EVALUATOR_VERSION = "recallloop-mock-eval-1.0.0";
export const LLM_EVALUATOR_VERSION = "recallloop-llm-eval-1.0.0";

export interface EvaluateAnswerInput {
  conceptName: string;
  conceptDescription: string;
  requiredKnowledgePoints: string[];
  answer: string;
  questionType: QuestionType;
}

export interface ExtractConceptsInput {
  title: string;
  rawMaterial?: string;
}

export interface ExtractedConcept {
  name: string;
  description: string;
  requiredKnowledgePoints: string[];
  difficulty?: number;
}

export interface Evaluator {
  readonly version: string;
  evaluate(input: EvaluateAnswerInput): Promise<Omit<RecallEvaluation, "evaluatorVersion">>;
  extractConcepts(input: ExtractConceptsInput): Promise<ExtractedConcept[]>;
}
