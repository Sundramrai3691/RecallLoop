-- Separate engineering validation from auditable subject-matter approval.
CREATE TABLE IF NOT EXISTS canonical_question_reviewers (
  reviewer_user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE RESTRICT,
  granted_by_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  grant_note text NOT NULL CHECK (length(trim(grant_note)) > 0),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at > granted_at)
);

CREATE TABLE IF NOT EXISTS canonical_question_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_revision_id uuid NOT NULL REFERENCES canonical_question_revisions(id) ON DELETE RESTRICT,
  reviewer_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria)='object' AND criteria - ARRAY['technical_correctness','expected_answer','explanation','mcq_key','distractors','rubric','point_mapping','cognitive_level_difficulty','source_attribution_license']::text[] = '{}'::jsonb),
  review_notes text NOT NULL CHECK (length(trim(review_notes)) >= 20),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (criteria ?& ARRAY['technical_correctness','expected_answer','explanation','mcq_key','distractors','rubric','point_mapping','cognitive_level_difficulty','source_attribution_license']),
  CHECK (
    (criteria->>'technical_correctness') IS NOT NULL AND (criteria->>'technical_correctness') IN ('pass','concern','not_applicable') AND
    (criteria->>'expected_answer') IS NOT NULL AND (criteria->>'expected_answer') IN ('pass','concern','not_applicable') AND
    (criteria->>'explanation') IS NOT NULL AND (criteria->>'explanation') IN ('pass','concern','not_applicable') AND
    (criteria->>'mcq_key') IS NOT NULL AND (criteria->>'mcq_key') IN ('pass','concern','not_applicable') AND
    (criteria->>'distractors') IS NOT NULL AND (criteria->>'distractors') IN ('pass','concern','not_applicable') AND
    (criteria->>'rubric') IS NOT NULL AND (criteria->>'rubric') IN ('pass','concern','not_applicable') AND
    (criteria->>'point_mapping') IS NOT NULL AND (criteria->>'point_mapping') IN ('pass','concern','not_applicable') AND
    (criteria->>'cognitive_level_difficulty') IS NOT NULL AND (criteria->>'cognitive_level_difficulty') IN ('pass','concern','not_applicable') AND
    (criteria->>'source_attribution_license') IS NOT NULL AND (criteria->>'source_attribution_license') IN ('pass','concern','not_applicable')
  )
);

CREATE INDEX IF NOT EXISTS idx_canonical_question_reviews_revision_time
  ON canonical_question_reviews(question_revision_id,reviewed_at DESC,id DESC);

ALTER TABLE canonical_question_reviews DROP CONSTRAINT IF EXISTS canonical_question_reviews_review_notes_check;
ALTER TABLE canonical_question_reviews ADD CONSTRAINT canonical_question_reviews_review_notes_check CHECK (length(trim(review_notes)) >= 20);

CREATE OR REPLACE FUNCTION validate_canonical_question_review_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE revision_hash text; revision_type text; revision_number integer; current_revision integer; grant_row canonical_question_reviewers%ROWTYPE;
BEGIN
  SELECT r.content_hash,r.question_type,r.revision,i.current_revision INTO revision_hash,revision_type,revision_number,current_revision
  FROM canonical_question_revisions r JOIN canonical_question_items i ON i.id=r.question_item_id WHERE r.id=NEW.question_revision_id;
  IF revision_hash IS NULL OR revision_hash<>NEW.content_hash THEN
    RAISE EXCEPTION 'review content hash does not match the exact question revision';
  END IF;
  IF revision_number IS DISTINCT FROM current_revision THEN
    RAISE EXCEPTION 'review decisions can only be recorded for the current question revision';
  END IF;
  SELECT * INTO grant_row FROM canonical_question_reviewers WHERE reviewer_user_id=NEW.reviewer_user_id;
  IF NOT FOUND OR grant_row.granted_at>NEW.reviewed_at OR (grant_row.revoked_at IS NOT NULL AND grant_row.revoked_at<=NEW.reviewed_at) THEN
    RAISE EXCEPTION 'reviewer is not authorized for the submitted review timestamp';
  END IF;
  IF NEW.decision='approved' AND EXISTS (
    SELECT 1 FROM jsonb_each_text(NEW.criteria) AS criterion(key,value) WHERE criterion.value NOT IN ('pass','not_applicable')
  ) THEN
    RAISE EXCEPTION 'approval requires every applicable review criterion to pass';
  END IF;
  IF NEW.criteria->>'technical_correctness'='not_applicable' OR NEW.criteria->>'expected_answer'='not_applicable' OR
     NEW.criteria->>'point_mapping'='not_applicable' OR NEW.criteria->>'cognitive_level_difficulty'='not_applicable' OR
     NEW.criteria->>'source_attribution_license'='not_applicable' THEN
    RAISE EXCEPTION 'technical answer, mapping, taxonomy, and source criteria must be assessed';
  END IF;
  IF revision_type='mcq' AND (NEW.criteria->>'mcq_key'='not_applicable' OR NEW.criteria->>'distractors'='not_applicable' OR NEW.criteria->>'rubric'<>'not_applicable' OR NEW.criteria->>'explanation'='not_applicable') THEN
    RAISE EXCEPTION 'MCQ key, distractors, and explanation must be assessed; rubric is not applicable to binary grading';
  END IF;
  IF revision_type<>'mcq' AND (NEW.criteria->>'mcq_key'<>'not_applicable' OR NEW.criteria->>'distractors'<>'not_applicable' OR NEW.criteria->>'rubric'='not_applicable' OR NEW.criteria->>'explanation'<>'not_applicable') THEN
    RAISE EXCEPTION 'free-response questions require rubric review and mark MCQ-only criteria not applicable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_canonical_question_review_insert ON canonical_question_reviews;
