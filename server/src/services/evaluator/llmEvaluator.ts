import type { LlmProvider } from "../../lib/llm/types.js";
import { AppError, unavailable } from "../../utils/errors.js";
import {
  LLM_EVALUATOR_VERSION,
  type EvaluateAnswerInput,
  type ExtractConceptsInput,
  type ExtractedConcept,
  type Evaluator,
} from "./types.js";
import { deriveCoverage, parseConceptExtractionJson, parseEvaluationJson } from "./validate.js";
import { tokenOverlap } from "../../lib/llm/json.js";
import type { KnowledgePointResult } from "../../domain/recallTypes.js";

export function alignKnowledgePoints(
  required: string[],
  results: KnowledgePointResult[],
  strict = false,
): KnowledgePointResult[] {
  if(strict){
    const keys=required.map((point)=>point.trim().toLowerCase());
    const returned=results.map((result)=>result.point.trim().toLowerCase());
    if(new Set(returned).size!==returned.length||returned.length!==keys.length||keys.some((point)=>!returned.includes(point))){
      throw new AppError("The evaluator returned results for unexpected knowledge points.",502,"INVALID_EVALUATION_RESULT");
    }
  }
  const unused = [...results];
  return required.map((point) => {
    const exact = unused.findIndex((r) => r.point.trim().toLowerCase() === point.trim().toLowerCase());
    const idx =
      exact >= 0
        ? exact
        : unused.findIndex((r) => tokenOverlap(r.point, point) >= 0.5);
    if (idx < 0) {
      return {
        point,
        status: "missing" as const,
        evidence: "",
        feedback: "This required knowledge point was not scored.",
      };
    }
    const [match] = unused.splice(idx, 1);
    return { ...match, point };
  });
}

function evaluationPrompt(input: EvaluateAnswerInput): string {
  return `Evaluate the learner's free-recall answer against the required knowledge points.

Return ONLY valid JSON matching this shape:
{
  "knowledgePointResults": [
    {
      "point": "...",
      "status": "correct | partial | missing",
      "evidence": "...",
      "feedback": "..."
    }
  ],
  "missingConcepts": [],
  "mistakes": [],
  "strengths": [],
  "overallCoverage": 0.0,
  "feedback": "...",
  "suggestedRecallType": "explain"
}

Rules:
- overallCoverage must be between 0 and 1.
- Evaluate every required knowledge point.
- Do not invent a 1-10 score. Coverage is derived from knowledge-point status.
- suggestedRecallType must be one of: explain, compare, application, coding.

Concept name: ${input.conceptName}
Concept description: ${input.conceptDescription}
Question type: ${input.questionType}
Required knowledge points: ${JSON.stringify(input.requiredKnowledgePoints)}
Grading rubric / required answer ideas: ${JSON.stringify(input.rubric ?? input.requiredKnowledgePoints)}
Learner answer: ${input.answer}`;
}

function extractionPrompt(input: ExtractConceptsInput): string {
  return `Extract study concepts from this session. Return ONLY valid JSON:
{
  "concepts": [
    {
      "name": "...",
      "description": "...",
      "requiredKnowledgePoints": ["..."],
      "difficulty": 3
    }
  ]
}

Each concept needs at least one required knowledge point (atomic facts the learner must retrieve).
Difficulty is 1-5.

Topic: ${input.title}
Material: ${input.rawMaterial || "(none — create one concept from the topic)"}`;
}

export class LlmEvaluator implements Evaluator {
  readonly version = LLM_EVALUATOR_VERSION;

  constructor(private readonly provider: LlmProvider) {}

  async extractConcepts(input: ExtractConceptsInput): Promise<ExtractedConcept[]> {
    const raw = await this.completeWithRetry(extractionPrompt(input), (text) => {
      const parsed = parseConceptExtractionJson(text);
      return parsed.concepts;
    });
    return raw;
  }

  async evaluate(input: EvaluateAnswerInput) {
    const parsed = await this.completeWithRetry(evaluationPrompt(input), (text) =>
      parseEvaluationJson(text),
    );
    const knowledgePointResults = alignKnowledgePoints(
      input.requiredKnowledgePoints,
      parsed.knowledgePointResults,
      input.strictKnowledgePoints,
    );
    return {
      ...parsed,
      knowledgePointResults,
      overallCoverage: deriveCoverage(knowledgePointResults),
    };
  }

  private async completeWithRetry<T>(prompt: string, parse: (text: string) => T): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = await this.provider.complete(
          [
            {
              role: "system",
              content:
                "You output strictly valid JSON for a learning product. No markdown, no commentary.",
            },
            { role: "user", content: prompt },
          ],
          { temperature: 0, json: true },
        );
        return parse(text);
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError instanceof AppError) throw lastError;
    throw unavailable(
      "LLM returned invalid JSON after retry. Use mock mode or check the model.",
      "INVALID_AI_JSON",
    );
  }
}
