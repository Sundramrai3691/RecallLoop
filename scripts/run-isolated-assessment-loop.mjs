import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
const configuredUrl = new URL(process.env.DATABASE_URL ?? "postgres://recallloop:recallloop@127.0.0.1:5432/recallloop");
if (!["127.0.0.1", "localhost", "::1"].includes(configuredUrl.hostname)) throw new Error("Assessment-loop integration requires a loopback PostgreSQL server; remote database targets are refused.");
const databaseName = `recallloop_u2_it_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const maintenanceUrl = new URL(configuredUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedUrl = new URL(configuredUrl);
isolatedUrl.pathname = `/${databaseName}`;
const admin = new Pool({ connectionString: maintenanceUrl.toString() });
const env = { ...process.env, DATABASE_URL: isolatedUrl.toString(), RECALLLOOP_E2E_ISOLATED: "1", LLM_PROVIDER: "mock", LLM_API_KEY: "", EMBEDDING_PROVIDER: "mock", REMEDIATION_PROVIDER: "mock" };
let created = false;

function run(command, args) {
  execFileSync(command, args, { cwd: root, env, stdio: "inherit", windowsHide: true });
}

function runNpm(args) {
  if (!process.env.npm_execpath) throw new Error("Run this command through npm so the local npm executable can be resolved safely.");
  run(process.execPath, [process.env.npm_execpath, ...args]);
}

try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  console.log("Created a disposable loopback PostgreSQL database for this test run.");
  runNpm(["run", "db:migrate", "-w", "server"]);
  runNpm(["run", "db:seed", "-w", "server"]);
  runNpm(["run", "test:integration", "-w", "server"]);

  const isolated = new Pool({ connectionString: isolatedUrl.toString() });
  try {
    const users = await isolated.query(`INSERT INTO app_users(email,password_hash,name)
      VALUES('u2-fixture-reviewer@test.invalid','test-only','Disposable U2 test reviewer'),('u2-fixture-grantor@test.invalid','test-only','Disposable U2 test grantor') RETURNING id`);
    const reviewerId = users.rows[0].id;
    const grantorId = users.rows[1].id;
    await isolated.query(`INSERT INTO canonical_question_reviewers(reviewer_user_id,granted_by_user_id,grant_note) VALUES($1,$2,'Test-only fixture grant in disposable U2 database')`, [reviewerId, grantorId]);
    const criteria = (type) => ({ technical_correctness: "pass", expected_answer: "pass", explanation: type === "mcq" ? "pass" : "not_applicable", mcq_key: type === "mcq" ? "pass" : "not_applicable", distractors: type === "mcq" ? "pass" : "not_applicable", rubric: type === "mcq" ? "not_applicable" : "pass", point_mapping: "pass", cognitive_level_difficulty: "pass", source_attribution_license: "pass" });
    const slugs = ["http-cache-recognition-freshness-directive", "http-cache-analysis-no-cache-vs-no-store", "http-cache-recall-no-cache", "http-cache-recall-304-body", "http-cache-recall-validators", "http-cache-explanation-cache-paths"];
    for (const slug of slugs) {
      const result = await isolated.query(`SELECT r.id,r.question_type,r.content_hash FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision WHERE i.slug=$1 AND r.quality_status='valid'`, [slug]);
      if (!result.rows[0]) throw new Error(`${slug}: required test fixture revision is missing or fails engineering validation.`);
      const revision = result.rows[0];
      await isolated.query(`INSERT INTO canonical_question_reviews(question_revision_id,reviewer_user_id,decision,content_hash,criteria,review_notes)
        VALUES($1,$2,'approved',$3,$4,'Test-only simulated approval; not a human subject-matter decision.')`, [revision.id, reviewerId, revision.content_hash, JSON.stringify(criteria(revision.question_type))]);
      await isolated.query(`UPDATE canonical_question_revisions SET review_status='subject_matter_reviewed',publication_status='published' WHERE id=$1`, [revision.id]);
    }
    console.log("Added six explicitly test-only exact-revision approvals to the disposable database, including one unseen verification question.");
  } finally { await isolated.end(); }
  runNpm(["run", "test:e2e"]);
  console.log("PASS isolated assessment-loop workflow; disposable database is scheduled for deletion.");
} finally {
  await admin.end();
  if (created) {
    const cleanup = new Pool({ connectionString: maintenanceUrl.toString() });
    try {
      await cleanup.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()", [databaseName]);
      await cleanup.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      console.log("Removed the disposable U2 database and all test-only learner/reviewer records.");
    } finally { await cleanup.end(); }
  }
}
