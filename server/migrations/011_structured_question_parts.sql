ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_parts jsonb;
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS structured_answers jsonb;
ALTER TABLE recall_knowledge_point_results ADD COLUMN IF NOT EXISTS part_id text;

CREATE TABLE IF NOT EXISTS learner_knowledge_point_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES personal_concepts(id) ON DELETE CASCADE,
  point text NOT NULL,
  mastery numeric(4,3) NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 1),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_status text NOT NULL CHECK (last_status IN ('correct','partial','missing')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,concept_id,point)
);
CREATE INDEX IF NOT EXISTS idx_learner_point_states_user_concept ON learner_knowledge_point_states(user_id,concept_id);
