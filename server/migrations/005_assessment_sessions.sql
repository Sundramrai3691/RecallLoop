CREATE TABLE IF NOT EXISTS assessment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES personal_concepts(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('rapid_fire','deep_recall','mastery_check')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user_created ON assessment_sessions(user_id,created_at DESC);
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS assessment_session_id uuid REFERENCES assessment_sessions(id) ON DELETE SET NULL;
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS assessment_position integer;
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_order ON recall_attempts(assessment_session_id,assessment_position);
