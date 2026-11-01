ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS idempotency_request_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_sessions_user_idempotency_key
  ON study_sessions(user_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;
