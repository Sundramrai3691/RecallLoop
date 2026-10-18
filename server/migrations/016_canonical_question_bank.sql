CREATE TABLE IF NOT EXISTS canonical_question_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  canonical_concept_id uuid NOT NULL REFERENCES canonical_concepts(id) ON DELETE RESTRICT,
  current_revision integer NOT NULL CHECK (current_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canonical_question_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_item_id uuid NOT NULL REFERENCES canonical_question_items(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  question_type text NOT NULL CHECK (question_type IN ('mcq','rapid_recall','short_explanation','descriptive','comparison','scenario','application','transfer','explain','compare','coding')),
  assessment_level text NOT NULL CHECK (assessment_level IN ('recognition','recall','explanation','application','depth','transfer')),
  difficulty integer NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  objective text NOT NULL CHECK (length(trim(objective)) > 0),
  title text NOT NULL,
  context text NOT NULL DEFAULT '',
  prompt text NOT NULL CHECK (length(trim(prompt)) > 0),
  expected_answer text NOT NULL CHECK (length(trim(expected_answer)) > 0),
  rubric jsonb NOT NULL CHECK (jsonb_typeof(rubric)='array' AND jsonb_array_length(rubric)>0),
  expected_misconceptions jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(expected_misconceptions)='array'),
  estimated_minutes integer NOT NULL CHECK (estimated_minutes > 0),
  options jsonb,
  correct_option_id text,
  explanation text NOT NULL DEFAULT '',
  distractor_rationales jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(distractor_rationales)='array'),
  hints text[] NOT NULL DEFAULT '{}',
  question_origin text NOT NULL CHECK (question_origin IN ('original','adapted','imported')),
  source_title text NOT NULL CHECK (length(trim(source_title)) > 0),
  source_url text NOT NULL CHECK (source_url ~ '^https?://'),
  source_publisher text NOT NULL CHECK (length(trim(source_publisher)) > 0),
  source_license text NOT NULL CHECK (length(trim(source_license)) > 0),
  source_accessed_on date NOT NULL,
  source_notes text NOT NULL DEFAULT '',
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','engineering_reviewed','subject_matter_reviewed')),
  quality_status text NOT NULL DEFAULT 'pending' CHECK (quality_status IN ('pending','valid','invalid')),
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft','published','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(question_item_id,revision),
  CHECK (
    (question_type='mcq' AND options IS NOT NULL AND jsonb_typeof(options)='array' AND jsonb_array_length(options)>=2 AND correct_option_id IS NOT NULL AND length(trim(explanation))>0 AND jsonb_array_length(distractor_rationales)=jsonb_array_length(options)-1)
    OR
    (question_type<>'mcq' AND options IS NULL AND correct_option_id IS NULL AND jsonb_array_length(distractor_rationales)=0)
  )
);

CREATE TABLE IF NOT EXISTS canonical_question_revision_points (
  question_revision_id uuid NOT NULL REFERENCES canonical_question_revisions(id) ON DELETE RESTRICT,
  canonical_knowledge_point_id uuid NOT NULL REFERENCES knowledge_points(id) ON DELETE RESTRICT,
  PRIMARY KEY(question_revision_id,canonical_knowledge_point_id)
);

CREATE OR REPLACE FUNCTION validate_canonical_question_point_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item_concept uuid; point_concept uuid;
BEGIN
  SELECT i.canonical_concept_id INTO item_concept
  FROM canonical_question_revisions r JOIN canonical_question_items i ON i.id=r.question_item_id
  WHERE r.id=NEW.question_revision_id;
  SELECT concept_id INTO point_concept FROM knowledge_points WHERE id=NEW.canonical_knowledge_point_id;
  IF item_concept IS NULL OR point_concept IS NULL OR item_concept<>point_concept THEN
    RAISE EXCEPTION 'canonical question mapping must use a point from its canonical concept';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_canonical_question_point_mapping ON canonical_question_revision_points;
CREATE TRIGGER trg_validate_canonical_question_point_mapping BEFORE INSERT OR UPDATE ON canonical_question_revision_points
FOR EACH ROW EXECUTE FUNCTION validate_canonical_question_point_mapping();

CREATE OR REPLACE FUNCTION prevent_published_question_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.publication_status='published' THEN RAISE EXCEPTION 'published canonical question revisions are immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.publication_status='published' AND ROW(
    NEW.question_item_id,NEW.revision,NEW.question_type,NEW.assessment_level,NEW.difficulty,NEW.objective,NEW.title,NEW.context,
    NEW.prompt,NEW.expected_answer,NEW.rubric,NEW.expected_misconceptions,NEW.estimated_minutes,NEW.options,NEW.correct_option_id,
    NEW.explanation,NEW.distractor_rationales,NEW.hints,NEW.question_origin,NEW.source_title,NEW.source_url,NEW.source_publisher,
    NEW.source_license,NEW.source_accessed_on,NEW.source_notes
  ) IS DISTINCT FROM ROW(
    OLD.question_item_id,OLD.revision,OLD.question_type,OLD.assessment_level,OLD.difficulty,OLD.objective,OLD.title,OLD.context,
    OLD.prompt,OLD.expected_answer,OLD.rubric,OLD.expected_misconceptions,OLD.estimated_minutes,OLD.options,OLD.correct_option_id,
    OLD.explanation,OLD.distractor_rationales,OLD.hints,OLD.question_origin,OLD.source_title,OLD.source_url,OLD.source_publisher,
    OLD.source_license,OLD.source_accessed_on,OLD.source_notes
  ) THEN RAISE EXCEPTION 'published canonical question revision content is immutable; create a new revision'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_prevent_published_question_revision_mutation ON canonical_question_revisions;
CREATE TRIGGER trg_prevent_published_question_revision_mutation BEFORE UPDATE OR DELETE ON canonical_question_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_published_question_revision_mutation();

CREATE INDEX IF NOT EXISTS idx_canonical_question_items_concept ON canonical_question_items(canonical_concept_id);
CREATE INDEX IF NOT EXISTS idx_canonical_question_revisions_selection ON canonical_question_revisions(publication_status,quality_status,review_status,question_type,assessment_level,difficulty);
CREATE INDEX IF NOT EXISTS idx_canonical_question_revision_points_point ON canonical_question_revision_points(canonical_knowledge_point_id);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS rubric jsonb NOT NULL DEFAULT '[]';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS canonical_question_revision_id uuid REFERENCES canonical_question_revisions(id) ON DELETE RESTRICT;
ALTER TABLE recall_attempts ADD COLUMN IF NOT EXISTS canonical_question_revision_id uuid REFERENCES canonical_question_revisions(id) ON DELETE RESTRICT;
DROP INDEX IF EXISTS idx_questions_stable_prompt;
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_stable_prompt ON questions(concept_id,question_type,prompt) WHERE canonical_question_revision_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_canonical_revision ON questions(concept_id,canonical_question_revision_id) WHERE canonical_question_revision_id IS NOT NULL;
