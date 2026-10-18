import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgres, withTransaction } from "../db/postgres.js";
import { verifyToken } from "../lib/auth.js";
import { canonicalHttpPilotQuestions } from "../services/questionBank/pilotQuestionBank.js";
import { pilotQuestionInventory, questionContentHash, validatePilotQuestionBank } from "../services/questionBank/questionBankQuality.js";
import { benchmarkAnnotationStatus, buildHumanBenchmarkReport, reviewCriterionKeys, validateHumanBenchmark, validateReviewAssessment, type HumanBenchmarkDataset } from "../services/questionBank/questionBankGovernance.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const docsDirectory = path.resolve(moduleDirectory, "../../../docs/question-bank");
const inventoryPath = path.join(docsDirectory, "http-pilot-review-inventory.json");
const benchmarkPath = path.resolve(moduleDirectory, "../services/questionBank/httpHumanBenchmark.json");
const suspectedIssues: Record<string, string[]> = {
  "http-cache-transfer-validator-limit": ["Human judgment requested: clarify which stale-serving policies count as acceptable when origin directives and product risk constraints differ."],
  "http-lifecycle-application-async-create": ["Human judgment requested: define which response fields or status-monitor conventions are required versus merely defensible."],
  "http-lifecycle-transfer-connection-independence": ["Human judgment requested: check whether the persistent-TCP-to-multiplexed-connection setup makes the intended transport-independence objective sufficiently clear."],
};

function readOption(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(path.resolve(filename), "utf8")) as T;
}

