import type { PoolClient } from "pg";
import { AppError } from "../../utils/errors.js";
import type { AssessmentLevel, QuestionType } from "../../domain/recallTypes.js";

export interface CanonicalQuestionCandidate {
  revisionId: string;
  itemSlug: string;
  questionType: QuestionType;
  assessmentLevel: AssessmentLevel;
  difficulty: number;
  title: string;
  context: string;
  prompt: string;
  expectedAnswer: string;
  rubric: Array<{ id: string; label: string; weight: number; fullCredit: string; partialCredit: string; insufficient: string }>;
  estimatedMinutes: number;
  options: Array<{ id: string; text: string }> | null;
  correctOptionId: string | null;
  explanation: string;
  knowledgePoints: string[];
  hints: string[];
}

export async function hasCanonicalQuestionBank(client: PoolClient, canonicalConceptId: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`SELECT EXISTS(
    SELECT 1 FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id
    WHERE i.canonical_concept_id=$1
  ) AS exists`, [canonicalConceptId]);
  return result.rows[0].exists;
}

export async function listEligibleCanonicalQuestions(client: PoolClient, canonicalConceptId: string): Promise<CanonicalQuestionCandidate[]> {
  const result = await client.query<any>(`SELECT r.id AS revision_id,i.slug,r.question_type,r.assessment_level,r.difficulty,r.title,r.context,r.prompt,r.expected_answer,r.rubric,
      r.estimated_minutes,r.options,r.correct_option_id,r.explanation,r.hints,
      array_agg(kp.statement ORDER BY kp.id) AS knowledge_points
    FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id
    JOIN canonical_question_revision_points rp ON rp.question_revision_id=r.id
    JOIN knowledge_points kp ON kp.id=rp.canonical_knowledge_point_id
    WHERE i.canonical_concept_id=$1 AND r.revision=i.current_revision AND r.publication_status='published' AND r.review_status='subject_matter_reviewed' AND r.quality_status='valid'
      AND EXISTS (
        SELECT 1 FROM canonical_question_reviews approved
        JOIN canonical_question_reviewers reviewer ON reviewer.reviewer_user_id=approved.reviewer_user_id
        WHERE approved.question_revision_id=r.id AND approved.decision='approved' AND approved.content_hash=r.content_hash
          AND approved.reviewed_at>=reviewer.granted_at
          AND (reviewer.revoked_at IS NULL OR approved.reviewed_at<reviewer.revoked_at)
          AND NOT EXISTS (
            SELECT 1 FROM canonical_question_reviews later
            WHERE later.question_revision_id=r.id AND (later.reviewed_at,later.id)>(approved.reviewed_at,approved.id)
          )
      )
    GROUP BY r.id,i.slug ORDER BY r.question_type,r.difficulty,i.slug,r.revision DESC`, [canonicalConceptId]);
  return result.rows.map((row) => ({
    revisionId: row.revision_id, itemSlug: row.slug, questionType: row.question_type, assessmentLevel: row.assessment_level,
    difficulty: Number(row.difficulty), title: row.title, context: row.context, prompt: row.prompt, expectedAnswer: row.expected_answer,
    rubric: row.rubric, estimatedMinutes: Number(row.estimated_minutes), options: row.options, correctOptionId: row.correct_option_id,
    explanation: row.explanation, knowledgePoints: row.knowledge_points, hints: row.hints,
  }));
}

export function chooseCanonicalQuestionSet(input: {
  candidates: CanonicalQuestionCandidate[];
  blueprint: QuestionType[];
  recentRevisionIds: Set<string>;
  targetDifficulty: number;
}): Array<{ candidate: CanonicalQuestionCandidate; repeated: boolean }> {
  const selectedRevisionIds = new Set<string>();
  const perPointUse = new Map<string, number>();
  const selected: Array<{ candidate: CanonicalQuestionCandidate; repeated: boolean }> = [];
  for (const [index, questionType] of input.blueprint.entries()) {
    const eligible = input.candidates.filter((candidate) => candidate.questionType === questionType && !selectedRevisionIds.has(candidate.revisionId));
    if (!eligible.length) throw new AppError(`Published question bank coverage is insufficient for ${questionType} at assessment position ${index + 1}.`, 409, "QUESTION_BANK_COVERAGE_INSUFFICIENT");
    eligible.sort((left, right) => {
      const leftRecent = input.recentRevisionIds.has(left.revisionId) ? 1 : 0;
      const rightRecent = input.recentRevisionIds.has(right.revisionId) ? 1 : 0;
      const leftPointUse = Math.min(...left.knowledgePoints.map((point) => perPointUse.get(point) ?? 0));
      const rightPointUse = Math.min(...right.knowledgePoints.map((point) => perPointUse.get(point) ?? 0));
      return leftRecent - rightRecent || leftPointUse - rightPointUse || Math.abs(left.difficulty - input.targetDifficulty) - Math.abs(right.difficulty - input.targetDifficulty) || left.itemSlug.localeCompare(right.itemSlug);
    });
    const candidate = eligible[0];
    const repeated = input.recentRevisionIds.has(candidate.revisionId);
    selectedRevisionIds.add(candidate.revisionId);
    for (const point of candidate.knowledgePoints) perPointUse.set(point, (perPointUse.get(point) ?? 0) + 1);
    selected.push({ candidate, repeated });
  }
  return selected;
}

export async function materializeCanonicalQuestion(client: PoolClient, personalConceptId: string, candidate: CanonicalQuestionCandidate): Promise<string> {
  const inserted = await client.query<{ id: string }>(`INSERT INTO questions(
      concept_id,question_type,assessment_level,difficulty,title,context,prompt,estimated_minutes,source,options,correct_option_id,explanation,knowledge_points,hints,rubric,canonical_question_revision_id
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'builtin',$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT(concept_id,canonical_question_revision_id) WHERE canonical_question_revision_id IS NOT NULL DO NOTHING RETURNING id`, [
    personalConceptId,candidate.questionType,candidate.assessmentLevel,candidate.difficulty,candidate.title,candidate.context,candidate.prompt,
    candidate.estimatedMinutes,candidate.options?JSON.stringify(candidate.options):null,candidate.correctOptionId,candidate.explanation,
    candidate.knowledgePoints,candidate.hints,JSON.stringify(candidate.rubric),candidate.revisionId,
  ]);
  if (inserted.rows[0]) return inserted.rows[0].id;
  const existing = await client.query<{ id: string }>(`SELECT id FROM questions WHERE concept_id=$1 AND canonical_question_revision_id=$2`, [personalConceptId,candidate.revisionId]);
  if (!existing.rows[0]) throw new AppError("Question snapshot could not be materialized.", 500, "QUESTION_BANK_SNAPSHOT_FAILED");
  return existing.rows[0].id;
}
