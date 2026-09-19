import { tokenOverlap } from "../../lib/llm/json.js";
import type { KnowledgePointResult, QuestionType } from "../../models/RecallAttempt.js";
import { deriveCoverage } from "./validate.js";
import {
  MOCK_EVALUATOR_VERSION,
  type EvaluateAnswerInput,
  type ExtractConceptsInput,
  type ExtractedConcept,
  type Evaluator,
} from "./types.js";

function statusFromOverlap(overlap: number): KnowledgePointResult["status"] {
  if (overlap >= 0.6) return "correct";
  if (overlap >= 0.25) return "partial";
  return "missing";
}

function splitMaterial(material: string): string[] {
  const headingChunks = material
    .split(/^#{1,3}\s+/m)
    .map((c) => c.trim())
    .filter((c) => c.length > 20);
  if (headingChunks.length > 1) return headingChunks.slice(0, 6);

  const paragraphs = material
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  if (paragraphs.length > 1) return paragraphs.slice(0, 6);

  return [material.trim()].filter(Boolean);
}

function knowledgePointsFromText(text: string, fallbackName: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 12)
    .slice(0, 6);
  if (sentences.length > 0) return sentences;
  return [
    `Define ${fallbackName}`,
    `Describe the main steps of ${fallbackName}`,
    `State when ${fallbackName} should be used`,
  ];
}

export class MockEvaluator implements Evaluator {
  readonly version = MOCK_EVALUATOR_VERSION;

  async extractConcepts(input: ExtractConceptsInput): Promise<ExtractedConcept[]> {
    const material = (input.rawMaterial ?? "").trim();
    if (!material) {
      return [
        {
          name: input.title,
          description: `${input.title} as studied in this session. Explain it from first principles without notes.`,
          requiredKnowledgePoints: knowledgePointsFromText("", input.title),
          difficulty: 3,
        },
      ];
    }

    const chunks = splitMaterial(material);
    return chunks.map((chunk, index) => {
      const firstLine = chunk.split("\n")[0]?.replace(/[:.]+$/, "").trim() ?? input.title;
      const name =
        firstLine.length > 80 || firstLine.length < 3
          ? `${input.title} — concept ${index + 1}`
          : firstLine;
      return {
        name,
        description: chunk.slice(0, 600),
        requiredKnowledgePoints: knowledgePointsFromText(chunk, name),
        difficulty: 3,
      };
    });
  }

  async evaluate(input: EvaluateAnswerInput) {
    const answer = input.answer.trim();
    const knowledgePointResults: KnowledgePointResult[] = input.requiredKnowledgePoints.map(
      (point) => {
        const overlap = tokenOverlap(point, answer);
        const status = answer ? statusFromOverlap(overlap) : "missing";
        return {
          point,
          status,
          evidence: answer ? answer.slice(0, 180) : "",
          feedback:
            status === "correct"
              ? "This knowledge point is covered."
              : status === "partial"
                ? "Partially covered — add the missing mechanism."
                : "This knowledge point is missing from the answer.",
        };
      },
    );

    const overallCoverage = deriveCoverage(knowledgePointResults);
    const missing = knowledgePointResults
      .filter((r) => r.status === "missing")
      .map((r) => r.point);
    const strengths = knowledgePointResults
      .filter((r) => r.status === "correct")
      .map((r) => r.point);
    const mistakes = knowledgePointResults
      .filter((r) => r.status === "partial")
      .map((r) => `Incomplete: ${r.point}`);

    let suggestedRecallType: QuestionType = "explain";
    if (overallCoverage >= 0.9) suggestedRecallType = "application";
    else if (overallCoverage >= 0.75) suggestedRecallType = "compare";
    else suggestedRecallType = "explain";

    return {
      knowledgePointResults,
      missingConcepts: missing,
      mistakes,
      strengths,
      overallCoverage,
      feedback:
        overallCoverage >= 0.9
          ? `Strong retrieval of ${input.conceptName}. Next time, apply it to a concrete scenario.`
          : overallCoverage >= 0.5
            ? `Partial retrieval of ${input.conceptName}. Rebuild the missing steps from memory before the next review.`
            : `Weak retrieval of ${input.conceptName}. Restudy the required points, then try a short explain-from-scratch recall.`,
      suggestedRecallType,
    };
  }
}
