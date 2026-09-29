import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/connect.js";
import { disconnectDatabase } from "./db/connect.js";

async function main() {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`RecallLoop API listening on http://localhost:${env.port}`);
    console.log(`LLM mode: ${env.llmApiKey && env.llmProvider !== "mock" ? "live" : "mock"}`);
  });
  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err instanceof Error ? err.message : err);
  process.exit(1);
});
