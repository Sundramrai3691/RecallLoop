import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgres, runPostgresMigration } from "../../src/db/postgres.js";

describe("PostgreSQL runtime integration", () => {
  beforeAll(async () => {
    await runPostgresMigration();
  });

  afterAll(async () => {
    await postgres.end();
  });

  it("applies relational schema and exposes core tables", async () => {
    const result = await postgres.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('app_users','goals','study_sessions','recall_attempts','recall_evaluations','review_states','canonical_concepts','baseline_assessments','resources','questions','assessment_sessions','recall_dimension_results')`);
    expect(result.rows.length).toBe(12);
  });
});
