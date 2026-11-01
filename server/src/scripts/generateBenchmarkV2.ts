import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createV2Case, renderBlindReviewerPack } from "../services/evaluator/benchmarkReviewPacks.js";
import { buildAdjudicationReport, type AnnotationLedger } from "../services/evaluator/benchmarkAnnotationWorkflow.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const out = path.join(root, "docs/research/ai-evaluation-v2");
const v1 = JSON.parse(await readFile(path.join(root, "server/src/services/evaluator/benchmarkDataset.v1.json"), "utf8"));
const reviewedAt = "2026-11-01";
const auditFlags = (item: any): string[] => {
  const flags: string[] = [];
  if (JSON.stringify(item.sourceQuestion.rubric) === JSON.stringify(v1.cases[0].sourceQuestion.rubric)) flags.push("generic_single_criterion_rubric_requires_domain_review");
  if (item.learnerAnswer.text.trim() === item.sourceQuestion.expectedAnswer.trim()) flags.push("synthetic_control_verbatim_reference_answer_possible_label_leak");
  if (item.learnerAnswer.category === "contradictory") flags.push("contradictory_answer_expected_label_requires_review");
  if (!item.learnerAnswer.text.trim()) flags.push("blank_answer_does_not_reach_production_llm_route_unanswered_stress_only");
  if (item.learnerAnswer.category === "terminology_error") flags.push("terminology_error_relevance_and_target_mapping_require_review");
  return flags;
};
const cases = v1.cases.map((item: any) => createV2Case(item, reviewedAt, auditFlags(item)));
const dataset = { datasetVersion:"recallloop-ai-evaluation-v2", schemaVersion:1, createdOn:reviewedAt,
  sourceDataset:{version:v1.datasetVersion,path:"server/src/services/evaluator/benchmarkDataset.v1.json",unchanged:true},
  sourceAudit:{database:"recallloop",role:"recallloop",address:"172.18.0.2/32",readOnly:true,queryScope:"question-bank and canonical taxonomy only; no learner tables",
    cases:35,distinctSourceRevisions:35,exactCurrentEligibleRevisionMappingsConfirmed:35,discrepancies:0,
    eligibilityPredicate:"current exact revision; published; valid; automated or authorized-human review evidence; exact content-hash approval; canonical mapping",checkedOn:reviewedAt,
    caveat:"This is an engineering eligibility check, not an independent technical correctness review."},
  humanReview:{actualAnnotations:0,actualAdjudications:0,scoringEligibleCases:0}, cases };
await mkdir(path.join(out,"reviewers"),{recursive:true});
await mkdir(path.join(out,"annotations"),{recursive:true});
await writeFile(path.join(out,"dataset.json"),JSON.stringify(dataset,null,2)+"\n");
await writeFile(path.join(out,"annotations/ledger.json"),JSON.stringify({schemaVersion:1,annotations:[],adjudications:[]} satisfies AnnotationLedger,null,2)+"\n");
const emptyLedger: AnnotationLedger={schemaVersion:1,annotations:[],adjudications:[]};
await writeFile(path.join(out,"adjudication-report.json"),JSON.stringify(buildAdjudicationReport(dataset,emptyLedger),null,2)+"\n");
for (const domain of ["Database Management Systems","Operating Systems","Computer Networks","Data Structures and Algorithms","System Design"]) {
  const slug = ({"Database Management Systems":"dbms","Operating Systems":"operating-systems","Computer Networks":"computer-networks","Data Structures and Algorithms":"dsa","System Design":"system-design"} as Record<string,string>)[domain];
  const pack=cases.filter((item: any)=>item.domain===domain);
  await writeFile(path.join(out,`reviewers/${slug}.md`),renderBlindReviewerPack(domain,pack)+"\n");
}
const flags = cases.flatMap((item: any)=>item.engineeringAudit.flags.map((flag:string)=>({caseId:item.caseId,flag})));
const auditRows = cases.map((item:any)=>({caseId:item.caseId,domain:item.domain,revisionId:item.sourceQuestion.revisionId,revision:item.sourceQuestion.revision,contentHash:item.sourceQuestion.contentHash,
  canonicalConceptId:item.canonicalPoint.conceptId,knowledgePointIds:item.canonicalPoint.knowledgePointIds,questionType:item.sourceQuestion.questionType,
  snapshotEligibility:item.sourceQuestion.eligibilityAtSnapshot,liveReadOnlyAudit:"matched exact current revision, prompt, hash, point mapping, published/valid status and exact-hash automated-review predicate",
  staticRiskFlags:item.engineeringAudit.flags}));
await writeFile(path.join(out,"case-audit.json"),JSON.stringify({auditType:"read-only-source-eligibility-and-static-content-risk-screen",database:"recallloop",role:"recallloop",serverAddress:"172.18.0.2/32",port:5432,learnerTablesAccessed:false,databaseWrites:false,
  casesInspected:cases.length,distinctRevisions:auditRows.length,liveEligibleExactRevisionMappingsConfirmed:35,discrepancies:0,confirmedTechnicalDefects:0,flags,auditRows,
  interpretation:"Live query verifies question-bank identity and eligibility only. Static flags identify risks, not confirmed defects. No case was silently edited. Human technical validation remains pending."},null,2)+"\n");
console.log(`Generated v2 benchmark artifacts: ${cases.length} cases, ${flags.length} review-risk flags, 0 human annotations.`);
