-- Core SDE catalog expansion. Stable existing concepts are reused. All inserts
-- are name-keyed and idempotent so repeated migration/seed runs preserve IDs.
BEGIN;

INSERT INTO knowledge_domains(name,description) VALUES
 ('Data Structures and Algorithms','Choose data representations and algorithms by correctness, complexity, and workload.'),
 ('Operating Systems','Reason about execution, scheduling, synchronization, and resource ownership.'),
 ('Database Management Systems','Reason about transactional behavior, indexes, and query execution.'),
 ('Computer Networks','Reason about transport reliability and application protocol behavior.')
ON CONFLICT(name) DO UPDATE SET description=EXCLUDED.description;

-- Existing Database concepts keep their UUIDs and learner history while the
-- broad skill is classified under the dedicated DBMS domain.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM canonical_skills source JOIN knowledge_domains source_domain ON source_domain.id=source.domain_id
    JOIN canonical_skills target ON target.name=source.name JOIN knowledge_domains target_domain ON target_domain.id=target.domain_id
    JOIN topics t ON t.skill_id=source.id JOIN canonical_concepts c ON c.topic_id=t.id
    WHERE source.name='Databases' AND source_domain.name='Backend Engineering' AND target_domain.name='Database Management Systems'
      AND (EXISTS(SELECT 1 FROM personal_concepts x WHERE x.canonical_concept_id=c.id)
        OR EXISTS(SELECT 1 FROM study_sessions x WHERE x.canonical_concept_id=c.id)
        OR EXISTS(SELECT 1 FROM baseline_questions x WHERE x.concept_id=c.id)
        OR EXISTS(SELECT 1 FROM canonical_question_items x WHERE x.canonical_concept_id=c.id)
        OR EXISTS(SELECT 1 FROM learner_knowledge_states x WHERE x.canonical_concept_id=c.id))
  ) THEN RAISE EXCEPTION 'duplicate legacy Databases branch has learner or question-bank references; reconcile canonical identities before reclassification'; END IF;
END $$;
DELETE FROM canonical_skills source
USING knowledge_domains source_domain,canonical_skills target,knowledge_domains target_domain
WHERE source.domain_id=source_domain.id AND source_domain.name='Backend Engineering' AND source.name='Databases'
  AND target.name=source.name AND target.domain_id=target_domain.id AND target_domain.name='Database Management Systems';
UPDATE canonical_skills SET domain_id=(SELECT id FROM knowledge_domains WHERE name='Database Management Systems')
WHERE name='Databases' AND domain_id=(SELECT id FROM knowledge_domains WHERE name='Backend Engineering');

INSERT INTO canonical_skills(domain_id,name,description,priority,target_mastery)
SELECT d.id,x.name,x.description,90,0.8 FROM knowledge_domains d CROSS JOIN (VALUES
 ('Data Structures and Algorithms','Select representations and algorithms and explain their cost.'),
 ('Operating Systems','Explain process execution and safe coordination.'),
 ('Computer Networks','Explain transport and application-layer behavior.')
) AS x(name,description) WHERE d.name=x.name
ON CONFLICT(domain_id,name) DO UPDATE SET description=EXCLUDED.description;

-- HTTP is moved as a topic, preserving its topic, concept, point, question,
-- and attempt identifiers. Authentication and REST remain in Backend Engineering.
INSERT INTO canonical_skills(domain_id,name,description,priority,target_mastery)
SELECT d.id,'Network Protocols','Understand transport protocols and HTTP semantics.',90,0.8
FROM knowledge_domains d WHERE d.name='Computer Networks'
ON CONFLICT(domain_id,name) DO UPDATE SET description=EXCLUDED.description;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM topics source JOIN canonical_skills old_skill ON old_skill.id=source.skill_id
    JOIN knowledge_domains old_domain ON old_domain.id=old_skill.domain_id
    JOIN canonical_skills target_skill ON target_skill.name='Network Protocols'
    JOIN knowledge_domains target_domain ON target_domain.id=target_skill.domain_id AND target_domain.name='Computer Networks'
    JOIN topics target ON target.skill_id=target_skill.id AND target.name=source.name
    JOIN canonical_concepts c ON c.topic_id=source.id
    WHERE source.name='HTTP' AND old_skill.name='HTTP and APIs' AND old_domain.name='Backend Engineering'
      AND (EXISTS(SELECT 1 FROM personal_concepts x WHERE x.canonical_concept_id=c.id)
        OR EXISTS(SELECT 1 FROM study_sessions x WHERE x.canonical_concept_id=c.id OR x.canonical_topic_id=source.id)
        OR EXISTS(SELECT 1 FROM baseline_questions x WHERE x.concept_id=c.id)
        OR EXISTS(SELECT 1 FROM canonical_question_items x WHERE x.canonical_concept_id=c.id)
        OR EXISTS(SELECT 1 FROM learner_knowledge_states x WHERE x.canonical_concept_id=c.id))
  ) THEN RAISE EXCEPTION 'duplicate legacy HTTP branch has learner or question-bank references; reconcile canonical identities before reclassification'; END IF;
