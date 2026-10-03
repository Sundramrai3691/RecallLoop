CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL REFERENCES personal_concepts(id) ON DELETE CASCADE,
  question_type text NOT NULL CHECK (question_type IN ('mcq','rapid_recall','short_explanation','descriptive','comparison','scenario','application','transfer','explain','compare','coding')),
  assessment_level text NOT NULL CHECK (assessment_level IN ('recognition','recall','explanation','application','depth','transfer')),
  difficulty integer NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 5),
  title text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '',
  prompt text NOT NULL,
  estimated_minutes integer NOT NULL DEFAULT 3 CHECK (estimated_minutes > 0),
  source text NOT NULL DEFAULT 'builtin' CHECK (source IN ('builtin','generated','imported','interview_derived','external')),
  options jsonb,
  correct_option_id text,
  explanation text NOT NULL DEFAULT '',
  knowledge_points text[] NOT NULL DEFAULT '{}',
  hints text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((question_type = 'mcq' AND options IS NOT NULL AND correct_option_id IS NOT NULL) OR question_type <> 'mcq')
);
CREATE INDEX IF NOT EXISTS idx_questions_concept_level ON questions(concept_id, assessment_level, difficulty);

ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES questions(id) ON DELETE SET NULL;
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS selected_option_id text;
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS hints_used integer NOT NULL DEFAULT 0 CHECK (hints_used BETWEEN 0 AND 3);
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS max_hint_level integer NOT NULL DEFAULT 0 CHECK (max_hint_level BETWEEN 0 AND 3);
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS hint_timestamps timestamptz[] NOT NULL DEFAULT '{}';
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS time_taken_seconds integer CHECK (time_taken_seconds >= 0);
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS result_status text CHECK (result_status IN ('correct','partial','incorrect'));
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS evidence_weight numeric(4,3) NOT NULL DEFAULT 1 CHECK (evidence_weight BETWEEN 0 AND 1);

CREATE TABLE IF NOT EXISTS recall_dimension_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_attempt_id uuid NOT NULL REFERENCES recall_attempts(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('recognition','recall','explanation','application','depth','transfer')),
  score numeric(4,3) NOT NULL CHECK (score BETWEEN 0 AND 1),
  UNIQUE(recall_attempt_id, dimension)
);
CREATE INDEX IF NOT EXISTS idx_dimension_results_attempt ON recall_dimension_results(recall_attempt_id);

ALTER TABLE plan_tasks ADD COLUMN IF NOT EXISTS task_category text NOT NULL DEFAULT 'recommended' CHECK (task_category IN ('must_do','recommended','optional'));
ALTER TABLE plan_tasks ADD COLUMN IF NOT EXISTS sequence_order integer NOT NULL DEFAULT 0;
