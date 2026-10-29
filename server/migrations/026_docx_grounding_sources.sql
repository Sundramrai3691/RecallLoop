ALTER TABLE grounding_sources DROP CONSTRAINT IF EXISTS grounding_sources_source_type_check;
ALTER TABLE grounding_sources
  ADD CONSTRAINT grounding_sources_source_type_check
  CHECK (source_type IN ('text','markdown','web_article','pdf','docx'));