END $$;
DELETE FROM topics source USING canonical_skills old_skill,knowledge_domains old_domain,
  canonical_skills target_skill,knowledge_domains target_domain,topics target
WHERE source.skill_id=old_skill.id AND old_skill.name='HTTP and APIs' AND old_skill.domain_id=old_domain.id AND old_domain.name='Backend Engineering'
  AND target_skill.name='Network Protocols' AND target_skill.domain_id=target_domain.id AND target_domain.name='Computer Networks'
  AND target.skill_id=target_skill.id AND target.name=source.name AND source.name='HTTP';

UPDATE topics SET skill_id=(SELECT s.id FROM canonical_skills s JOIN knowledge_domains d ON d.id=s.domain_id
  WHERE d.name='Computer Networks' AND s.name='Network Protocols')
WHERE name='HTTP' AND skill_id IN (SELECT id FROM canonical_skills WHERE name='HTTP and APIs');

WITH topic_seed(domain_name,skill_name,topic_name,topic_description,concept_name,concept_description,difficulty) AS (VALUES
 ('Data Structures and Algorithms','Data Structures and Algorithms','Arrays and Hashing','Compare sequential storage with keyed lookup for concrete workloads.','Array and hash lookup trade-offs','Choose an array or hash-based representation and account for complexity and assumptions.',3),
 ('Data Structures and Algorithms','Data Structures and Algorithms','Trees and Graphs','Choose traversal and search strategies from structure and requirements.','Tree and graph traversal decisions','Select a traversal or search strategy and state its correctness and cost conditions.',3),
 ('Operating Systems','Operating Systems','Processes and Scheduling','Explain process and thread state and how scheduling affects progress.','Processes, threads, and scheduling','Distinguish process and thread execution state and reason about scheduling outcomes.',3),
 ('Operating Systems','Operating Systems','Synchronization','Diagnose races and deadlocks and choose synchronization conditions.','Synchronization and deadlocks','Identify shared-state races and reason about lock ordering and deadlock conditions.',4),
 ('Computer Networks','Network Protocols','TCP Reliability','Explain ordered delivery, retransmission, and connection state without assuming application messages.','TCP reliable byte streams','Reason about TCP ordering, retransmission, and byte-stream boundaries under loss.',3)
)
INSERT INTO topics(skill_id,name,description)
SELECT s.id,x.topic_name,x.topic_description FROM topic_seed x
JOIN knowledge_domains d ON d.name=x.domain_name JOIN canonical_skills s ON s.domain_id=d.id AND s.name=x.skill_name
ON CONFLICT(skill_id,name) DO UPDATE SET description=EXCLUDED.description;

WITH concept_seed(domain_name,skill_name,topic_name,concept_name,concept_description,difficulty) AS (VALUES
 ('Data Structures and Algorithms','Data Structures and Algorithms','Arrays and Hashing','Array and hash lookup trade-offs','Choose a representation based on lookup, update, ordering, and memory requirements.',3),
 ('Data Structures and Algorithms','Data Structures and Algorithms','Trees and Graphs','Tree and graph traversal decisions','Select traversal and search strategies from structure, goal, and graph properties.',3),
 ('Operating Systems','Operating Systems','Processes and Scheduling','Processes, threads, and scheduling','Reason about execution state, shared address space, and scheduling behavior.',3),
 ('Operating Systems','Operating Systems','Synchronization','Synchronization and deadlocks','Diagnose races and deadlocks from shared state, locking, and resource ordering.',4),
 ('Computer Networks','Network Protocols','TCP Reliability','TCP reliable byte streams','Reason about TCP ordering, retransmission, and the application-visible byte stream.',3)
)
INSERT INTO canonical_concepts(topic_id,name,description,difficulty,status)
SELECT t.id,x.concept_name,x.concept_description,x.difficulty,'active' FROM concept_seed x
JOIN knowledge_domains d ON d.name=x.domain_name JOIN canonical_skills s ON s.domain_id=d.id AND s.name=x.skill_name
JOIN topics t ON t.skill_id=s.id AND t.name=x.topic_name
ON CONFLICT(topic_id,name) DO UPDATE SET description=EXCLUDED.description,difficulty=EXCLUDED.difficulty,status='active';

