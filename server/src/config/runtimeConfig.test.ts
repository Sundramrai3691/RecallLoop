import { describe, expect, it } from "vitest";
import { assertRuntimeConfiguration, validateRuntimeConfiguration } from "./env.js";

const productionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://app-user:private-value@db.internal:5432/recallloop",
  JWT_SECRET: "a-long-random-secret-value-at-least-32-chars",
  JWT_EXPIRES_IN: "7d",
  CLIENT_ORIGIN: "https://learn.example.com",
  LLM_PROVIDER: "openai-compatible",
  LLM_API_KEY: "private-llm-value",
  EMBEDDING_PROVIDER: "openai-compatible",
  EMBEDDING_API_KEY: "private-embedding-value",
  REMEDIATION_PROVIDER: "llm",
};

describe("runtime configuration policy", () => {
  it("rejects missing and known development-only production defaults without echoing secrets", () => {
    const { errors } = validateRuntimeConfiguration({ NODE_ENV: "production", DATABASE_URL: "postgres://recallloop:recallloop@127.0.0.1:5432/recallloop", CLIENT_ORIGIN: "http://localhost:5173", LLM_PROVIDER: "mock", EMBEDDING_PROVIDER: "mock", REMEDIATION_PROVIDER: "mock" });
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("DATABASE_URL"),
      expect.stringContaining("JWT_SECRET"),
      expect.stringContaining("CLIENT_ORIGIN"),
      expect.stringContaining("LLM_PROVIDER"),
      expect.stringContaining("EMBEDDING_PROVIDER"),
      expect.stringContaining("REMEDIATION_PROVIDER"),
    ]));
    expect(errors.join(" ")).not.toContain("recallloop:recallloop");
  });

  it("applies production requirements to staging and rejects loopback or low-diversity signing secrets", () => {
    const staging = validateRuntimeConfiguration({ ...productionEnv, NODE_ENV: "staging", DATABASE_URL: "postgres://app:password@127.0.0.1:5432/recallloop", JWT_SECRET: "a".repeat(48) });
    expect(staging.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("DATABASE_URL"),
      expect.stringContaining("JWT_SECRET"),
    ]));
    expect(validateRuntimeConfiguration({ ...productionEnv, NODE_ENV: "staging" }).errors).toEqual([]);
  });

  it("fails startup preflight before any database call for an unsafe production configuration", () => {
    expect(() => assertRuntimeConfiguration({ NODE_ENV: "production" })).toThrow(/Invalid production configuration:.*DATABASE_URL.*JWT_SECRET/);
  });

  it("accepts an explicit HTTPS production configuration and never prints credentials", () => {
    expect(validateRuntimeConfiguration(productionEnv)).toEqual({ mode: "production", errors: [], warnings: [] });
    expect(JSON.stringify(validateRuntimeConfiguration(productionEnv))).not.toContain("private-");
  });

  it("keeps the local development configuration usable but warns about implicit defaults", () => {
    expect(validateRuntimeConfiguration({}).warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("DATABASE_URL"),
      expect.stringContaining("JWT_SECRET"),
    ]));
  });
});
