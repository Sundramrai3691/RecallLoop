import { describe, expect, it } from "vitest";
import { env } from "../../config/env.js";
import { OpenAiCompatibleProvider } from "../../lib/llm/openaiCompatibleProvider.js";
import { LlmEvaluator } from "../evaluator/llmEvaluator.js";
import { OpenAiCompatibleEmbeddingProvider } from "../grounding/embeddingProvider.js";
import { LlmGroundedRemediator } from "../grounding/remediationGenerator.js";
import { buildQuestion } from "../question/questionService.js";

const liveEnabled = process.env.RECALLLOOP_LIVE_PROVIDER_SMOKE === "1";
const liveTest = liveEnabled ? it : it.skip;
const requireGeminiConfig = () => {
  if (!env.llmApiKey.trim()) throw new Error("LLM_API_KEY is required for the live provider smoke check.");
  if (!/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/openai\/?$/.test(env.llmBaseUrl)) {
    throw new Error("LLM_BASE_URL must use Gemini's OpenAI-compatible v1beta/openai endpoint for this smoke check.");
  }
};

describe("live Gemini provider smoke checks", () => {
  liveTest("performs concept extraction", async () => {
    requireGeminiConfig();
    const llm = new OpenAiCompatibleProvider();
    const evaluator = new LlmEvaluator(llm);
    const extracted = await evaluator.extractConcepts({
      title: "Token bucket rate limiting",
      rawMaterial: "A token bucket accumulates tokens at a configured refill rate up to a capacity. Each request consumes tokens. If there are not enough tokens, the system delays or rejects the request.",
    });
    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted[0].requiredKnowledgePoints.length).toBeGreaterThan(0);
  }, 120_000);

  liveTest("evaluates free-form recall", async () => {
    requireGeminiConfig();
    const evaluator = new LlmEvaluator(new OpenAiCompatibleProvider());
    const evaluation = await evaluator.evaluate({
      conceptName: "Token bucket rate limiting",
      conceptDescription: "A rate-limiting algorithm based on a replenished token pool.",
      questionType: "short_explanation",
      requiredKnowledgePoints: [
        "Tokens refill up to a configured bucket capacity.",
        "Each request consumes tokens and insufficient tokens delay or reject requests.",
      ],
      answer: "Tokens refill at a configured rate until the capacity is reached. A request consumes tokens; if the bucket lacks enough, the request is delayed or rejected.",
    });
    expect(evaluation.knowledgePointResults).toHaveLength(2);
  }, 120_000);

  it("generates a question through RecallLoop's built-in deterministic question path", () => {
    const question = buildQuestion("Token bucket rate limiting", "short_explanation", ["Tokens refill up to capacity", "Requests consume tokens"], 2, 0, 0);
    expect(question.prompt.length).toBeGreaterThan(0);
  });

  liveTest("creates Gemini embeddings compatible with persistence and retrieval", async () => {
    requireGeminiConfig();
    const embeddings = new OpenAiCompatibleEmbeddingProvider(
      "https://generativelanguage.googleapis.com/v1beta/openai/",
      "gemini-embedding-001",
      env.llmApiKey,
    );
    const [vector] = await embeddings.embed(["A token bucket limits request rates using a refillable token pool."]);
    expect(vector).toHaveLength(3072);
    expect(vector.every(Number.isFinite)).toBe(true);
  }, 120_000);

  liveTest("generates schema-validated grounded remediation", async () => {
    requireGeminiConfig();
    const llm = new OpenAiCompatibleProvider();
    const remediator = new LlmGroundedRemediator(llm);
    const remediation = await remediator.generate({
      conceptName: "Token bucket rate limiting",
      knowledgePoint: "Each request consumes tokens from the bucket.",
      whyThis: "The latest recall missed how requests use tokens.",
      evaluationEvidence: { status: "missing", feedback: "The request consumption rule was missing.", mistakes: [], confidence: null },
      sources: [{
        sourceId: "smoke-source",
        chunkId: "smoke-chunk",
        title: "Token bucket notes",
        reference: "local-smoke-test",
        sourceType: "text",
        relevance: 1,
        text: "A token bucket accumulates tokens at a configured refill rate up to a capacity. Each incoming request consumes tokens from the bucket. If the bucket lacks enough tokens, the system delays or rejects that request.",
      }],
    });
    expect(remediation.title.length).toBeGreaterThan(2);
    expect(remediation.explanation.length).toBeGreaterThan(19);
    expect(remediation.keyPoints.length).toBeGreaterThan(0);
  }, 120_000);
});
