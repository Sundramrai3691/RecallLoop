import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgres } from "./postgres.js";
import { seedCanonicalQuestionBank } from "./seedCanonicalQuestionBank.js";

try {
  const filename = fileURLToPath(import.meta.url);
  const migrationDirectory = path.resolve(path.dirname(filename), "../../migrations");
  const seeded = await postgres.query<{ seeded: boolean }>(`SELECT EXISTS(SELECT 1 FROM knowledge_domains WHERE name='Backend Engineering') AS seeded`);
  if (!seeded.rows[0]?.seeded) await postgres.query(await fs.readFile(path.join(migrationDirectory, "002_seed_knowledge.sql"), "utf8"));
  // Migration 002 is historical and inserts duplicate knowledge points when
  // explicitly replayed. Reuse its deployed repair migration before seeding
  // revisioned questions, then reapply the additive SDE catalog classification.
  await postgres.query(await fs.readFile(path.join(migrationDirectory, "015_deduplicate_canonical_knowledge_points.sql"), "utf8"));
  await postgres.query(await fs.readFile(path.join(migrationDirectory, "018_core_sde_taxonomy.sql"), "utf8"));
  console.log("PostgreSQL curated knowledge seed applied.");
  await seedCanonicalQuestionBank();
  console.log("Canonical HTTP question pilot applied and validated.");
} finally {
  await postgres.end();
}