-- Add observable point statements only when the exact statement is absent.
WITH point_seed(domain_name,skill_name,topic_name,concept_name,statement,importance,difficulty) AS (VALUES
 ('Data Structures and Algorithms','Data Structures and Algorithms','Arrays and Hashing','Array and hash lookup trade-offs','Can choose between array scanning and hash lookup from operation mix and expected complexity.',90,2),
 ('Data Structures and Algorithms','Data Structures and Algorithms','Arrays and Hashing','Array and hash lookup trade-offs','Can explain collision handling, key equality, and expected-versus-worst-case hash lookup.',80,3),
 ('Data Structures and Algorithms','Data Structures and Algorithms','Trees and Graphs','Tree and graph traversal decisions','Can choose BFS or DFS to satisfy shortest unweighted path, reachability, or traversal requirements.',90,3),
 ('Data Structures and Algorithms','Data Structures and Algorithms','Trees and Graphs','Tree and graph traversal decisions','Can explain when a visited set is required and bound traversal work by vertices and edges.',80,3),
 ('Operating Systems','Operating Systems','Processes and Scheduling','Processes, threads, and scheduling','Can distinguish process isolation from threads sharing an address space and resources.',90,2),
 ('Operating Systems','Operating Systems','Processes and Scheduling','Processes, threads, and scheduling','Can explain how preemption and scheduling policy affect latency, fairness, and throughput.',80,3),
 ('Operating Systems','Operating Systems','Synchronization','Synchronization and deadlocks','Can identify a data race and state the synchronization needed to protect an invariant.',90,3),
 ('Operating Systems','Operating Systems','Synchronization','Synchronization and deadlocks','Can diagnose deadlock using the four necessary conditions and propose a condition-breaking remedy.',90,4),
 ('Database Management Systems','Databases','Transactions','Isolation and atomicity','Can predict a non-repeatable read or serialization anomaly from a transaction schedule and isolation level.',90,4),
 ('Database Management Systems','Databases','Indexes','Index selection','Can explain how a composite B-tree index column order affects equality and range predicates.',90,3),
 ('Database Management Systems','Databases','Indexes','Index selection','Can weigh index selectivity and read benefit against write, storage, and maintenance cost.',80,3),
 ('Computer Networks','Network Protocols','TCP Reliability','TCP reliable byte streams','Can explain how sequence numbers and retransmission recover missing bytes while preserving ordered delivery.',90,3),
 ('Computer Networks','Network Protocols','TCP Reliability','TCP reliable byte streams','Can explain that TCP exposes a byte stream and does not preserve application write or message boundaries.',85,3),
 ('System Design','Scalability','Capacity Planning','Back-of-the-envelope capacity','Can estimate request rate and storage from explicit workload assumptions and unit conversions.',90,2),
 ('System Design','Scalability','Distributed Systems','Failure and partition tradeoffs','Can explain which consistency and availability behavior a client observes during a network partition.',90,4),
 ('System Design','Reliability','Consistency and Durability','Consistency models','Can distinguish strong read-after-write behavior from eventual convergence for replicated data.',85,3),
 ('System Design','Reliability','Failure Recovery','Graceful degradation','Can choose a bounded fallback when a dependency fails and state which user-visible guarantee changes.',85,4)
)
INSERT INTO knowledge_points(concept_id,statement,importance,difficulty)
SELECT c.id,p.statement,p.importance,p.difficulty FROM point_seed p
JOIN knowledge_domains d ON d.name=p.domain_name JOIN canonical_skills s ON s.domain_id=d.id AND s.name=p.skill_name
JOIN topics t ON t.skill_id=s.id AND t.name=p.topic_name JOIN canonical_concepts c ON c.topic_id=t.id AND c.name=p.concept_name
WHERE NOT EXISTS (SELECT 1 FROM knowledge_points kp WHERE kp.concept_id=c.id AND lower(regexp_replace(trim(kp.statement),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(p.statement),'[[:space:]]+',' ','g')));

COMMIT;
