-- An assessed baseline with no submitted knowledge-point evidence has no observed score.
ALTER TABLE baseline_assessments ALTER COLUMN observed_mastery DROP NOT NULL;
ALTER TABLE baseline_assessments ALTER COLUMN observed_mastery DROP DEFAULT;

UPDATE baseline_assessments ba
SET observed_mastery = NULL
WHERE ba.baseline_source = 'assessed'
  AND NOT EXISTS (
    SELECT 1 FROM baseline_questions bq
    WHERE bq.assessment_id = ba.id
      AND bq.submitted_at IS NOT NULL
      AND CASE WHEN jsonb_typeof(bq.knowledge_point_results) = 'array'
        THEN jsonb_array_length(bq.knowledge_point_results) > 0 ELSE false END
  );
