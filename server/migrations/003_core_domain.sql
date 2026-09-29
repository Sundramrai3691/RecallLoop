CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  goal_type text NOT NULL DEFAULT 'learning' CHECK (goal_type IN ('learning','exam','interview','career','project','personal')),
  target_date date,
  weekly_time_budget_minutes integer NOT NULL DEFAULT 240 CHECK (weekly_time_budget_minutes >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS learner_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  target_mastery numeric(4,3) NOT NULL DEFAULT 0.8 CHECK (target_mastery BETWEEN 0 AND 1),
  current_mastery numeric(4,3) NOT NULL DEFAULT 0.3 CHECK (current_mastery BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learner_skills_goal ON learner_skills(user_id, goal_id, priority DESC);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, goal_id)
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  raw_material text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','notes','url','file')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_updated ON study_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS personal_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  study_session_id uuid NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  parent_concept_id uuid REFERENCES personal_concepts(id),
  required_knowledge_points text[] NOT NULL DEFAULT '{}',
  difficulty integer NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  mastery numeric(4,3) NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personal_concepts_user ON personal_concepts(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS recall_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES personal_concepts(id) ON DELETE CASCADE,
  study_session_id uuid NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  question_type text NOT NULL,
  question text NOT NULL,
  answer text,
  confidence integer CHECK (confidence BETWEEN 1 AND 10),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recall_pending ON recall_attempts(user_id, submitted_at, created_at);

CREATE TABLE IF NOT EXISTS recall_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_attempt_id uuid NOT NULL UNIQUE REFERENCES recall_attempts(id) ON DELETE CASCADE,
  overall_coverage numeric(4,3) NOT NULL CHECK (overall_coverage BETWEEN 0 AND 1),
  missing_concepts text[] NOT NULL DEFAULT '{}',
  mistakes text[] NOT NULL DEFAULT '{}',
  strengths text[] NOT NULL DEFAULT '{}',
  feedback text NOT NULL,
  suggested_recall_type text NOT NULL,
  evaluator_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recall_knowledge_point_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES recall_evaluations(id) ON DELETE CASCADE,
  point text NOT NULL,
  status text NOT NULL CHECK (status IN ('correct','partial','missing')),
  evidence text NOT NULL DEFAULT '',
  feedback text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS review_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES personal_concepts(id) ON DELETE CASCADE,
  state text NOT NULL,
  due_at timestamptz NOT NULL,
  interval_days integer NOT NULL DEFAULT 0,
  stability numeric NOT NULL DEFAULT 0,
  difficulty numeric NOT NULL DEFAULT 0.5,
  last_recall_at timestamptz,
  last_outcome text,
  consecutive_successes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, concept_id)
);
CREATE INDEX IF NOT EXISTS idx_review_due ON review_states(user_id, due_at);

CREATE TABLE IF NOT EXISTS plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goals(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES learner_skills(id) ON DELETE SET NULL,
  concept_id uuid REFERENCES personal_concepts(id) ON DELETE SET NULL,
  recall_attempt_id uuid REFERENCES recall_attempts(id) ON DELETE SET NULL,
  task_type text NOT NULL CHECK (task_type IN ('learn','recall','practice','assessment','remediation')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  estimated_minutes integer NOT NULL DEFAULT 30 CHECK (estimated_minutes >= 0),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','missed')),
  source text NOT NULL CHECK (source IN ('planner','scheduler','learner_model','manual')),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_today ON plan_tasks(user_id, scheduled_for, priority DESC);

CREATE TABLE IF NOT EXISTS learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_created ON learning_events(user_id, created_at DESC);
