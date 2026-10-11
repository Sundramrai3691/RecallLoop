ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS canonical_topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canonical_concept_id uuid REFERENCES canonical_concepts(id) ON DELETE SET NULL;

ALTER TABLE personal_concepts
  ADD COLUMN IF NOT EXISTS canonical_concept_id uuid REFERENCES canonical_concepts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_study_sessions_canonical_topic
  ON study_sessions(user_id, canonical_topic_id, updated_at DESC)
  WHERE canonical_topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personal_concepts_canonical
  ON personal_concepts(user_id,canonical_concept_id)
  WHERE canonical_concept_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_sessions_canonical_concept
  ON study_sessions(user_id, canonical_concept_id, updated_at DESC)
  WHERE canonical_concept_id IS NOT NULL;

ALTER TABLE recall_knowledge_point_results
  ADD COLUMN IF NOT EXISTS canonical_knowledge_point_id uuid REFERENCES knowledge_points(id) ON DELETE SET NULL;
ALTER TABLE learner_knowledge_point_states
  ADD COLUMN IF NOT EXISTS canonical_knowledge_point_id uuid REFERENCES knowledge_points(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recall_point_results_canonical
  ON recall_knowledge_point_results(canonical_knowledge_point_id)
  WHERE canonical_knowledge_point_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learner_point_states_canonical
  ON learner_knowledge_point_states(user_id,canonical_knowledge_point_id)
  WHERE canonical_knowledge_point_id IS NOT NULL;
