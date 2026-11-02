import { canonicalCoreSdeQuestions, validateCoreSdeQuestionBank } from "./coreSdeQuestionBank.js";
import { canonicalHttpPilotQuestions, type PilotQuestion } from "./pilotQuestionBank.js";
import { questionContentHash, validatePilotQuestionBank } from "./questionBankQuality.js";

export interface QuestionRevisionForReview {
  slug: string;
  content_hash: string;
  question_type: string;
  canonical_concept_name: string;
  mapped_points: Array<{ statement: string }>;
}

export const AUTOMATED_SOURCE_VERIFICATION_STATUS = "unverified" as const;

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function createAutomatedQuestionQualityChecker(
  pilotQuestions: readonly PilotQuestion[] = canonicalHttpPilotQuestions,
  coreQuestions: readonly PilotQuestion[] = canonicalCoreSdeQuestions,
) {
  const authoredBySlug = new Map([...pilotQuestions, ...coreQuestions].map((question) => [question.slug, question]));
  const sourceIssues = [...validatePilotQuestionBank(pilotQuestions), ...validateCoreSdeQuestionBank(coreQuestions)];
  const issueBySlug = new Map<string, string[]>();
  for (const question of authoredBySlug.values()) {
    issueBySlug.set(question.slug, sourceIssues.filter((issue) => issue.startsWith(`${question.slug}:`)));
  }

  return (row: QuestionRevisionForReview): string[] => {
    const issues = [...(issueBySlug.get(row.slug) ?? [])];
    const authored = authoredBySlug.get(row.slug);
    if (!authored) return [`${row.slug}: question is absent from the authored source catalog`];
    if (questionContentHash(authored) !== row.content_hash) issues.push(`${row.slug}: content hash differs from the authored revision`);
    if (authored.questionType !== row.question_type) issues.push(`${row.slug}: authored question type differs from the current database revision`);
    if (normalize(authored.canonicalConceptName) !== normalize(row.canonical_concept_name)) {
      issues.push(`${row.slug}: canonical concept differs from the authored revision`);
    }
    if (row.mapped_points.length !== 1 || normalize(row.mapped_points[0]?.statement ?? "") !== normalize(authored.knowledgePoint)) {
      issues.push(`${row.slug}: canonical point mapping differs from the authored revision`);
    }
    return [...new Set(issues)];
  };
}

export function reviewDecisionForIssues(issues: string[]): {
  decision: "approved" | "changes_requested" | "rejected" | "blocked";
  findings: Record<string, string[]>;
} {
  if (!issues.length) return { decision: "approved", findings: { QualityGate: ["passed all per-question structural and canonical validations."] } };
  const findings: Record<string, string[]> = {};
  for (const issue of issues) {
    const separator = issue.indexOf(":");
    const label = separator < 0 ? "General" : issue.slice(0, separator);
    const message = separator < 0 ? issue : issue.slice(separator + 1).trim();
    findings[label] = [...(findings[label] ?? []), message || label];
  }
  if (issues.some((issue) => /absent from the authored source|content hash|duplicate|near duplicate|canonical concept|canonical point mapping/i.test(issue))) {
    return { decision: "rejected", findings };
  }
  if (issues.some((issue) => /insufficient|missing|ambiguous|cannot be responsibly assessed|required|incomplete/i.test(issue))) {
    return { decision: "blocked", findings };
  }
  return { decision: "changes_requested", findings };
}
