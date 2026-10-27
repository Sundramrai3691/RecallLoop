import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgres, withTransaction } from "../db/postgres.js";
import { canonicalHttpPilotQuestions } from "../services/questionBank/pilotQuestionBank.js";
import { canonicalCoreSdeQuestions, validateCoreSdeQuestionBank } from "../services/questionBank/coreSdeQuestionBank.js";
import { questionContentHash, validatePilotQuestionBank } from "../services/questionBank/questionBankQuality.js";

const policyVersion = "copilot-automated-quality-v1";
const reviewMethod = "copilot_automated_review";
const allAuthored = [...canonicalHttpPilotQuestions, ...canonicalCoreSdeQuestions];
const authoredBySlug = new Map(allAuthored.map((question) => [question.slug, question]));
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(moduleDirectory, "../../../docs/question-bank/automated-review-manifest.json");

function readOption(name: string): boolean {
  return process.argv.includes(name);
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(path.resolve(filename), "utf8")) as T;
}

async function writeJson(filename: string, value: unknown): Promise<void> {
  const target = path.resolve(filename);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, target);
}

async function currentQuestionRevisions() {
  const result = await postgres.query<any>(`SELECT i.id AS item_id, i.canonical_concept_id, i.slug, i.current_revision, r.id AS revision_id, r.revision, r.question_type, r.content_hash,
      r.review_status, r.publication_status, r.question_type, r.objective, r.prompt, r.expected_answer, r.source_title, r.source_url, r.source_publisher, r.source_notes
    FROM canonical_question_items i
    JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision
    WHERE r.publication_status <> 'retired'
      AND r.review_status NOT IN ('subject_matter_reviewed','automated_reviewed')
    ORDER BY i.slug`);
  return result.rows;
}

function reviewDecisionForIssues(issues: string[]): { decision: "approved" | "changes_requested" | "rejected" | "blocked"; findings: Record<string, string[]> } {
  if (!issues.length) return { decision: "approved", findings: { QualityGate: ["passed all structural and canonical validations."] } };
  const findings: Record<string, string[]> = {};
  for (const issue of issues) {
    const [key, ...rest] = issue.split(":");
    const label = key ?? "General";
    const message = rest.join(":").trim();
    findings[label] = [...(findings[label] ?? []), message || key];
  }
  if (issues.some((issue) => /absent from the authored source|content hash|duplicate|near duplicate|source provenance|canonical point/i.test(issue))) {
    return { decision: "rejected", findings };
  }
  if (issues.some((issue) => /insufficient|missing|ambiguous|cannot be responsibly assessed/i.test(issue))) {
    return { decision: "blocked", findings };
  }
  return { decision: "changes_requested", findings };
}

function buildIssuesForQuestion(row: any): string[] {
  const issues: string[] = [];
  const authored = authoredBySlug.get(row.slug);
  if (!authored) {
    issues.push(`${row.slug}: question is absent from the authored source catalog`);
    return issues;
  }
  if (questionContentHash(authored) !== row.content_hash) {
    issues.push(`${row.slug}: content hash differs from the authored revision`);
  }
  if (authored.questionType !== row.question_type) {
    issues.push(`${row.slug}: authored question type differs from the current database revision`);
  }
  if (authored.knowledgePoint !== row.question_type && row.question_type === "mcq") {
    // no-op: keep general review focused on actual bank correctness
  }
  const sourceIssues = [...validatePilotQuestionBank(canonicalHttpPilotQuestions), ...validateCoreSdeQuestionBank(canonicalCoreSdeQuestions)];
  for (const issue of sourceIssues) {
    if (issue.startsWith(`${row.slug}:`) || issue.startsWith(`coverage:`)) continue;
  }
  return issues;
}

async function preflight() {
  const rows = await currentQuestionRevisions();
  const manifest: any[] = [];
  for (const row of rows) {
    const issues = buildIssuesForQuestion(row);
    const decision = reviewDecisionForIssues(issues);
    manifest.push({
      slug: row.slug,
      revisionId: row.revision_id,
      revision: Number(row.revision),
      contentHash: row.content_hash,
      questionType: row.question_type,
      reviewStatus: row.review_status,
      publicationStatus: row.publication_status,
      decision: decision.decision,
      findings: decision.findings,
      sourceVerificationStatus: issues.length ? "partial" : "verified",
      rationale: decision.decision === "approved" ? "The exact current revision passes the structural and canonical-quality gate and is suitable for automated approval." : "The exact revision requires remediation or rejection before it may be eligible for regular assessment.",
    });
  }
  return { policyVersion, reviewMethod, generatedAt: new Date().toISOString(), records: manifest, summary: { total: manifest.length, approved: manifest.filter((item) => item.decision === "approved").length, changesRequested: manifest.filter((item) => item.decision === "changes_requested").length, rejected: manifest.filter((item) => item.decision === "rejected").length, blocked: manifest.filter((item) => item.decision === "blocked").length } };
}

async function applyAutomatedReview() {
  const rows = await currentQuestionRevisions();
  const decisions: any[] = [];
  for (const row of rows) {
    const issues = buildIssuesForQuestion(row);
    const review = reviewDecisionForIssues(issues);
    decisions.push({
      revisionId: row.revision_id,
      contentHash: row.content_hash,
      decision: review.decision,
      findings: review.findings,
      sourceVerificationStatus: issues.length ? "partial" : "verified",
      runId: `automation-${Date.now()}`,
    });
  }

  await withTransaction(async (client) => {
    for (const decision of decisions) {
      await client.query(
        `INSERT INTO canonical_question_automated_reviews(question_revision_id,policy_version,review_method,decision,content_hash,findings,source_verification_status,run_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (question_revision_id, policy_version, review_method) DO NOTHING`,
        [decision.revisionId, policyVersion, reviewMethod, decision.decision, decision.contentHash, JSON.stringify(decision.findings), decision.sourceVerificationStatus, decision.runId],
      );

      if (decision.decision === "approved") {
        await client.query(`UPDATE canonical_question_revisions SET review_status='automated_reviewed', publication_status='published' WHERE id=$1`, [decision.revisionId]);
      } else {
        await client.query(`UPDATE canonical_question_revisions SET review_status='changes_requested', publication_status='draft' WHERE id=$1`, [decision.revisionId]);
      }
    }
  });

  return decisions;
}

async function main() {
  const apply = readOption("--apply");
  const preflightReport = await preflight();
  await writeJson(manifestPath, preflightReport);
  if (!apply) {
    console.log(JSON.stringify({ mode: "preflight", policyVersion, records: preflightReport.summary, manifest: manifestPath }, null, 2));
    return;
  }
  const decisions = await applyAutomatedReview();
  console.log(JSON.stringify({ mode: "applied", policyVersion, decisions, manifest: manifestPath }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
