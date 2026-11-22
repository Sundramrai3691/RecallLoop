CREATE TABLE IF NOT EXISTS recall_sprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('in_progress','completed','abandoned')),
  idempotency_key uuid NOT NULL,
  repair_remediation_id uuid REFERENCES grounded_remediations(id) ON DELETE SET NULL,
  verification_attempt_id uuid REFERENCES recall_attempts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  UNIQUE(user_id,idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recall_sprints_one_active
  ON recall_sprints(user_id)
  WHERE status='in_progress';

CREATE TABLE IF NOT EXISTS recall_sprint_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL REFERENCES recall_sprints(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 3),
  source text NOT NULL CHECK (source IN ('due','weak','recent')),
  concept_id uuid NOT NULL REFERENCES personal_concepts(id) ON DELETE CASCADE,
  recall_attempt_id uuid NOT NULL REFERENCES recall_attempts(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sprint_id,position),
  UNIQUE(sprint_id,recall_attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_recall_sprint_items_sprint
  ON recall_sprint_items(sprint_id,position);
