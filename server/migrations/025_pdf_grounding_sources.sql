ALTER TABLE grounding_sources DROP CONSTRAINT IF EXISTS grounding_sources_source_type_check;
ALTER TABLE grounding_sources
  ADD CONSTRAINT grounding_sources_source_type_check
  CHECK (source_type IN ('text','markdown','web_article','pdf'));

ALTER TABLE grounding_sources DROP CONSTRAINT IF EXISTS grounding_sources_processing_status_check;
ALTER TABLE grounding_sources
  ADD CONSTRAINT grounding_sources_processing_status_check
  CHECK (processing_status IN ('pending','processing','processed','failed','scanned_or_no_extractable_text'));
