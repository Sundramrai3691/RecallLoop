-- Migration 017 is replayed by the application's migration runner and resets
-- current revisions without human approvals to draft. Restore publication
-- only when the latest exact-revision automated decision remains approved.
UPDATE canonical_question_revisions r
SET review_status='automated_reviewed', publication_status='published'
FROM canonical_question_items i
WHERE i.id=r.question_item_id
  AND i.current_revision=r.revision
  AND r.review_status IN ('awaiting_subject_matter_review','automated_reviewed')
  AND r.publication_status IN ('draft','published')
  AND NOT EXISTS (
    SELECT 1 FROM canonical_question_reviews human
    WHERE human.question_revision_id=r.id
  )
  AND EXISTS (
    SELECT 1
    FROM canonical_question_automated_reviews approved
    WHERE approved.question_revision_id=r.id
      AND approved.decision='approved'
      AND approved.content_hash=r.content_hash
      AND (approved.reviewed_at,approved.id)=(
        SELECT latest.reviewed_at,latest.id
        FROM canonical_question_automated_reviews latest
        WHERE latest.question_revision_id=r.id
        ORDER BY latest.reviewed_at DESC,latest.id DESC
        LIMIT 1
      )
  );
