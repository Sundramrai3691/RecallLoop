import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unavailable } from "../utils/errors.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
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

const DEVELOPMENT_DATABASE_URL = "postgres://recallloop:recallloop@127.0.0.1:5432/recallloop";
const DEVELOPMENT_JWT_SECRET = "recallloop-dev-secret-change-me";

export function validateRuntimeConfiguration(source: NodeJS.ProcessEnv = process.env): { mode: string; errors: string[]; warnings: string[] } {
  const mode = (source.NODE_ENV ?? "development").trim().toLowerCase();
  const errors: string[] = [];
  const warnings: string[] = [];
  // Any non-local mode must use production-grade settings; naming a deployment
  // "staging" must not bypass the production checks.
  const production = mode !== "development" && mode !== "test";
  if (source.TRUST_PROXY_HOPS && (!/^\d+$/.test(source.TRUST_PROXY_HOPS) || Number(source.TRUST_PROXY_HOPS) > 10)) errors.push("TRUST_PROXY_HOPS must be an integer between 0 and 10.");
  if (production) {
    if (!source.DATABASE_URL?.trim()) errors.push("DATABASE_URL must be explicitly set in production.");
    else {
      try {
        const url = new URL(source.DATABASE_URL);
        if (!new Set(["postgres:", "postgresql:"]).has(url.protocol) || !url.hostname || !url.pathname.slice(1)) errors.push("DATABASE_URL must be a valid PostgreSQL connection URL.");
        if (source.DATABASE_URL === DEVELOPMENT_DATABASE_URL || ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase()) || (url.username === "recallloop" && url.password === "recallloop")) errors.push("DATABASE_URL must not use a local or development database target in production.");
      } catch { errors.push("DATABASE_URL must be a valid PostgreSQL connection URL."); }
    }
    const jwtSecret = source.JWT_SECRET ?? "";
    if (jwtSecret.length < 32 || new Set(jwtSecret).size < 8 || /^(.)\1+$/.test(jwtSecret) || jwtSecret === DEVELOPMENT_JWT_SECRET || /^(changeme|change-me|secret|password|placeholder)/i.test(jwtSecret)) {
      errors.push("JWT_SECRET must be an explicitly configured, non-placeholder secret of at least 32 characters.");
    }
    if (!source.CLIENT_ORIGIN?.trim()) errors.push("CLIENT_ORIGIN must be explicitly set in production.");
    else {
      try {
        const origin = new URL(source.CLIENT_ORIGIN);
        if (origin.protocol !== "https:" || origin.origin !== source.CLIENT_ORIGIN) errors.push("CLIENT_ORIGIN must be one exact HTTPS origin in production.");
      } catch { errors.push("CLIENT_ORIGIN must be one exact HTTPS origin in production."); }
    }
    for (const name of ["LLM_PROVIDER", "EMBEDDING_PROVIDER", "REMEDIATION_PROVIDER"] as const) {
      if (!source[name]?.trim()) errors.push(`${name} must be explicitly configured in production.`);
    }
    if (source.LLM_PROVIDER && !new Set(["openai-compatible"]).has(source.LLM_PROVIDER.trim().toLowerCase())) errors.push("Production LLM_PROVIDER must select openai-compatible.");
    if (source.EMBEDDING_PROVIDER && !new Set(["openai-compatible"]).has(source.EMBEDDING_PROVIDER.trim().toLowerCase())) errors.push("Production EMBEDDING_PROVIDER must select openai-compatible.");
    if (source.REMEDIATION_PROVIDER && !new Set(["llm"]).has(source.REMEDIATION_PROVIDER.trim().toLowerCase())) errors.push("Production REMEDIATION_PROVIDER must select llm.");
    if (source.LLM_PROVIDER?.trim().toLowerCase() === "mock") errors.push("LLM_PROVIDER=mock is development/test only.");
    if (source.EMBEDDING_PROVIDER?.trim().toLowerCase() === "mock") errors.push("EMBEDDING_PROVIDER=mock is development/test only.");
    if (source.REMEDIATION_PROVIDER?.trim().toLowerCase() === "mock") errors.push("REMEDIATION_PROVIDER=mock is development/test only.");
    if (source.LLM_PROVIDER?.trim().toLowerCase() === "openai-compatible" && !source.LLM_API_KEY?.trim()) errors.push("LLM_API_KEY is required for the selected production LLM provider.");
    if (source.EMBEDDING_PROVIDER?.trim().toLowerCase() === "openai-compatible" && !source.EMBEDDING_API_KEY?.trim()) errors.push("EMBEDDING_API_KEY is required for the selected production embedding provider.");
    if (source.REMEDIATION_PROVIDER?.trim().toLowerCase() === "llm" && source.LLM_PROVIDER?.trim().toLowerCase() !== "openai-compatible") errors.push("REMEDIATION_PROVIDER=llm requires the openai-compatible LLM provider.");
    if (!/^[1-9]\d*(?:s|m|h|d|w|y)$/i.test(source.JWT_EXPIRES_IN ?? "7d")) errors.push("JWT_EXPIRES_IN must be a positive duration with an explicit unit.");
    for (const name of ["LLM_BASE_URL", "EMBEDDING_BASE_URL"] as const) {
      if (!source[name]) continue;
      try { if (new URL(source[name]!).protocol !== "https:") errors.push(`${name} must use HTTPS in production.`); }
      catch { errors.push(`${name} must be a valid HTTPS URL in production.`); }
    }
    if (source.PORT !== undefined && (!/^\d+$/.test(source.PORT) || Number(source.PORT) < 1 || Number(source.PORT) > 65535)) errors.push("PORT must be between 1 and 65535.");
  } else {
    if (!source.DATABASE_URL) warnings.push("DATABASE_URL is using the local development default.");
    if (!source.JWT_SECRET) warnings.push("JWT_SECRET is using the development-only default; set a private value outside local development.");
  }
  return { mode, errors, warnings };
}

export function assertRuntimeConfiguration(source: NodeJS.ProcessEnv = process.env): void {
  const validation = validateRuntimeConfiguration(source);
  if (!new Set(["development", "test"]).has(validation.mode) && validation.errors.length) {
    throw new Error(`Invalid production configuration: ${validation.errors.join(" ")}`);
  }
}

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
