import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/connect.js";
import { disconnectDatabase } from "./db/connect.js";
import { assertRuntimeConfiguration } from "./config/env.js";
import { installGracefulShutdown } from "./observability/gracefulShutdown.js";

async function main() {
  assertRuntimeConfiguration();
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`RecallLoop API listening on http://localhost:${env.port}`);
    console.log(`LLM mode: ${env.llmApiKey && env.llmProvider !== "mock" ? "live" : "mock"}`);
  });
  installGracefulShutdown(server, disconnectDatabase);
}

main().catch((err) => {
  const code = err instanceof Error && err.message.startsWith("Invalid production configuration:") ? "CONFIGURATION_INVALID" : "STARTUP_FAILED";
  console.error(JSON.stringify({ event: "server.startup_failure", code }));
  process.exit(1);
});
