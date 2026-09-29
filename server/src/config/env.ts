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
  jwtSecret: process.env.JWT_SECRET ?? "recallloop-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
};

export function isMockLlm(): boolean {
  if (env.llmProvider === "mock") return true;
  if (!env.llmApiKey.trim()) return true;
  return false;
}
