import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/connect.js";

async function main() {
  await connectDatabase();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`RecallLoop API listening on http://localhost:${env.port}`);
    console.log(`LLM mode: ${env.llmApiKey && env.llmProvider !== "mock" ? "live" : "mock"}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err instanceof Error ? err.message : err);
  process.exit(1);
});
