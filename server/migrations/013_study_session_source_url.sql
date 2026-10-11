ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS source_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_sessions_source_url_http_check'
  ) THEN
    ALTER TABLE study_sessions
      ADD CONSTRAINT study_sessions_source_url_http_check
      CHECK (source_url IS NULL OR source_url ~* '^https?://');
  END IF;
END
$$;
