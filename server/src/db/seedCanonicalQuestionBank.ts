import { withTransaction } from "./postgres.js";
import { canonicalHttpPilotQuestions } from "../services/questionBank/pilotQuestionBank.js";
import { canonicalCoreSdeQuestions, validateCoreSdeQuestionBank } from "../services/questionBank/coreSdeQuestionBank.js";
import { questionContentHash, validatePilotQuestionBank } from "../services/questionBank/questionBankQuality.js";

export async function seedCanonicalQuestionBank(): Promise<void> {
  const issues = validatePilotQuestionBank();
  issues.push(...validateCoreSdeQuestionBank());
  if (issues.length) throw new Error(`Canonical question bank validation failed:\n${issues.join("\n")}`);
  await withTransaction(async (client) => {
    for (const question of [...canonicalHttpPilotQuestions,...canonicalCoreSdeQuestions]) {
      const canonical = await client.query<{ concept_id: string; point_id: string }>(`SELECT cc.id AS concept_id,kp.id AS point_id
        FROM canonical_concepts cc JOIN knowledge_points kp ON kp.concept_id=cc.id
        WHERE cc.status='active' AND lower(trim(cc.name))=lower(trim($1))
          AND lower(regexp_replace(trim(kp.statement),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim($2),'[[:space:]]+',' ','g'))`, [question.canonicalConceptName,question.knowledgePoint]);
      if (canonical.rows.length !== 1) throw new Error(`${question.slug}: expected exactly one active canonical concept/point mapping, found ${canonical.rows.length}`);
      const { concept_id: conceptId, point_id: pointId } = canonical.rows[0];
      const itemInsert = await client.query<{ id: string }>(`INSERT INTO canonical_question_items(slug,canonical_concept_id,current_revision)
        VALUES($1,$2,$3) ON CONFLICT(slug) DO NOTHING RETURNING id`, [question.slug,conceptId,question.revision]);
      const itemResult = itemInsert.rows[0] ? { rows: itemInsert.rows } : await client.query<{ id: string; canonical_concept_id: string }>(`SELECT id,canonical_concept_id FROM canonical_question_items WHERE slug=$1`, [question.slug]);
      const item = itemResult.rows[0] as { id: string; canonical_concept_id?: string };
      if (!item || item.canonical_concept_id && item.canonical_concept_id !== conceptId) throw new Error(`${question.slug}: stable question identity is already bound to a different canonical concept`);
      const hash = questionContentHash(question);
      const inserted = await client.query<{ id: string }>(`INSERT INTO canonical_question_revisions(
          question_item_id,revision,question_type,assessment_level,difficulty,objective,title,context,prompt,expected_answer,rubric,
          expected_misconceptions,estimated_minutes,options,correct_option_id,explanation,distractor_rationales,hints,
          question_origin,source_title,source_url,source_publisher,source_license,source_accessed_on,source_notes,
          content_hash,review_status,quality_status,publication_status
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'original',$19,$20,$21,$22,$23,$24,$25,'awaiting_subject_matter_review','valid','draft')
        ON CONFLICT(question_item_id,revision) DO NOTHING RETURNING id`, [
        item.id,question.revision,question.questionType,question.assessmentLevel,question.difficulty,question.objective,question.title,question.context,
        question.prompt,question.expectedAnswer,JSON.stringify(question.rubric),JSON.stringify(question.misconceptions),question.estimatedMinutes,
        question.options?JSON.stringify(question.options):null,question.correctOptionId,question.explanation,JSON.stringify(question.distractorRationales),
        question.hints,question.source.title,question.source.url,question.source.publisher,question.source.license,question.source.accessedOn??"2026-10-18",question.source.notes,hash,
      ]);
      const revisionResult = inserted.rows[0] ? { rows: inserted.rows } : await client.query<{ id: string; content_hash: string }>(`SELECT id,content_hash FROM canonical_question_revisions WHERE question_item_id=$1 AND revision=$2`, [item.id,question.revision]);
      const revision = revisionResult.rows[0] as { id: string; content_hash?: string };
      if (!revision || revision.content_hash && revision.content_hash !== hash) throw new Error(`${question.slug}: published revision content changed; create a new revision instead of editing the existing revision`);
      await client.query(`INSERT INTO canonical_question_revision_points(question_revision_id,canonical_knowledge_point_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [revision.id,pointId]);
      const mappings = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM canonical_question_revision_points WHERE question_revision_id=$1`, [revision.id]);
      if (Number(mappings.rows[0].count) !== 1) throw new Error(`${question.slug}: revision mapping set drifted; create a new revision`);
      await client.query(`UPDATE canonical_question_items SET current_revision=GREATEST(current_revision,$2),updated_at=now() WHERE id=$1`, [item.id,question.revision]);
    }
  });
}
