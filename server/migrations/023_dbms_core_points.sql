-- Add the missing assessable points to the four existing DBMS concepts.
-- Name and normalized-statement matching makes replay idempotent and keeps
-- the existing concept identities and unrelated taxonomy records unchanged.
BEGIN;

WITH point_seed(concept_name,statement,importance,difficulty) AS (VALUES
  ('Data partitioning','Can distinguish horizontal table partitioning from vertical decomposition and distributed sharding.',90,3),
  ('Data partitioning','Can select and evaluate a partition key and strategy using query predicates, pruning, skew, and operational costs.',90,4),
  ('Read replication','Can reason about primary and replica roles, replication lag, stale reads, and read-after-write routing.',90,3),
  ('Read replication','Can compare asynchronous and synchronous replication guarantees and distinguish replication from backup and partitioning.',85,4),
  ('Join and aggregation queries','Can predict INNER and LEFT JOIN row preservation, NULL extension, and row multiplication from join cardinality.',90,3),
  ('Join and aggregation queries','Can write or diagnose grouped aggregates using WHERE, HAVING, join grain, and duplicate-count safeguards.',90,4),
  ('Relational data modeling','Can model entities and relationship cardinality with candidate and primary keys, foreign keys, and junction tables.',90,3),
  ('Relational data modeling','Can use functional dependencies, normalization, and constraints to prevent update anomalies while stating workload trade-offs.',85,4)
)
INSERT INTO knowledge_points(concept_id,statement,importance,difficulty)
SELECT c.id,p.statement,p.importance,p.difficulty
FROM point_seed p
JOIN canonical_concepts c ON lower(trim(c.name))=lower(trim(p.concept_name)) AND c.status='active'
JOIN topics t ON t.id=c.topic_id
JOIN canonical_skills s ON s.id=t.skill_id
JOIN knowledge_domains d ON d.id=s.domain_id AND d.name='Database Management Systems'
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge_points existing
  WHERE existing.concept_id=c.id
    AND lower(regexp_replace(trim(existing.statement),'[[:space:]]+',' ','g'))=
        lower(regexp_replace(trim(p.statement),'[[:space:]]+',' ','g'))
);

COMMIT;
