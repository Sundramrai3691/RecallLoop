-- Repair exact canonical point duplicates created because migration 002 re-seeds
-- knowledge_points on every migration run without a corresponding unique key.
-- Keep ambiguous statement groups for manual review when curation metadata differs.

CREATE TABLE IF NOT EXISTS canonical_knowledge_point_deduplication_audit (
  concept_id uuid NOT NULL,
  normalized_statement text NOT NULL,
  statement_example text NOT NULL,
  record_ids uuid[] NOT NULL,
  keeper_id uuid,
  record_count integer NOT NULL,
  metadata_variant_count integer NOT NULL,
  action text NOT NULL CHECK (action IN ('deduplicated', 'manual_review')),
  references_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (concept_id, normalized_statement)
);

CREATE TEMP TABLE _canonical_point_duplicate_groups ON COMMIT DROP AS
SELECT kp.concept_id,
  regexp_replace(lower(trim(kp.statement)), '[[:space:]]+', ' ', 'g') AS normalized_statement,
  min(kp.statement) AS statement_example,
  array_agg(kp.id ORDER BY kp.id) AS record_ids,
  count(*)::integer AS record_count,
  count(DISTINCT (kp.importance, kp.difficulty))::integer AS metadata_variant_count
FROM knowledge_points kp
GROUP BY kp.concept_id, regexp_replace(lower(trim(kp.statement)), '[[:space:]]+', ' ', 'g')
HAVING count(*) > 1;

INSERT INTO canonical_knowledge_point_deduplication_audit (
  concept_id, normalized_statement, statement_example, record_ids, keeper_id,
  record_count, metadata_variant_count, action, references_before
)
SELECT groups.concept_id, groups.normalized_statement, groups.statement_example,
  groups.record_ids,
  CASE WHEN groups.metadata_variant_count = 1 THEN (
    SELECT kp.id FROM knowledge_points kp
    WHERE kp.concept_id = groups.concept_id
      AND regexp_replace(lower(trim(kp.statement)), '[[:space:]]+', ' ', 'g') = groups.normalized_statement
    ORDER BY kp.id LIMIT 1
  ) END,
  groups.record_count, groups.metadata_variant_count,
  CASE WHEN groups.metadata_variant_count = 1 THEN 'deduplicated' ELSE 'manual_review' END,
  jsonb_build_object(
    'baseline_questions', (SELECT count(*) FROM baseline_questions WHERE knowledge_point_id = ANY(groups.record_ids)),
    'recall_knowledge_point_results', (SELECT count(*) FROM recall_knowledge_point_results WHERE canonical_knowledge_point_id = ANY(groups.record_ids)),
    'learner_knowledge_point_states', (SELECT count(*) FROM learner_knowledge_point_states WHERE canonical_knowledge_point_id = ANY(groups.record_ids))
  )
FROM _canonical_point_duplicate_groups groups
ON CONFLICT (concept_id, normalized_statement) DO NOTHING;

CREATE TEMP TABLE _canonical_point_duplicate_map ON COMMIT DROP AS
SELECT duplicate_id, keeper_id, concept_id, normalized_statement
FROM (
  SELECT kp.id AS duplicate_id,
    first_value(kp.id) OVER (
      PARTITION BY kp.concept_id,
        regexp_replace(lower(trim(kp.statement)), '[[:space:]]+', ' ', 'g'),
        kp.importance, kp.difficulty
      ORDER BY kp.id
    ) AS keeper_id,
    row_number() OVER (
      PARTITION BY kp.concept_id,
        regexp_replace(lower(trim(kp.statement)), '[[:space:]]+', ' ', 'g'),
        kp.importance, kp.difficulty
      ORDER BY kp.id
    ) AS duplicate_order,
    kp.concept_id,
    regexp_replace(lower(trim(kp.statement)), '[[:space:]]+', ' ', 'g') AS normalized_statement
  FROM knowledge_points kp
  JOIN _canonical_point_duplicate_groups groups
    ON groups.concept_id = kp.concept_id
    AND groups.normalized_statement = regexp_replace(lower(trim(kp.statement)), '[[:space:]]+', ' ', 'g')
    AND groups.metadata_variant_count = 1
) ranked
WHERE duplicate_order > 1;

-- Preserve every foreign-key relationship before removing redundant catalog rows.
UPDATE baseline_questions target
SET knowledge_point_id = duplicate_map.keeper_id
FROM _canonical_point_duplicate_map duplicate_map
WHERE target.knowledge_point_id = duplicate_map.duplicate_id;

UPDATE recall_knowledge_point_results target
SET canonical_knowledge_point_id = duplicate_map.keeper_id
FROM _canonical_point_duplicate_map duplicate_map
WHERE target.canonical_knowledge_point_id = duplicate_map.duplicate_id;

UPDATE learner_knowledge_point_states target
SET canonical_knowledge_point_id = duplicate_map.keeper_id
FROM _canonical_point_duplicate_map duplicate_map
WHERE target.canonical_knowledge_point_id = duplicate_map.duplicate_id;

DELETE FROM knowledge_points target
USING _canonical_point_duplicate_map duplicate_map
WHERE target.id = duplicate_map.duplicate_id;

-- Metadata conflicts remain separate and reviewable; exact duplicates cannot be re-seeded.
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_points_concept_statement_metadata
  ON knowledge_points (
    concept_id,
    regexp_replace(lower(trim(statement)), '[[:space:]]+', ' ', 'g'),
    importance,
    difficulty
  );