async function writeJson(filename: string, value: unknown): Promise<void> {
  const target = path.resolve(filename);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

async function activeReviewer() {
  const token = process.env.RECALLLOOP_REVIEWER_TOKEN?.trim();
  if (!token) throw new Error("Set RECALLLOOP_REVIEWER_TOKEN to a current RecallLoop bearer token; the token is never written to packets or output.");
  const identity = verifyToken(token);
  const result = await postgres.query<{ id: string }>(`SELECT u.id FROM app_users u JOIN canonical_question_reviewers g ON g.reviewer_user_id=u.id
    WHERE u.id=$1 AND lower(u.email)=lower($2) AND g.revoked_at IS NULL`, [identity.id, identity.email]);
  if (!result.rows[0]) throw new Error("This authenticated account is not an active canonical question reviewer.");
  return result.rows[0].id;
}

function expectedCriterionTemplate() {
  return Object.fromEntries(reviewCriterionKeys.map((key) => [key, null]));
}

function questionPacketContent(row: any) {
  return {
    type: row.question_type,
    cognitiveLevel: row.assessment_level,
    difficulty: Number(row.difficulty),
    objective: row.objective,
    title: row.title,
    context: row.context,
    prompt: row.prompt,
    expectedAnswer: row.expected_answer,
    rubric: row.rubric,
    expectedMisconceptions: row.expected_misconceptions,
    options: row.options,
    correctOptionId: row.correct_option_id,
    correctOptionText: row.options?.find((option: any) => option.id === row.correct_option_id)?.text ?? null,
    explanation: row.explanation,
    distractorRationales: row.distractor_rationales,
    hints: row.hints,
    canonicalPoints: row.mapped_points,
    source: { origin: row.question_origin, title: row.source_title, url: row.source_url, publisher: row.source_publisher, permissionNote: row.source_license, accessedOn: row.source_accessed_on, notes: row.source_notes },
  };
}

async function currentRows() {
  const result = await postgres.query<any>(`SELECT i.id AS item_id,i.canonical_concept_id,i.slug,i.current_revision,r.id AS revision_id,r.revision,r.content_hash,
      r.question_type,r.assessment_level,r.difficulty,r.objective,r.title,r.context,r.prompt,r.expected_answer,r.rubric,
      r.expected_misconceptions,r.estimated_minutes,r.options,r.correct_option_id,r.explanation,r.distractor_rationales,
      r.hints,r.question_origin,r.source_title,r.source_url,r.source_publisher,r.source_license,r.source_accessed_on,r.source_notes,
      r.review_status,r.quality_status,r.publication_status,
      coalesce(jsonb_agg(jsonb_build_object('id',kp.id,'statement',kp.statement)) FILTER (WHERE kp.id IS NOT NULL),'[]'::jsonb) AS mapped_points,
      (SELECT count(*)::int FROM canonical_question_reviews cr WHERE cr.question_revision_id=r.id) AS review_count,
      (SELECT cr.decision FROM canonical_question_reviews cr WHERE cr.question_revision_id=r.id ORDER BY cr.reviewed_at DESC,cr.id DESC LIMIT 1) AS latest_review_decision
    FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision
    LEFT JOIN canonical_question_revision_points rp ON rp.question_revision_id=r.id
    LEFT JOIN knowledge_points kp ON kp.id=rp.canonical_knowledge_point_id
    WHERE i.slug LIKE 'http-%' GROUP BY i.id,r.id ORDER BY i.slug`);
  return result.rows;
}

function groupIssues(issues: string[], slug: string): string[] {
  return issues.filter((issue) => issue.startsWith(`${slug}:`));
}

async function runInventory(writeToDocs = false) {
  const authored = new Map(canonicalHttpPilotQuestions.map((question) => [question.slug, question]));
  const issues = validatePilotQuestionBank();
  const rows: any[] = await currentRows();
  const questions: any[] = rows.map((row: any) => {
    const source = authored.get(row.slug);
    const questionIssues = groupIssues(issues, row.slug);
    if (!source) questionIssues.push(`${row.slug}: database revision is absent from the authored pilot source`);
    else {
      if (source.revision !== Number(row.revision)) questionIssues.push(`${row.slug}: authored revision ${source.revision} differs from database current revision ${row.revision}`);
      if (questionContentHash(source) !== row.content_hash) questionIssues.push(`${row.slug}: authored content hash differs from database current revision`);
      if (row.mapped_points.length !== 1 || row.mapped_points[0].statement !== source.knowledgePoint) questionIssues.push(`${row.slug}: canonical point UUID mapping does not match the authored point`);
    }
    const revision = source ? `${source.slug}@${source.revision}` : `${row.slug}@${row.revision}`;
    return {
      revisionKey: revision,
      revisionUuid: row.revision_id,
      contentHash: row.content_hash,
      questionSlug: row.slug,
      canonicalConceptId: row.canonical_concept_id,
      canonicalConcept: source?.canonicalConceptName ?? null,
      canonicalPoint: row.mapped_points.map((point: any) => ({ id: point.id, statement: point.statement })),
      questionType: row.question_type,
      cognitiveLevel: row.assessment_level,
      difficulty: Number(row.difficulty),
      prompt: row.prompt,
      expectedAnswerPresent: Boolean(row.expected_answer?.trim()),
      rubricDimensionIds: Array.isArray(row.rubric) ? row.rubric.map((dimension: any) => dimension.id) : [],
      mcqExplanationPresent: row.question_type !== "mcq" || Boolean(row.explanation?.trim()),
      mcqDistractorRationales: row.question_type === "mcq" ? row.distractor_rationales.length : 0,
      provenance: { title: row.source_title, url: row.source_url, publisher: row.source_publisher, origin: row.question_origin, permissionNote: row.source_license, accessedOn: row.source_accessed_on, notes: row.source_notes, complete: Boolean(row.source_title && row.source_url && row.source_publisher && row.source_license && row.source_accessed_on && row.source_notes) },
      automatedValidation: questionIssues.length ? "failed" : row.quality_status === "valid" ? "passed" : "not_validated",
      automatedValidationIssues: questionIssues,
      humanReviewState: row.review_status,
      publicationState: row.publication_status,
      reviewRecordCount: Number(row.review_count),
      latestRecordedReviewDecision: row.latest_review_decision,
      suspectedHumanReviewIssues: suspectedIssues[row.slug] ?? [],
    };
  });
  const payload = {
    inventoryVersion: 1,
    reportKind: "engineering audit; not subject-matter approval",
    generatedAt: new Date().toISOString(),
    pilotInventory: pilotQuestionInventory(),
    databaseCounts: { currentQuestions: rows.length, questionRevisions: Number((await postgres.query<{ count: number }>(`SELECT count(*)::int AS count FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id WHERE i.slug LIKE 'http-%'`)).rows[0].count) },
    validationSummary: { issueCount: issues.length + questions.reduce((sum: number, item: any) => sum + item.automatedValidationIssues.length, 0), pilotSourceIssues: issues },
    questions,
    humanReviewSummary: {
      awaitingReview: questions.filter((question: any) => question.humanReviewState === "awaiting_subject_matter_review").length,
      independentlyApproved: questions.filter((question: any) => question.humanReviewState === "subject_matter_reviewed" && question.reviewRecordCount > 0 && question.latestRecordedReviewDecision === "approved").length,
      engineeringInspectedSuspectedIssues: Object.values(suspectedIssues).flat().length,
      note: "Suspected issues are prompts for an independent reviewer, not confirmed technical defects.",
    },
  };
  if (writeToDocs) await writeJson(inventoryPath, payload);
  return payload;
}

async function exportReviewPacket(output: string) {
  const inventory = await runInventory();
  const rows = await currentRows();
  const packet = {
    packetVersion: 1,
    packetType: "canonical-question-subject-matter-review",
    generatedAt: new Date().toISOString(),
    instructions: "Review the exact immutable revision. Fill review.decision, review.notes, and every review.criteria field. Approval requires all applicable criteria to pass. Do not add reviewer identity or timestamp; import binds those to the authenticated RecallLoop account and database time.",
    entries: rows.map((row: any) => ({
      revisionId: row.revision_id,
      questionSlug: row.slug,
      revision: Number(row.revision),
      contentHash: row.content_hash,
      canonicalConceptId: row.canonical_concept_id,
      question: questionPacketContent(row),
      automatedAudit: inventory.questions.find((question: any) => question.questionSlug === row.slug)?.automatedValidationIssues ?? [],
      existingReviewStatus: row.review_status,
      review: { decision: null, notes: "", criteria: expectedCriterionTemplate() },
    })),
  };
  await writeJson(output, packet);
  return { output: path.resolve(output), entries: packet.entries.length };
}

async function importReviewPacket(filename: string) {
  const reviewerId = await activeReviewer();
  const packet = await readJson<any>(filename);
  if (packet.packetVersion !== 1 || packet.packetType !== "canonical-question-subject-matter-review" || !Array.isArray(packet.entries)) throw new Error("Unsupported subject-matter review packet format.");
  const decisions = packet.entries.filter((entry: any) => entry.review?.decision);
  if (!decisions.length) throw new Error("No review decisions were filled in the packet.");
  const seen = new Set<string>();
  const authoritativeRows = new Map((await currentRows()).map((row: any) => [row.revision_id, row]));
  for (const entry of decisions) {
    if (seen.has(entry.revisionId)) throw new Error(`${entry.questionSlug}: duplicate decision for revision ${entry.revisionId}`);
    seen.add(entry.revisionId);
    if (!entry.revisionId || !entry.questionSlug || !Number.isInteger(entry.revision) || !/^[0-9a-f]{64}$/.test(entry.contentHash)) throw new Error("Each reviewed entry needs a revision UUID, slug, revision number, and content hash.");
    if (typeof entry.review?.notes !== "string" || entry.review.notes.trim().length < 20) throw new Error(`${entry.questionSlug}: review notes must contain at least 20 characters.`);
    const issues = validateReviewAssessment(entry.question?.type, entry.review.criteria, entry.review.decision);
    if (issues.length) throw new Error(`${entry.questionSlug}: ${issues.join("; ")}`);
  }
  await withTransaction(async (client) => {
    for (const entry of decisions) {
      const exact = await client.query<any>(`SELECT r.id,r.question_type,r.content_hash,r.review_status,r.publication_status,i.slug,r.revision,i.current_revision
        FROM canonical_question_revisions r JOIN canonical_question_items i ON i.id=r.question_item_id
        WHERE r.id=$1 AND i.slug=$2 AND r.revision=$3 FOR UPDATE`, [entry.revisionId,entry.questionSlug,entry.revision]);
      const row = exact.rows[0];
      if (!row || row.content_hash !== entry.contentHash || Number(row.current_revision) !== Number(row.revision)) throw new Error(`${entry.questionSlug}@${entry.revision}: stale packet; current revision or content hash changed. Re-export the packet.`);
      if (entry.question?.type !== row.question_type) throw new Error(`${entry.questionSlug}@${entry.revision}: question type in the packet no longer matches the revision.`);
      const currentContent = authoritativeRows.get(row.id);
      if (!currentContent || JSON.stringify(entry.question) !== JSON.stringify(questionPacketContent(currentContent))) throw new Error(`${entry.questionSlug}@${entry.revision}: review packet question content differs from the authoritative database revision. Re-export the packet.`);
      const decision = entry.review.decision as "approved" | "changes_requested" | "rejected";
      await client.query(`INSERT INTO canonical_question_reviews(question_revision_id,reviewer_user_id,decision,content_hash,criteria,review_notes)
        VALUES($1,$2,$3,$4,$5,$6)`, [row.id,reviewerId,decision,row.content_hash,JSON.stringify(entry.review.criteria),entry.review.notes.trim()]);
      const nextStatus = decision === "approved" ? "subject_matter_reviewed" : decision;
      const publication = decision === "approved" ? "published" : decision === "rejected" ? "retired" : "draft";
      await client.query(`UPDATE canonical_question_revisions SET review_status=$2,publication_status=$3 WHERE id=$1`, [row.id,nextStatus,publication]);
    }
  });
  return { reviewerId, imported: decisions.length, note: "Reviewer identity came from the verified bearer token; review timestamps were assigned by PostgreSQL." };
}

async function exportBenchmarkPacket(output: string) {
  const dataset = await readJson<HumanBenchmarkDataset>(benchmarkPath);
  const issues = validateHumanBenchmark(dataset, canonicalHttpPilotQuestions);
  if (issues.length) throw new Error(`Benchmark dataset validation failed: ${issues.join("; ")}`);
  const cases = [];
  for (const item of dataset.cases) {
    const result = await postgres.query<any>(`SELECT r.id,r.question_type,r.title,r.context,r.prompt,r.expected_answer,r.rubric,i.slug,r.revision,r.content_hash
      FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id
      WHERE i.slug=$1 AND r.revision=$2`, [item.questionSlug,item.revision]);
    const question = result.rows[0];
    if (!question || question.content_hash !== item.contentHash) throw new Error(`${item.caseId}: exact database revision does not match benchmark content hash.`);
    const rubric = Array.isArray(question.rubric) ? question.rubric.filter((dimension: any) => item.rubricDimensionIds.includes(dimension.id)) : [];
    cases.push({ caseId: item.caseId, questionSlug: item.questionSlug, revision: item.revision, revisionId: question.id, contentHash: item.contentHash, canonicalPoint: item.canonicalPoint, question: { type: question.question_type, title: question.title, context: question.context, prompt: question.prompt, expectedAnswerContract: question.expected_answer, rubric }, submittedAnswer: item.answer, rubricDimensionIds: item.rubricDimensionIds, proposedLabelsHidden: true, annotation: { kind: "human", rubricJudgments: Object.fromEntries(item.rubricDimensionIds.map((id) => [id, null])), overallJudgment: null, rationale: "", ambiguityNotes: "" } });
  }
  const packet = { packetVersion: 1, packetType: "canonical-question-human-benchmark-annotation", generatedAt: new Date().toISOString(), instructions: "Do not treat the hidden engineering proposal as ground truth. Provide rubric-level judgments, an overall judgment, and rationale. Import with an authenticated, authorized reviewer token. Set kind=adjudication only after at least two prior reviewer labels disagree.", cases };
  await writeJson(output, packet);
  return { output: path.resolve(output), cases: cases.length };
}

function validateAnnotation(entry: any, dimensions: string[]) {
  const annotation = entry.annotation;
  if (!annotation || !["human", "adjudication"].includes(annotation.kind)) throw new Error(`${entry.caseId}: annotation.kind must be human or adjudication.`);
  const allowedOutcome = ["correct", "partial", "incorrect", "misconception", "ambiguous"];
  const allowedJudgment = ["full_credit", "partial_credit", "insufficient", "ambiguous"];
  if (!allowedOutcome.includes(annotation.overallJudgment)) throw new Error(`${entry.caseId}: overallJudgment is required and invalid.`);
  if (!annotation.rationale?.trim()) throw new Error(`${entry.caseId}: annotation rationale is required.`);
  if (!annotation.rubricJudgments || Object.keys(annotation.rubricJudgments).sort().join("\u0000") !== [...dimensions].sort().join("\u0000")) throw new Error(`${entry.caseId}: rubric judgments must cover exactly ${dimensions.join(", ")}.`);
  if (dimensions.some((id) => !allowedJudgment.includes(annotation.rubricJudgments[id]))) throw new Error(`${entry.caseId}: each rubric judgment must be full_credit, partial_credit, insufficient, or ambiguous.`);
}

async function importBenchmarkPacket(filename: string) {
  const reviewerId = await activeReviewer();
  const packet = await readJson<any>(filename);
  if (packet.packetVersion !== 1 || packet.packetType !== "canonical-question-human-benchmark-annotation" || !Array.isArray(packet.cases)) throw new Error("Unsupported human benchmark annotation packet format.");
  const dataset = await readJson<HumanBenchmarkDataset>(benchmarkPath);
  const reviewerNow = new Date().toISOString();
  const seen = new Set<string>();
  for (const entry of packet.cases.filter((item: any) => item.annotation?.overallJudgment)) {
    if (seen.has(entry.caseId)) throw new Error(`${entry.caseId}: duplicate annotation in packet.`);
    seen.add(entry.caseId);
    const item = dataset.cases.find((candidate) => candidate.caseId === entry.caseId);
    if (!item || item.questionSlug !== entry.questionSlug || item.revision !== entry.revision || item.contentHash !== entry.contentHash) throw new Error(`${entry.caseId}: benchmark case or exact question revision does not match the checked-in dataset.`);
    validateAnnotation(entry,item.rubricDimensionIds);
    const questionRow = await postgres.query<any>(`SELECT r.id,r.content_hash,r.question_type,r.title,r.context,r.prompt,r.expected_answer,r.rubric FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id WHERE i.slug=$1 AND r.revision=$2`, [item.questionSlug,item.revision]);
    const question = questionRow.rows[0];
    if (!question || question.content_hash !== item.contentHash || question.id !== entry.revisionId) throw new Error(`${entry.caseId}: database revision is stale or does not match the exported packet.`);
    const expectedDimensions = [...item.rubricDimensionIds].sort();
    const actualDimensions = [...(entry.rubricDimensionIds ?? [])].sort();
    const expectedRubric = Array.isArray(question.rubric) ? question.rubric.filter((dimension: any) => item.rubricDimensionIds.includes(dimension.id)) : [];
    const expectedQuestion = { type: question.question_type, title: question.title, context: question.context, prompt: question.prompt, expectedAnswerContract: question.expected_answer, rubric: expectedRubric };
    if (entry.submittedAnswer !== item.answer || entry.canonicalPoint !== item.canonicalPoint || JSON.stringify(actualDimensions) !== JSON.stringify(expectedDimensions) || JSON.stringify(entry.question) !== JSON.stringify(expectedQuestion)) {
      throw new Error(`${entry.caseId}: blinded packet content differs from the checked-in answer case or authoritative database question. Re-export the packet.`);
    }
    if (entry.annotation.kind === "human") {
      if (item.humanAnnotations.some((annotation) => annotation.reviewerUserId === reviewerId)) throw new Error(`${entry.caseId}: this reviewer has already annotated the case.`);
    } else {
      if (item.adjudication) throw new Error(`${entry.caseId}: an adjudication is already recorded.`);
      if (item.humanAnnotations.length < 2 || new Set(item.humanAnnotations.map((annotation) => annotation.reviewerUserId)).size < 2) throw new Error(`${entry.caseId}: adjudication requires two distinct human annotations first.`);
      if (benchmarkAnnotationStatus(item) !== "needs_adjudication") throw new Error(`${entry.caseId}: adjudication is only accepted when prior reviewers disagree.`);
      if (item.humanAnnotations.some((annotation) => annotation.reviewerUserId === reviewerId)) throw new Error(`${entry.caseId}: the adjudicator must be independent of the prior reviewers.`);
    }
  }
  if (!seen.size) throw new Error("No completed human annotations were found in the packet.");
  for (const entry of packet.cases.filter((item: any) => item.annotation?.overallJudgment)) {
    const target = dataset.cases.find((item) => item.caseId === entry.caseId)!;
    const record = { reviewerUserId: reviewerId, reviewedAt: reviewerNow, rubricJudgments: entry.annotation.rubricJudgments, overallJudgment: entry.annotation.overallJudgment, rationale: entry.annotation.rationale.trim(), ambiguityNotes: String(entry.annotation.ambiguityNotes ?? "").trim() };
    if (entry.annotation.kind === "human") target.humanAnnotations.push(record);
    else target.adjudication = record;
    target.annotationStatus = benchmarkAnnotationStatus(target);
  }
  const issues = validateHumanBenchmark(dataset,canonicalHttpPilotQuestions);
  if (issues.length) throw new Error(`Imported annotations fail dataset validation: ${issues.join("; ")}`);
  await writeJson(benchmarkPath,dataset);
  return { reviewerId, imported: seen.size, note: "Reviewer identity came from the verified bearer token; annotation timestamp came from the local system clock." };
}

async function main() {
  const command = process.argv[2];
  if (command === "inventory") {
    const result = await runInventory(process.argv.includes("--write"));
    process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
    return;
  }
  if (command === "review-export") {
    const output = readOption("--out"); if (!output) throw new Error("Use review-export --out <packet.json>.");
    process.stdout.write(`${JSON.stringify(await exportReviewPacket(output),null,2)}\n`); return;
  }
  if (command === "review-import") {
    const input = readOption("--in"); if (!input) throw new Error("Use review-import --in <completed-packet.json>.");
    process.stdout.write(`${JSON.stringify(await importReviewPacket(input),null,2)}\n`); return;
  }
  if (command === "benchmark-report") {
    const dataset = await readJson<HumanBenchmarkDataset>(benchmarkPath);
    process.stdout.write(`${JSON.stringify(buildHumanBenchmarkReport(dataset,canonicalHttpPilotQuestions),null,2)}\n`); return;
  }
  if (command === "benchmark-export") {
    const output = readOption("--out"); if (!output) throw new Error("Use benchmark-export --out <packet.json>.");
    process.stdout.write(`${JSON.stringify(await exportBenchmarkPacket(output),null,2)}\n`); return;
  }
  if (command === "benchmark-import") {
    const input = readOption("--in"); if (!input) throw new Error("Use benchmark-import --in <completed-packet.json>.");
    process.stdout.write(`${JSON.stringify(await importBenchmarkPacket(input),null,2)}\n`); return;
  }
  throw new Error("Choose inventory, review-export, review-import, benchmark-report, benchmark-export, or benchmark-import.");
}

main().catch((error) => {
  process.stderr.write(`Question bank workflow failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
}).finally(async () => { await postgres.end(); });
