import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unavailable } from "../utils/errors.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://recallloop:recallloop@127.0.0.1:5432/recallloop",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  llmProvider: (process.env.LLM_PROVIDER ?? "mock").trim().toLowerCase(),
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
  llmBaseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
  remediationProvider: (process.env.REMEDIATION_PROVIDER ?? "mock").trim().toLowerCase(),
  embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? "mock").trim().toLowerCase(),
  embeddingApiKey: process.env.EMBEDDING_API_KEY ?? "",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  embeddingBaseUrl: process.env.EMBEDDING_BASE_URL ?? "https://api.openai.com/v1",
  jwtSecret: process.env.JWT_SECRET ?? "recallloop-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
};

export function isMockLlm(): boolean {
  if (env.llmProvider === "mock") return true;
  if (env.llmProvider !== "openai-compatible") {
    throw unavailable(
      `Unsupported LLM_PROVIDER=${env.llmProvider}. Use mock or openai-compatible.`,
      "LLM_PROVIDER_UNSUPPORTED",
    );
  }
  if (!env.llmApiKey.trim()) {
    throw unavailable(
      "LLM_PROVIDER=openai-compatible requires LLM_API_KEY; refusing to fall back to mock mode.",
      "LLM_NOT_CONFIGURED",
    );
  }
  return false;
}

export function providerConfiguration() {
  const llm = env.llmProvider === "mock" ? "mock" :
    env.llmProvider === "openai-compatible" && env.llmApiKey.trim() ? "openai-compatible" : "not-configured";
  const embedding = env.embeddingProvider === "mock" ? "deterministic-local" :
    env.embeddingProvider === "openai-compatible" && env.embeddingApiKey.trim() ? "openai-compatible" : "not-configured";
  const remediation = env.remediationProvider === "mock" ? "deterministic-extractive" :
    env.remediationProvider === "llm" && llm === "openai-compatible" ? "llm-grounded" : "not-configured";
  const warnings: string[] = [];
  if (env.llmProvider === "openai-compatible" && !env.llmApiKey.trim()) warnings.push("LLM_PROVIDER=openai-compatible requires LLM_API_KEY; no mock fallback is selected.");
  if (!new Set(["mock", "openai-compatible"]).has(env.llmProvider)) warnings.push("Unsupported LLM_PROVIDER; use mock or openai-compatible.");
  if (env.embeddingProvider === "openai-compatible" && !env.embeddingApiKey.trim()) warnings.push("EMBEDDING_PROVIDER=openai-compatible requires EMBEDDING_API_KEY.");
  if (!new Set(["mock", "openai-compatible"]).has(env.embeddingProvider)) warnings.push("Unsupported EMBEDDING_PROVIDER; use mock or openai-compatible.");
  if (env.remediationProvider === "llm" && llm !== "openai-compatible") warnings.push("REMEDIATION_PROVIDER=llm requires LLM_PROVIDER=openai-compatible and a nonempty LLM_API_KEY.");
  if (!new Set(["mock", "llm"]).has(env.remediationProvider)) warnings.push("Unsupported REMEDIATION_PROVIDER; use mock or llm.");
  return { llm, llmModel: env.llmModel, extractionAndGrading: llm, embeddings: embedding, embeddingModel: embedding === "openai-compatible" ? env.embeddingModel : null, remediation, warnings };
}
