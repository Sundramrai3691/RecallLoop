import { Pool, type PoolClient, type QueryResultRow } from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

export const postgres = new Pool({ connectionString: env.databaseUrl, max: 10 });

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return postgres.query<T>(text, values);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await postgres.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function runPostgresMigration() {
  const filename = fileURLToPath(import.meta.url);
  const migrationDirectory = path.resolve(path.dirname(filename), "../../migrations");
  const files = (await fs.readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => {
      const order = ["003_core_domain.sql", "001_phase3.sql", "002_seed_knowledge.sql", "004_question_engine.sql", "005_assessment_sessions.sql", "006_plan_time_budget.sql", "007_adaptive_planning.sql", "008_application_practice.sql", "009_plan_resource_link.sql", "010_grounded_remediation.sql", "011_structured_question_parts.sql", "012_observed_mastery_is_nullable.sql", "013_study_session_source_url.sql", "014_canonical_study_handoffs.sql", "015_deduplicate_canonical_knowledge_points.sql", "016_canonical_question_bank.sql", "017_question_bank_review_and_approval.sql", "018_core_sde_taxonomy.sql", "019_retire_duplicate_http_core_candidates.sql", "020_automated_question_review.sql", "021_link_network_protocols_to_backend_role.sql", "022_restore_current_automated_question_approvals.sql", "023_dbms_core_points.sql", "024_grounding_web_article_sources.sql", "025_pdf_grounding_sources.sql", "026_docx_grounding_sources.sql", "027_study_session_grounding_source.sql"];
      return order.indexOf(left) - order.indexOf(right);
    });
  for (const file of files) {
    // 002 is a historical seed file, not a schema migration. Replaying it on
    // every migration duplicates the catalog, so apply it only before the
    // original catalog has been initialized.
    if (file === "002_seed_knowledge.sql") {
      const seeded = await postgres.query<{ seeded: boolean }>(`SELECT EXISTS(SELECT 1 FROM knowledge_domains WHERE name='Backend Engineering') AS seeded`);
      if (seeded.rows[0]?.seeded) continue;
    }
    await postgres.query(await fs.readFile(path.join(migrationDirectory, file), "utf8"));
  }
}
