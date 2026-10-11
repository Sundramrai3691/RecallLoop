import { afterEach, describe, expect, it } from "vitest";
import { env, isMockLlm, providerConfiguration } from "./env.js";
import { createEmbeddingProvider } from "../services/grounding/embeddingProvider.js";
import { createGroundedRemediator } from "../services/grounding/remediationGenerator.js";

const original = {
  llmProvider: env.llmProvider,
  llmApiKey: env.llmApiKey,
  embeddingProvider: env.embeddingProvider,
  embeddingApiKey: env.embeddingApiKey,
  embeddingModel: env.embeddingModel,
  embeddingBaseUrl: env.embeddingBaseUrl,
  remediationProvider: env.remediationProvider,
};

afterEach(() => Object.assign(env, original));

describe("provider configuration", () => {
  it("uses mock only when mock is explicitly selected", () => {
    env.llmProvider = "mock";
    env.llmApiKey = "";
    expect(isMockLlm()).toBe(true);
  });

  it("fails clearly instead of silently falling back for an unsupported or incomplete LLM provider", () => {
    env.llmProvider = "openai";
    expect(() => isMockLlm()).toThrow(/Unsupported LLM_PROVIDER/);
    env.llmProvider = "openai-compatible";
    env.llmApiKey = " ";
    expect(() => isMockLlm()).toThrow(/refusing to fall back to mock mode/);
  });

  it("recognizes the Gemini-compatible configuration without exposing its key", () => {
    Object.assign(env, {
      llmProvider: "openai-compatible",
      llmApiKey: "test-key",
      embeddingProvider: "openai-compatible",
      embeddingApiKey: "test-key",
      embeddingModel: "gemini-embedding-001",
      embeddingBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      remediationProvider: "llm",
    });
    expect(providerConfiguration()).toMatchObject({ llm: "openai-compatible", extractionAndGrading: "openai-compatible", embeddings: "openai-compatible", embeddingModel: "gemini-embedding-001", remediation: "llm-grounded", warnings: [] });
  });

  it("rejects unknown embedding and remediation values instead of selecting deterministic providers", () => {
    env.embeddingProvider = "openai";
    expect(() => createEmbeddingProvider()).toThrow(/Unsupported EMBEDDING_PROVIDER/);
    env.remediationProvider = "openai";
    expect(() => createGroundedRemediator()).toThrow(/Unsupported REMEDIATION_PROVIDER/);
  });
});
