ALTER TABLE recall_attempts
  DROP CONSTRAINT IF EXISTS recall_attempts_result_status_check;

ALTER TABLE recall_attempts
  ADD CONSTRAINT recall_attempts_result_status_check
  CHECK (result_status IN ('correct','partial','incorrect','unanswered'));
