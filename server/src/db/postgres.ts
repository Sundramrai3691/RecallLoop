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
      const order = ["003_core_domain.sql", "001_phase3.sql", "002_seed_knowledge.sql", "004_question_engine.sql", "005_assessment_sessions.sql", "006_plan_time_budget.sql", "007_adaptive_planning.sql", "008_application_practice.sql", "009_plan_resource_link.sql", "010_grounded_remediation.sql"];
      return order.indexOf(left) - order.indexOf(right);
    });
  for (const file of files) {
    await postgres.query(await fs.readFile(path.join(migrationDirectory, file), "utf8"));
  }
}
