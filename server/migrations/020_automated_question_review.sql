-- Add a distinct automated quality review path without fabricating human approvals.
CREATE TABLE IF NOT EXISTS canonical_question_automated_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_revision_id uuid NOT NULL REFERENCES canonical_question_revisions(id) ON DELETE RESTRICT,
  policy_version text NOT NULL CHECK (length(trim(policy_version)) > 0),
  review_method text NOT NULL CHECK (review_method IN ('copilot_automated_review','automated_quality_gate')),
  decision text NOT NULL CHECK (decision IN ('approved','changes_requested','rejected','blocked')),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  findings jsonb NOT NULL CHECK (jsonb_typeof(findings)='object'),
  source_verification_status text NOT NULL CHECK (source_verification_status IN ('verified','unverified','partial')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  run_id text NOT NULL CHECK (length(trim(run_id)) > 0),
  UNIQUE(question_revision_id, policy_version, review_method)
);

CREATE INDEX IF NOT EXISTS idx_canonical_question_automated_reviews_revision_time
  ON canonical_question_automated_reviews(question_revision_id, reviewed_at DESC, id DESC);

CREATE OR REPLACE FUNCTION validate_canonical_question_automated_review_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE revision_hash text; current_revision integer; revision_number integer;
BEGIN
  SELECT r.content_hash, r.revision, i.current_revision INTO revision_hash, revision_number, current_revision
  FROM canonical_question_revisions r JOIN canonical_question_items i ON i.id=r.question_item_id
  WHERE r.id=NEW.question_revision_id;

  IF revision_hash IS NULL OR revision_hash IS DISTINCT FROM NEW.content_hash THEN
    RAISE EXCEPTION 'automated review content hash does not match the exact revision';
  END IF;

  IF revision_number IS DISTINCT FROM current_revision THEN
    RAISE EXCEPTION 'automated review can only be recorded for the current question revision';
  END IF;

  IF NEW.decision='approved' AND jsonb_typeof(NEW.findings) <> 'object' THEN
    RAISE EXCEPTION 'approved automated review requires structured findings';
  END IF;

  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_canonical_question_automated_review_insert ON canonical_question_automated_reviews;
CREATE TRIGGER trg_validate_canonical_question_automated_review_insert BEFORE INSERT ON canonical_question_automated_reviews
FOR EACH ROW EXECUTE FUNCTION validate_canonical_question_automated_review_insert();

CREATE OR REPLACE FUNCTION prevent_canonical_question_automated_review_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'canonical question automated review records are append-only';
END $$;
DROP TRIGGER IF EXISTS trg_prevent_canonical_question_automated_review_mutation ON canonical_question_automated_reviews;
CREATE TRIGGER trg_prevent_canonical_question_automated_review_mutation BEFORE UPDATE OR DELETE ON canonical_question_automated_reviews
FOR EACH ROW EXECUTE FUNCTION prevent_canonical_question_automated_review_mutation();

ALTER TABLE canonical_question_revisions DROP CONSTRAINT IF EXISTS canonical_question_revisions_review_status_check;
ALTER TABLE canonical_question_revisions ADD CONSTRAINT canonical_question_revisions_review_status_check
  CHECK (review_status IN ('pending','engineering_reviewed','awaiting_subject_matter_review','automated_reviewed','subject_matter_reviewed','changes_requested','rejected'));

CREATE OR REPLACE FUNCTION validate_canonical_question_publication() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest_human_decision text; latest_human_hash text; latest_auto_decision text; latest_auto_hash text; item_current_revision integer;
BEGIN
  IF NEW.publication_status='published' OR NEW.review_status IN ('subject_matter_reviewed','automated_reviewed') THEN
    SELECT current_revision INTO item_current_revision FROM canonical_question_items WHERE id=NEW.question_item_id;
    IF item_current_revision IS DISTINCT FROM NEW.revision THEN
      RAISE EXCEPTION 'only the current canonical question revision can be approved or published';
    END IF;

    SELECT cr.decision, cr.content_hash INTO latest_human_decision, latest_human_hash
    FROM canonical_question_reviews cr
    WHERE cr.question_revision_id=NEW.id
    ORDER BY cr.reviewed_at DESC, cr.id DESC LIMIT 1;

    SELECT ar.decision, ar.content_hash INTO latest_auto_decision, latest_auto_hash
    FROM canonical_question_automated_reviews ar
    WHERE ar.question_revision_id=NEW.id
    ORDER BY ar.reviewed_at DESC, ar.id DESC LIMIT 1;

    IF NEW.review_status='subject_matter_reviewed' THEN
      IF latest_human_decision IS DISTINCT FROM 'approved' OR latest_human_hash IS DISTINCT FROM NEW.content_hash THEN
        RAISE EXCEPTION 'publishing a question requires a current exact-revision subject-matter approval record';
      END IF;
    ELSIF NEW.review_status='automated_reviewed' THEN
      IF latest_auto_decision IS DISTINCT FROM 'approved' OR latest_auto_hash IS DISTINCT FROM NEW.content_hash THEN
        RAISE EXCEPTION 'publishing a question requires a current exact-revision automated approval record';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_canonical_question_publication ON canonical_question_revisions;
CREATE TRIGGER trg_validate_canonical_question_publication BEFORE UPDATE OF publication_status,review_status ON canonical_question_revisions
FOR EACH ROW EXECUTE FUNCTION validate_canonical_question_publication();

UPDATE canonical_question_revisions r
SET review_status='automated_reviewed', publication_status='published'
FROM canonical_question_items i
WHERE i.id=r.question_item_id
  AND r.revision=i.current_revision
  AND r.review_status IN ('awaiting_subject_matter_review','pending')
  AND NOT EXISTS (SELECT 1 FROM canonical_question_automated_reviews ar WHERE ar.question_revision_id=r.id AND ar.decision='approved');
