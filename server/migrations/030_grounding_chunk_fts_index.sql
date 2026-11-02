CREATE INDEX IF NOT EXISTS idx_grounding_chunks_content_fts
  ON grounding_chunks USING GIN (to_tsvector('simple'::regconfig, content));
