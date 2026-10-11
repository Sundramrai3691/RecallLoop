import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://recallloop:recallloop@127.0.0.1:5432/recallloop",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  llmProvider: (process.env.LLM_PROVIDER ?? "mock").toLowerCase(),
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
  llmBaseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
  remediationProvider: (process.env.REMEDIATION_PROVIDER ?? "mock").toLowerCase(),
  embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? "mock").toLowerCase(),
  embeddingApiKey: process.env.EMBEDDING_API_KEY ?? "",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  embeddingBaseUrl: process.env.EMBEDDING_BASE_URL ?? "https://api.openai.com/v1",
  jwtSecret: process.env.JWT_SECRET ?? "recallloop-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
};

export function isMockLlm(): boolean {
  if (env.llmProvider === "mock") return true;
  if (!env.llmApiKey.trim()) return true;
  return false;
}

export function providerConfiguration() {
  const llm = isMockLlm() ? "mock" : "openai-compatible";
  const embedding = env.embeddingProvider === "mock" ? "deterministic-local" :
    env.embeddingProvider === "openai-compatible" && env.embeddingApiKey.trim() ? "openai-compatible" : "not-configured";
  const remediation = env.remediationProvider === "llm" && llm === "openai-compatible" ? "llm-grounded" : "deterministic-extractive";
  const warnings: string[] = [];
  if (env.llmProvider !== "mock" && !env.llmApiKey.trim()) warnings.push("LLM_API_KEY is empty; extraction and free-form grading use the deterministic mock.");
  if (!new Set(["mock", "openai-compatible"]).has(env.llmProvider)) warnings.push("LLM_PROVIDER is not the documented value; configured non-mock values still select the generic OpenAI-compatible adapter.");
  if (env.embeddingProvider === "openai-compatible" && !env.embeddingApiKey.trim()) warnings.push("EMBEDDING_PROVIDER selects openai-compatible but EMBEDDING_API_KEY is empty.");
  if (env.remediationProvider === "llm" && llm !== "openai-compatible") warnings.push("REMEDIATION_PROVIDER=llm requires a configured non-mock LLM provider.");
  if (!new Set(["mock", "openai-compatible"]).has(env.embeddingProvider)) warnings.push("Unknown EMBEDDING_PROVIDER; deterministic local embeddings are active.");
  if (!new Set(["mock", "llm"]).has(env.remediationProvider)) warnings.push("Unknown REMEDIATION_PROVIDER; deterministic extractive remediation is active.");
  return { llm, llmModel: env.llmModel, extractionAndGrading: llm, embeddings: embedding, embeddingModel: embedding === "openai-compatible" ? env.embeddingModel : null, remediation, warnings };
}
