INSERT INTO knowledge_domains (name, description) VALUES
  ('Backend Engineering', 'Foundational knowledge for building reliable backend systems.'),
  ('System Design', 'Reusable concepts for designing scalable distributed systems.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (domain_id, name, description)
SELECT id, 'Backend Engineer', 'Builds APIs, data systems, services, and operationally reliable backends.'
FROM knowledge_domains WHERE name = 'Backend Engineering'
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (domain_id, name, description)
SELECT id, 'System Design Practitioner', 'Designs reliable, scalable, observable distributed systems.'
FROM knowledge_domains WHERE name = 'System Design'
ON CONFLICT (name) DO NOTHING;

INSERT INTO canonical_skills (domain_id, name, description, priority)
SELECT d.id, skill.name, skill.description, skill.priority
FROM knowledge_domains d
CROSS JOIN (VALUES
  ('HTTP and APIs', 'Protocols, REST, authentication, authorization, and API behavior.', 95),
  ('Databases', 'SQL, indexes, transactions, consistency, replication, and sharding.', 90),
  ('Caching', 'Cache-aside, eviction, invalidation, and rate limiting.', 80),
  ('Messaging', 'Queues, pub/sub, retries, idempotency, and delivery semantics.', 80),
  ('Concurrency', 'Parallel work, coordination, backpressure, and safety.', 75),
  ('Operations', 'Containers, load balancing, observability, and reliability.', 70)
) AS skill(name, description, priority)
WHERE d.name = 'Backend Engineering'
ON CONFLICT (domain_id, name) DO NOTHING;

INSERT INTO role_skills (role_id, skill_id, priority, target_mastery)
SELECT r.id, s.id, s.priority, 0.8
FROM roles r
JOIN canonical_skills s ON s.name IN ('Scalability', 'Reliability', 'Architecture')
WHERE r.name = 'System Design Practitioner'
ON CONFLICT DO NOTHING;

INSERT INTO role_skills (role_id, skill_id, priority, target_mastery)
SELECT r.id, s.id, s.priority, 0.8
FROM roles r
JOIN canonical_skills s ON s.name IN ('HTTP and APIs', 'Databases', 'Caching', 'Messaging', 'Concurrency', 'Operations')
WHERE r.name = 'Backend Engineer'
ON CONFLICT DO NOTHING;

INSERT INTO role_skills (role_id, skill_id, priority, target_mastery)
SELECT r.id, s.id, s.priority, 0.8
FROM roles r
JOIN canonical_skills s ON s.name IN ('Scalability', 'Reliability', 'Architecture')
WHERE r.name = 'System Design Practitioner'
ON CONFLICT DO NOTHING;

INSERT INTO canonical_skills (domain_id, name, description, priority)
SELECT d.id, skill.name, skill.description, skill.priority
FROM knowledge_domains d
CROSS JOIN (VALUES
  ('Scalability', 'Capacity, bottlenecks, and horizontal scaling.', 95),
  ('Reliability', 'Failure handling, consistency, durability, and recovery.', 90),
  ('Architecture', 'Boundaries, tradeoffs, and system decomposition.', 85)
) AS skill(name, description, priority)
WHERE d.name = 'System Design'
ON CONFLICT (domain_id, name) DO NOTHING;

INSERT INTO topics (skill_id, name, description)
SELECT s.id, topic.name, topic.description
FROM canonical_skills s
JOIN (VALUES
  ('HTTP and APIs', 'HTTP', 'HTTP semantics, caching, and transport behavior.'),
  ('HTTP and APIs', 'REST', 'Resource-oriented API design.'),
  ('HTTP and APIs', 'Authentication', 'Identity verification and token handling.'),
  ('HTTP and APIs', 'Authorization', 'Access control and ownership boundaries.'),
  ('Databases', 'SQL', 'Relational queries and data modeling.'),
  ('Databases', 'Indexes', 'Query access paths and index tradeoffs.'),
  ('Databases', 'Transactions', 'Atomicity, isolation, and consistency.'),
  ('Databases', 'Replication and Sharding', 'Scaling reads and partitioning data.'),
  ('Caching', 'Caching', 'Cache-aside and invalidation.'),
  ('Caching', 'Eviction', 'LRU, LFU, and memory pressure.'),
  ('Caching', 'Rate Limiting', 'Protecting services from excess traffic.'),
  ('Messaging', 'Message Queues', 'Asynchronous work and consumer delivery.'),
  ('Messaging', 'Pub/Sub', 'Fanout and event notification.'),
  ('Messaging', 'Retries and Idempotency', 'Safe failure recovery.'),
  ('Concurrency', 'Concurrency', 'Coordination of simultaneous work.'),
  ('Operations', 'Load Balancing', 'Traffic distribution and health checks.'),
  ('Operations', 'Observability', 'Logs, metrics, traces, and diagnosis.'),
  ('Operations', 'Docker', 'Reproducible service packaging.')
) AS topic(skill_name, name, description) ON s.name = topic.skill_name
ON CONFLICT (skill_id, name) DO NOTHING;

INSERT INTO topics (skill_id, name, description)
SELECT s.id, topic.name, topic.description
FROM canonical_skills s
JOIN (VALUES
  ('Scalability', 'Capacity Planning', 'Estimating load and bottlenecks.'),
  ('Scalability', 'Distributed Systems', 'Coordination across independent nodes.'),
  ('Reliability', 'Consistency and Durability', 'Correctness during failures.'),
  ('Reliability', 'Failure Recovery', 'Degradation, retries, and recovery.'),
  ('Architecture', 'System Design Fundamentals', 'Tradeoffs and component boundaries.')
) AS topic(skill_name, name, description) ON s.name = topic.skill_name
ON CONFLICT (skill_id, name) DO NOTHING;

INSERT INTO canonical_concepts (topic_id, name, description, difficulty)
SELECT t.id, c.name, c.description, c.difficulty
FROM topics t
JOIN (VALUES
  ('HTTP', 'HTTP request lifecycle', 'Methods, status codes, headers, and body semantics.', 2),
  ('HTTP', 'HTTP caching', 'Freshness, validators, and cache-control.', 3),
  ('REST', 'Resource-oriented API design', 'Stable resources, representations, and idempotent methods.', 3),
  ('Authentication', 'Token authentication', 'Verifying identity with signed or opaque tokens.', 3),
  ('Authorization', 'Resource ownership', 'Enforcing access based on the authenticated principal.', 3),
  ('SQL', 'Relational data modeling', 'Tables, keys, relationships, and constraints.', 2),
  ('SQL', 'Join and aggregation queries', 'Combining and summarizing relational data.', 3),
  ('Indexes', 'Index selection', 'Choosing indexes from query patterns and write cost.', 3),
  ('Transactions', 'Isolation and atomicity', 'Keeping multi-step changes correct under concurrency.', 4),
  ('Replication and Sharding', 'Read replication', 'Scaling reads while handling replica lag.', 4),
  ('Replication and Sharding', 'Data partitioning', 'Distributing data across shards and routing requests.', 5),
  ('Caching', 'Cache-aside pattern', 'Read cache first, load on miss, then populate.', 2),
  ('Eviction', 'LRU and LFU eviction', 'Removing entries under memory pressure.', 3),
  ('Rate Limiting', 'Token bucket rate limiting', 'Controlling burst and sustained request rates.', 3),
  ('Rate Limiting', 'Distributed rate limiting', 'Coordinating limits across multiple service instances.', 5),
  ('Message Queues', 'Consumer acknowledgements', 'At-least-once delivery and acknowledgement timing.', 3),
  ('Message Queues', 'Dead letter handling', 'Isolating messages that repeatedly fail.', 3),
  ('Pub/Sub', 'Event fanout', 'Delivering events to multiple independent consumers.', 3),
  ('Retries and Idempotency', 'Retry backoff', 'Recovering from transient failures without overload.', 3),
  ('Retries and Idempotency', 'Idempotent operations', 'Making repeated requests safe.', 3),
  ('Concurrency', 'Work coordination', 'Locks, optimistic concurrency, and race prevention.', 4),
  ('Load Balancing', 'Health-aware routing', 'Distributing traffic only to healthy instances.', 3),
  ('Observability', 'Service telemetry', 'Logs, metrics, and traces for diagnosis.', 2),
  ('Docker', 'Container fundamentals', 'Packaging and operating repeatable services.', 2),
  ('Capacity Planning', 'Back-of-the-envelope capacity', 'Estimating traffic, storage, and compute needs.', 3),
  ('Distributed Systems', 'Failure and partition tradeoffs', 'Reasoning about partial failure and coordination.', 5),
  ('Consistency and Durability', 'Consistency models', 'Choosing consistency guarantees for a workload.', 5),
  ('Failure Recovery', 'Graceful degradation', 'Keeping essential behavior available during failure.', 4),
  ('System Design Fundamentals', 'Component boundary tradeoffs', 'Choosing service, data, and communication boundaries.', 3)
) AS c(topic_name, name, description, difficulty) ON t.name = c.topic_name
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_points (concept_id, statement, importance, difficulty)
SELECT c.id, point.statement, point.importance, point.difficulty
FROM canonical_concepts c
JOIN (VALUES
  ('HTTP request lifecycle', 'Can explain method, status, headers, and body roles.', 80, 2),
  ('HTTP caching', 'Can distinguish freshness from validation.', 80, 3),
  ('Cache-aside pattern', 'Can explain cache hit, miss, load, and populate steps.', 90, 2),
  ('Token bucket rate limiting', 'Can compare burst capacity and sustained rate.', 80, 3),
  ('Distributed rate limiting', 'Can explain coordination across service instances.', 90, 5),
  ('Consumer acknowledgements', 'Can explain acknowledgement timing and redelivery.', 90, 3),
  ('Idempotent operations', 'Can design a safe repeated operation.', 90, 3),
  ('Isolation and atomicity', 'Can describe atomic commit and isolation tradeoffs.', 90, 4),
  ('Component boundary tradeoffs', 'Can justify a boundary using scale and failure reasoning.', 90, 3)
) AS point(concept_name, statement, importance, difficulty) ON c.name = point.concept_name
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_sources (name, url, source_type, trust_tier, version_date, notes) VALUES
  ('MDN HTTP Documentation', 'https://developer.mozilla.org/en-US/docs/Web/HTTP', 'official_docs', 1, '2026', 'Curated reference for HTTP semantics.'),
  ('PostgreSQL Documentation', 'https://www.postgresql.org/docs/', 'official_docs', 1, '2026', 'Curated reference for relational behavior.'),
  ('AWS Architecture Center', 'https://aws.amazon.com/architecture/', 'official_docs', 2, '2026', 'Practitioner-oriented architecture references.'),
  ('Google SRE Resources', 'https://sre.google/resources/', 'practitioner', 2, '2026', 'Reliability and operations references.')
ON CONFLICT DO NOTHING;

INSERT INTO resources (title, url, provider, resource_type, estimated_minutes, difficulty, description, trust_tier, freshness, source_type) VALUES
  ('MDN HTTP overview', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview', 'MDN', 'documentation', 20, 2, 'HTTP request and response fundamentals.', 1, '2026', 'official_docs'),
  ('PostgreSQL transaction tutorial', 'https://www.postgresql.org/docs/current/tutorial-transactions.html', 'PostgreSQL', 'documentation', 15, 3, 'Atomicity and transaction behavior.', 1, '2026', 'official_docs'),
  ('AWS caching patterns', 'https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/database-caching-strategies-using-redis.html', 'AWS', 'article', 18, 3, 'Cache-aside and caching tradeoffs.', 2, '2026', 'official_docs'),
  ('Google SRE service reliability', 'https://sre.google/sre-book/part1/', 'Google', 'documentation', 25, 4, 'Reliability, monitoring, and failure thinking.', 2, '2026', 'practitioner')
ON CONFLICT (url) DO NOTHING;

INSERT INTO resource_coverage (resource_id, concept_id, coverage_strength)
SELECT r.id, c.id, coverage.strength
FROM resources r
JOIN canonical_concepts c ON (r.title = 'MDN HTTP overview' AND c.name IN ('HTTP request lifecycle', 'HTTP caching'))
  OR (r.title = 'PostgreSQL transaction tutorial' AND c.name = 'Isolation and atomicity')
  OR (r.title = 'AWS caching patterns' AND c.name = 'Cache-aside pattern')
  OR (r.title = 'Google SRE service reliability' AND c.name IN ('Graceful degradation', 'Service telemetry'))
CROSS JOIN (VALUES (0.85::numeric)) AS coverage(strength)
ON CONFLICT DO NOTHING;
