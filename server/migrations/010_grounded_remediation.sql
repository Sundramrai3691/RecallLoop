-- pgvector is not installed in the current PostgreSQL runtime. Persist fixed
-- dimension embeddings as real[] and rank them in the retrieval service.
CREATE TABLE IF NOT EXISTS grounding_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES resources(id) ON DELETE SET NULL,
  title text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('text','markdown')),
  reference text NOT NULL DEFAULT '',
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  content text NOT NULL,
  content_hash text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','processed','failed')),
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,content_hash)
);
CREATE INDEX IF NOT EXISTS idx_grounding_sources_user_status ON grounding_sources(user_id,processing_status,created_at DESC);

CREATE TABLE IF NOT EXISTS grounding_chunks (
  id text PRIMARY KEY,
  source_id uuid NOT NULL REFERENCES grounding_sources(id) ON DELETE CASCADE,
  chunk_order integer NOT NULL CHECK (chunk_order >= 0),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding real[] NOT NULL,
  embedding_model text NOT NULL,
  embedding_dimensions integer NOT NULL CHECK (embedding_dimensions > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id,chunk_order)
);
CREATE INDEX IF NOT EXISTS idx_grounding_chunks_source_order ON grounding_chunks(source_id,chunk_order);
CREATE INDEX IF NOT EXISTS idx_grounding_chunks_embedding_model ON grounding_chunks(embedding_model,embedding_dimensions);

CREATE TABLE IF NOT EXISTS grounded_remediations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  triggering_attempt_id uuid NOT NULL REFERENCES recall_attempts(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES personal_concepts(id) ON DELETE CASCADE,
  knowledge_point text NOT NULL,
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','insufficient_sources','failed','ready','verification_created','verified')),
  content jsonb,
  generation_error text,
  trigger_score numeric(5,4) CHECK (trigger_score BETWEEN 0 AND 1),
  verification_attempt_id uuid REFERENCES recall_attempts(id) ON DELETE SET NULL,
  verification_score numeric(5,4) CHECK (verification_score BETWEEN 0 AND 1),
  improved boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(triggering_attempt_id)
);
CREATE INDEX IF NOT EXISTS idx_grounded_remediations_user_created ON grounded_remediations(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS grounded_remediation_chunks (
  remediation_id uuid NOT NULL REFERENCES grounded_remediations(id) ON DELETE CASCADE,
  chunk_id text NOT NULL REFERENCES grounding_chunks(id) ON DELETE RESTRICT,
  rank integer NOT NULL CHECK (rank > 0),
  relevance numeric(5,4) NOT NULL CHECK (relevance BETWEEN 0 AND 1),
  PRIMARY KEY(remediation_id,chunk_id),
  UNIQUE(remediation_id,rank)
);
CREATE INDEX IF NOT EXISTS idx_grounded_remediation_chunks_chunk ON grounded_remediation_chunks(chunk_id);

ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS remediation_id uuid REFERENCES grounded_remediations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_recall_attempts_remediation ON recall_attempts(remediation_id) WHERE remediation_id IS NOT NULL;
