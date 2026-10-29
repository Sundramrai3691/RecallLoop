ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS grounding_source_id uuid REFERENCES grounding_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_study_sessions_grounding_source
  ON study_sessions(grounding_source_id)
  WHERE grounding_source_id IS NOT NULL;
