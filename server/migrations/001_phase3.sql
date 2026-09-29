CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS knowledge_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES knowledge_domains(id) ON DELETE CASCADE,
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canonical_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES knowledge_domains(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  target_mastery numeric(4,3) NOT NULL DEFAULT 0.8 CHECK (target_mastery BETWEEN 0 AND 1),
  UNIQUE(domain_id, name)
);

CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES canonical_skills(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  UNIQUE(skill_id, name)
);

CREATE TABLE IF NOT EXISTS canonical_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  difficulty integer NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL REFERENCES canonical_concepts(id) ON DELETE CASCADE,
  statement text NOT NULL,
  importance integer NOT NULL DEFAULT 50 CHECK (importance BETWEEN 0 AND 100),
  difficulty integer NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS concept_prerequisites (
  concept_id uuid NOT NULL REFERENCES canonical_concepts(id) ON DELETE CASCADE,
  prerequisite_concept_id uuid NOT NULL REFERENCES canonical_concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (concept_id, prerequisite_concept_id),
  CHECK (concept_id <> prerequisite_concept_id)
);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  source_type text NOT NULL,
  trust_tier integer NOT NULL DEFAULT 2 CHECK (trust_tier BETWEEN 1 AND 4),
  version_date text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS concept_sources (
  concept_id uuid NOT NULL REFERENCES canonical_concepts(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (concept_id, source_id)
);

CREATE TABLE IF NOT EXISTS role_skills (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES canonical_skills(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  target_mastery numeric(4,3) NOT NULL DEFAULT 0.8 CHECK (target_mastery BETWEEN 0 AND 1),
  PRIMARY KEY (role_id, skill_id)
);

CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL UNIQUE,
  provider text NOT NULL,
  resource_type text NOT NULL,
  estimated_minutes integer NOT NULL CHECK (estimated_minutes > 0),
  difficulty integer NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  description text NOT NULL DEFAULT '',
  trust_tier integer NOT NULL DEFAULT 2 CHECK (trust_tier BETWEEN 1 AND 4),
  freshness text NOT NULL DEFAULT '',
  source_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_coverage (
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES canonical_concepts(id) ON DELETE CASCADE,
  coverage_strength numeric(4,3) NOT NULL CHECK (coverage_strength BETWEEN 0 AND 1),
  PRIMARY KEY (resource_id, concept_id)
);

CREATE TABLE IF NOT EXISTS baseline_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  goal_id text NOT NULL,
  skill_id uuid REFERENCES canonical_skills(id),
  selected_level text NOT NULL CHECK (selected_level IN ('new','familiar','advanced')),
  baseline_source text NOT NULL CHECK (baseline_source IN ('assessed','self_declared','skipped')),
  baseline_confidence numeric(4,3) NOT NULL DEFAULT 0 CHECK (baseline_confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'pending',
  observed_mastery numeric(4,3) NOT NULL DEFAULT 0 CHECK (observed_mastery BETWEEN 0 AND 1),
  self_declared_mastery numeric(4,3) NOT NULL DEFAULT 0 CHECK (self_declared_mastery BETWEEN 0 AND 1),
  recommended_concept_id uuid REFERENCES canonical_concepts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS baseline_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES baseline_assessments(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES canonical_concepts(id),
  knowledge_point_id uuid REFERENCES knowledge_points(id),
  level text NOT NULL CHECK (level IN ('L1','L2','L3','L4','L5')),
  question text NOT NULL,
  answer text,
  coverage numeric(4,3),
  confidence integer CHECK (confidence BETWEEN 1 AND 10),
  knowledge_point_results jsonb,
  submitted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_baseline_user ON baseline_assessments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_coverage_concept ON resource_coverage(concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_topic ON canonical_concepts(topic_id);

CREATE TABLE IF NOT EXISTS learner_knowledge_states (
  user_id text NOT NULL,
  canonical_concept_id uuid NOT NULL REFERENCES canonical_concepts(id) ON DELETE CASCADE,
  observed_mastery numeric(4,3) NOT NULL DEFAULT 0 CHECK (observed_mastery BETWEEN 0 AND 1),
  self_declared_mastery numeric(4,3) NOT NULL DEFAULT 0 CHECK (self_declared_mastery BETWEEN 0 AND 1),
  observed_confidence numeric(4,3) NOT NULL DEFAULT 0 CHECK (observed_confidence BETWEEN 0 AND 1),
  baseline_source text NOT NULL CHECK (baseline_source IN ('assessed','self_declared','skipped')),
  last_assessed_at timestamptz,
  PRIMARY KEY (user_id, canonical_concept_id)
);
