import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ["tests/integration/**/*.test.ts"],
    env: {
      LLM_PROVIDER: "mock",
      LLM_API_KEY: "",
      EMBEDDING_PROVIDER: "mock",
      REMEDIATION_PROVIDER: "mock",
    },
  },
});