CREATE TRIGGER trg_validate_canonical_question_review_insert BEFORE INSERT ON canonical_question_reviews
FOR EACH ROW EXECUTE FUNCTION validate_canonical_question_review_insert();

CREATE OR REPLACE FUNCTION prevent_canonical_question_review_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'canonical question review records are append-only';
END $$;
DROP TRIGGER IF EXISTS trg_prevent_canonical_question_review_mutation ON canonical_question_reviews;
CREATE TRIGGER trg_prevent_canonical_question_review_mutation BEFORE UPDATE OR DELETE ON canonical_question_reviews
FOR EACH ROW EXECUTE FUNCTION prevent_canonical_question_review_mutation();

ALTER TABLE canonical_question_revisions DROP CONSTRAINT IF EXISTS canonical_question_revisions_review_status_check;
UPDATE canonical_question_revisions r SET review_status='pending',publication_status='retired'
FROM canonical_question_items i WHERE i.id=r.question_item_id AND r.revision<>i.current_revision;
UPDATE canonical_question_revisions r SET review_status='awaiting_subject_matter_review',publication_status='draft'
FROM canonical_question_items i WHERE i.id=r.question_item_id AND r.revision=i.current_revision
  AND NOT EXISTS (SELECT 1 FROM canonical_question_reviews cr WHERE cr.question_revision_id=r.id AND cr.decision='approved');
ALTER TABLE canonical_question_revisions ADD CONSTRAINT canonical_question_revisions_review_status_check
  CHECK (review_status IN ('pending','engineering_reviewed','awaiting_subject_matter_review','subject_matter_reviewed','changes_requested','rejected'));

CREATE OR REPLACE FUNCTION validate_canonical_question_publication() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest_decision text; latest_hash text; item_current_revision integer;
BEGIN
  IF NEW.publication_status='published' OR NEW.review_status='subject_matter_reviewed' THEN
    SELECT current_revision INTO item_current_revision FROM canonical_question_items WHERE id=NEW.question_item_id;
    IF item_current_revision IS DISTINCT FROM NEW.revision THEN
      RAISE EXCEPTION 'only the current canonical question revision can be approved or published';
    END IF;
    SELECT cr.decision,cr.content_hash INTO latest_decision,latest_hash
    FROM canonical_question_reviews cr
    WHERE cr.question_revision_id=NEW.id
    ORDER BY cr.reviewed_at DESC,cr.id DESC LIMIT 1;
    IF latest_decision IS DISTINCT FROM 'approved' OR latest_hash IS DISTINCT FROM NEW.content_hash OR NEW.review_status<>'subject_matter_reviewed' THEN
      RAISE EXCEPTION 'publishing a question requires a current exact-revision subject-matter approval record';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_canonical_question_publication ON canonical_question_revisions;
CREATE TRIGGER trg_validate_canonical_question_publication BEFORE UPDATE OF publication_status,review_status ON canonical_question_revisions
FOR EACH ROW EXECUTE FUNCTION validate_canonical_question_publication();

-- The old labels were engineering seed metadata, not independent review evidence.
-- Preserve content/revisions but move current pilot candidates out of learner publication.
UPDATE canonical_question_revisions r SET review_status='awaiting_subject_matter_review',publication_status='draft'
FROM canonical_question_items i
WHERE i.id=r.question_item_id AND r.revision=i.current_revision
  AND r.review_status IN ('engineering_reviewed','subject_matter_reviewed')
  AND NOT EXISTS (SELECT 1 FROM canonical_question_reviews cr WHERE cr.question_revision_id=r.id AND cr.decision='approved');
