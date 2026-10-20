-- U3 initially authored two extra HTTP sets before the existing HTTP bank was
-- recognized as sufficient. Preserve those draft revisions as history while
-- removing them from all normal review and publication workflows.
UPDATE canonical_question_revisions r
SET publication_status='retired'
FROM canonical_question_items i
WHERE i.id=r.question_item_id AND i.slug LIKE 'sde-net-http-%'
  AND r.revision=i.current_revision
  AND r.review_status='awaiting_subject_matter_review'
  AND r.publication_status='draft';
