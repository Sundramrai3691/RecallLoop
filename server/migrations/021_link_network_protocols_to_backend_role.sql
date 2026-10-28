-- Link the reclassified Network Protocols skill to the Backend Engineer role
-- so canonical topics such as HTTP remain associated with the backend role roadmap.
INSERT INTO role_skills (role_id, skill_id, priority, target_mastery)
SELECT r.id, s.id, COALESCE(s.priority, 90), COALESCE(s.target_mastery, 0.8)
FROM roles r
CROSS JOIN canonical_skills s
JOIN knowledge_domains d ON d.id = s.domain_id
WHERE r.name = 'Backend Engineer'
  AND s.name = 'Network Protocols'
  AND d.name = 'Computer Networks'
ON CONFLICT (role_id, skill_id) DO NOTHING;
