import { env } from "../config/env.js";
import { postgres } from "../db/postgres.js";
import { seedCanonicalQuestionBank } from "../db/seedCanonicalQuestionBank.js";
import { canonicalDbmsQuestions } from "../services/questionBank/coreSdeQuestionBank.js";

function assertConfiguredLocalDatabase() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL must be explicitly configured; refusing a fallback target.");
  const target = new URL(env.databaseUrl);
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(target.hostname) || target.pathname !== "/recallloop") {
    throw new Error("DBMS question seeding is restricted to the configured loopback /recallloop database.");
  }
}

try {
  assertConfiguredLocalDatabase();
  const identity = await postgres.query<{ database_name: string; server_address: string | null }>(
    "SELECT current_database() AS database_name, inet_server_addr()::text AS server_address",
  );
  if (identity.rows[0]?.database_name !== "recallloop") throw new Error("Connected database identity did not match recallloop; refusing to seed.");
  console.log(`Seeding ${canonicalDbmsQuestions.length} DBMS candidates into configured local database ${identity.rows[0].database_name}.`);
  await seedCanonicalQuestionBank(canonicalDbmsQuestions);
  console.log("Scoped DBMS candidate seeding completed.");
} finally {
  await postgres.end();
}
