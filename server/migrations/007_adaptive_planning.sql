ALTER TABLE app_users ADD COLUMN IF NOT EXISTS review_mode text NOT NULL DEFAULT 'automatic' CHECK (review_mode IN ('automatic','confirm','manual'));
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS repetition_reason text CHECK (repetition_reason IN ('spaced_recall','mastery_confirmation','remediation'));
ALTER TABLE plan_tasks ADD COLUMN IF NOT EXISTS requiredness text NOT NULL DEFAULT 'recommended' CHECK (requiredness IN ('must','recommended','optional'));
UPDATE plan_tasks SET requiredness = CASE WHEN task_category='must_do' THEN 'must' WHEN task_category='optional' THEN 'optional' ELSE 'recommended' END;
WITH ranked AS (
  SELECT id,FIRST_VALUE(id) OVER (PARTITION BY concept_id,question_type,prompt ORDER BY created_at,id) AS keeper,
    ROW_NUMBER() OVER (PARTITION BY concept_id,question_type,prompt ORDER BY created_at,id) AS position
  FROM questions
)
UPDATE recall_attempts a SET question_id=ranked.keeper FROM ranked WHERE ranked.id=a.question_id AND ranked.position>1;
WITH ranked AS (
  SELECT id,ROW_NUMBER() OVER (PARTITION BY concept_id,question_type,prompt ORDER BY created_at,id) AS position
  FROM questions
)
DELETE FROM questions q USING ranked WHERE q.id=ranked.id AND ranked.position>1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_stable_prompt ON questions(concept_id,question_type,prompt);
CREATE INDEX IF NOT EXISTS idx_recall_history_window ON recall_attempts(user_id,concept_id,submitted_at DESC);

CREATE TABLE IF NOT EXISTS assessment_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_attempt_id uuid NOT NULL UNIQUE REFERENCES recall_attempts(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('recall','learn','practice','remediation','mastery_check','none')),
  title text NOT NULL,
  reason text NOT NULL,
  estimated_minutes integer NOT NULL CHECK (estimated_minutes >= 0),
  priority integer NOT NULL CHECK (priority BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON assessment_recommendations(action_type,priority DESC,created_at DESC);
