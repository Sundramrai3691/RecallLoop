import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { postgres, runPostgresMigration, withTransaction } from "../../src/db/postgres.js";
import { createAssessment,createCanonicalKnowledgeCheck,getAssessment,listKnowledgeCheckCoverage } from "../../src/services/question/assessmentService.js";
import { createBaseline,getBaseline,submitBaselineQuestion } from "../../src/services/baseline/baselineService.js";
import { createConceptsForSession } from "../../src/services/concept/conceptService.js";
import { createConcepts,createSession,getAttempt,getSession,revealNextHint,resolveCanonicalKnowledgePoint } from "../../src/repositories/legacyPostgresRepositories.js";
import { submitRecall } from "../../src/services/recall/recallService.js";
import { getSettings,updateSettings } from "../../src/services/settings/settingsService.js";
import { recommendResources } from "../../src/services/resources/resourceRecommendationService.js";
import { buildLearningPack } from "../../src/services/resources/learningPackService.js";
import { createGoal,generateGoalPlan,getGoalReadiness,getTodayPlan } from "../../src/services/goal/goalService.js";
import { getConceptState,getWeakSkills } from "../../src/services/learner/learnerModelService.js";
import { createGroundedRemediation,getGroundedRemediation,getGroundingSource,ingestGroundingSource } from "../../src/services/grounding/groundedRemediationService.js";
import { createTargetedVerification } from "../../src/services/question/assessmentService.js";
import { serializeAttempt,serializeSession } from "../../src/lib/serialize.js";
import { getRoleRoadmap } from "../../src/services/knowledge/knowledgeService.js";
import { createStudySession } from "../../src/services/study/studySessionService.js";
import { env } from "../../src/config/env.js";
import { resetEvaluatorForTests } from "../../src/services/evaluator/index.js";
import { seedCanonicalQuestionBank } from "../../src/db/seedCanonicalQuestionBank.js";
import { listEligibleCanonicalQuestions } from "../../src/services/questionBank/questionBankService.js";
import { canonicalCoreSdeQuestions } from "../../src/services/questionBank/coreSdeQuestionBank.js";

describe("PostgreSQL runtime integration", () => {
  beforeAll(async () => {
    await runPostgresMigration();
    await seedCanonicalQuestionBank();
  });

  afterAll(async () => {
    await postgres.end();
  });

  it("applies relational schema and exposes core tables", async () => {
    const result = await postgres.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('app_users','goals','study_sessions','recall_attempts','recall_evaluations','review_states','canonical_concepts','baseline_assessments','resources','questions','assessment_sessions','recall_dimension_results','assessment_recommendations','canonical_question_items','canonical_question_revisions','canonical_question_revision_points')`);
    expect(result.rows.length).toBe(16);
    const reviewTables = await postgres.query<any>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('canonical_question_reviewers','canonical_question_reviews')`);
    expect(reviewTables.rows).toHaveLength(2);
    const structured=await postgres.query<any>(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='questions' AND column_name='question_parts') OR (table_name='recall_attempts' AND column_name='structured_answers') OR (table_name='recall_knowledge_point_results' AND column_name IN ('part_id','canonical_knowledge_point_id')) OR (table_name='learner_knowledge_point_states' AND column_name='canonical_knowledge_point_id') OR (table_name='personal_concepts' AND column_name='canonical_concept_id') OR (table_name='study_sessions' AND column_name IN ('source_url','canonical_topic_id','canonical_concept_id')))`);
    expect(structured.rows).toHaveLength(9);
  });

  it("preserves the exact current automated approval when migrations are replayed", async () => {
    const revision = (await postgres.query<any>(`SELECT r.id,r.content_hash,r.review_status,r.publication_status
      FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision
      JOIN canonical_question_automated_reviews ar ON ar.question_revision_id=r.id AND ar.content_hash=r.content_hash AND ar.decision='approved'
      WHERE i.slug='http-cache-recognition-freshness-directive'
      ORDER BY ar.reviewed_at DESC,ar.id DESC LIMIT 1`)).rows[0];
    if (!revision) return; // Fresh, not-yet-activated databases have no approval to preserve.
    expect(revision).toMatchObject({ review_status: "automated_reviewed", publication_status: "published" });
    try {
      await postgres.query(`UPDATE canonical_question_revisions SET review_status='awaiting_subject_matter_review',publication_status='draft' WHERE id=$1`, [revision.id]);
      await runPostgresMigration();
      const restored = (await postgres.query<any>(`SELECT r.content_hash,r.review_status,r.publication_status
        FROM canonical_question_revisions r WHERE r.id=$1`, [revision.id])).rows[0];
      expect(restored).toEqual({ content_hash: revision.content_hash, review_status: "automated_reviewed", publication_status: "published" });
    } finally {
      await postgres.query(`UPDATE canonical_question_revisions SET review_status=$2,publication_status=$3 WHERE id=$1`, [revision.id,revision.review_status,revision.publication_status]);
    }
  });

  it("selects reviewed HTTP Rapid Fire and mastery questions",async()=>{
    await seedCanonicalQuestionBank();
    const pilotCounts=await postgres.query<any>(`SELECT r.review_status,r.publication_status,count(*)::int AS count FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision WHERE i.slug LIKE 'http-%' GROUP BY r.review_status,r.publication_status`);
    expect(pilotCounts.rows).toEqual([{ review_status: "automated_reviewed", publication_status: "published", count: 24 }]);
    const revisionCounts=await postgres.query<any>(`SELECT count(*)::int AS revisions,count(*) FILTER (WHERE ar.decision='approved' AND ar.content_hash=r.content_hash)::int AS automated_approvals,count(*) FILTER (WHERE cr.decision='approved')::int AS human_approvals FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id LEFT JOIN canonical_question_reviews cr ON cr.question_revision_id=r.id LEFT JOIN canonical_question_automated_reviews ar ON ar.question_revision_id=r.id WHERE i.slug LIKE 'http-%'`);
    expect(Number(revisionCounts.rows[0].revisions)).toBeGreaterThanOrEqual(24);
    expect(Number(revisionCounts.rows[0].automated_approvals)).toBeGreaterThanOrEqual(24);
    expect(revisionCounts.rows[0].human_approvals).toBe(0);
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Canonical question pilot') RETURNING id`,[`question-bank-${randomUUID()}@test.local`])).rows[0].id;
    try{
      const catalog=(await postgres.query<any>(`SELECT cc.id AS concept_id,kp.id AS point_id,kp.statement FROM canonical_concepts cc JOIN topics t ON t.id=cc.topic_id JOIN knowledge_points kp ON kp.concept_id=cc.id WHERE t.name='HTTP' AND cc.name='HTTP caching' AND cc.status='active'`)).rows[0];
      const coverage=await listKnowledgeCheckCoverage();
      const coveredConcept=coverage.flatMap((subject:any)=>subject.topics.flatMap((topic:any)=>topic.concepts)).find((concept:any)=>concept.id===catalog.concept_id);
      expect(coveredConcept.supportedModes).toContain("rapid_fire");
      const rapidFire=await createCanonicalKnowledgeCheck(userId,catalog.concept_id,"rapid_fire");
      expect(rapidFire.questions).toHaveLength(5);
      const selectedRevisions=rapidFire.questions.map((question:any)=>question.canonicalQuestionRevisionId);
      expect(selectedRevisions.every(Boolean)).toBe(true);
      const selectedState=await postgres.query<any>(`SELECT count(*)::int total,count(*) FILTER(WHERE r.review_status='automated_reviewed' AND r.publication_status='published' AND r.content_hash=ar.content_hash AND ar.decision='approved')::int eligible FROM recall_attempts a JOIN canonical_question_revisions r ON r.id=a.canonical_question_revision_id JOIN canonical_question_automated_reviews ar ON ar.question_revision_id=r.id AND ar.content_hash=r.content_hash WHERE a.id=ANY($1::uuid[])`,[rapidFire.questions.map((question:any)=>question.id)]);
      expect(selectedState.rows[0]).toEqual({total:5,eligible:5});
      const mastery=await createAssessment(userId,rapidFire.questions[0].conceptId,"mastery_check");
      expect(mastery.assessment.total).toBe(6);
      expect(mastery.questions.every((question:any)=>question.canonicalQuestionRevisionId)).toBe(true);
    }finally{
      await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);
    }
  });

  it("exposes the five Core SDE domains, exact current question coverage, and honest review blockers",async()=>{
    const before=await postgres.query<any>(`SELECT count(*)::int revisions,count(DISTINCT i.id)::int identities FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id`);
    const domains=await postgres.query<any>(`SELECT d.name,count(DISTINCT t.id)::int topics,count(DISTINCT kp.id)::int points FROM knowledge_domains d JOIN canonical_skills s ON s.domain_id=d.id JOIN topics t ON t.skill_id=s.id JOIN canonical_concepts c ON c.topic_id=t.id AND c.status='active' LEFT JOIN knowledge_points kp ON kp.concept_id=c.id GROUP BY d.name`);
    const coreNames=["Data Structures and Algorithms","Operating Systems","Database Management Systems","Computer Networks","System Design"];
    for(const name of coreNames)expect(domains.rows.some((row:any)=>row.name===name)).toBe(true);
    const coreCoverage=await listKnowledgeCheckCoverage();
    const coreSubjects=coreCoverage.filter((subject:any)=>coreNames.includes(subject.domainName));
    expect(new Set(coreSubjects.map((subject:any)=>subject.domainName))).toEqual(new Set(coreNames));
    expect(canonicalCoreSdeQuestions).toHaveLength(162);
    const candidates=await postgres.query<any>(`SELECT count(*)::int total,count(*) FILTER(WHERE r.revision=i.current_revision)::int current,
      count(*) FILTER(WHERE r.review_status='awaiting_subject_matter_review' AND r.publication_status='draft')::int pending,
      count(*) FILTER(WHERE r.review_status='automated_reviewed' AND r.publication_status='published')::int approved_or_published
      FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id WHERE i.slug LIKE 'sde-%' AND i.slug NOT LIKE 'sde-net-http-%'`);
    expect(candidates.rows[0]).toEqual({total:180,current:162,pending:0,approved_or_published:162});
    const immutableRevisions=await postgres.query<any>(`SELECT count(*)::int total,count(*) FILTER(WHERE r.revision=2 AND r.content_hash=ar.content_hash AND ar.decision='approved')::int approved_revision_2
      FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id
      LEFT JOIN canonical_question_automated_reviews ar ON ar.question_revision_id=r.id AND ar.policy_version='copilot-automated-quality-v1' AND ar.review_method='copilot_automated_review'
      WHERE i.slug LIKE 'sde-os-process-thread-isolation-%' OR i.slug LIKE 'sde-os-race-protect-invariant-%' OR i.slug LIKE 'sde-db-composite-index-order-%'`);
    expect(immutableRevisions.rows[0]).toEqual({total:36,approved_revision_2:18});
    const retiredHttpCandidates=await postgres.query<any>(`SELECT count(*)::int count FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision WHERE i.slug LIKE 'sde-net-http-%' AND r.publication_status='retired'`);
    expect(retiredHttpCandidates.rows[0].count).toBe(12);
    for(const subject of coreSubjects){
      for(const topic of subject.topics){
        for(const concept of topic.concepts){
          if(concept.currentRevisionCount>0)expect(concept.availability).not.toBe("awaiting_review");
          else expect(concept.availability).toBe("study_only");
        }
      }
    }
    const learnerId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Core SDE coverage') RETURNING id`,[`core-coverage-${randomUUID()}@test.local`])).rows[0].id;
    try {
      for(const name of coreNames){
        const concept=coreSubjects.find((subject:any)=>subject.domainName===name)!.topics.flatMap((topic:any)=>topic.concepts).find((item:any)=>item.supportedModes.includes("rapid_fire"));
        expect(concept,`${name} should expose an eligible Rapid Fire concept`).toBeTruthy();
        const assessment=await createCanonicalKnowledgeCheck(learnerId,concept.id,"rapid_fire");
        expect(assessment.questions).toHaveLength(5);
        const selected=await postgres.query<any>(`SELECT count(*)::int total,count(*) FILTER(WHERE r.review_status='automated_reviewed' AND r.publication_status='published' AND r.content_hash=ar.content_hash AND ar.decision='approved')::int eligible
          FROM recall_attempts a JOIN canonical_question_revisions r ON r.id=a.canonical_question_revision_id JOIN canonical_question_automated_reviews ar ON ar.question_revision_id=r.id AND ar.content_hash=r.content_hash
          WHERE a.id=ANY($1::uuid[])`,[assessment.questions.map((question:any)=>question.id)]);
        expect(selected.rows[0]).toEqual({total:5,eligible:5});
      }
      const unsupportedMastery=coreSubjects.find((subject:any)=>subject.domainName==="Database Management Systems")!.topics.flatMap((topic:any)=>topic.concepts).find((concept:any)=>concept.currentRevisionCount>0&&!concept.supportedModes.includes("mastery_check"));
      expect(unsupportedMastery).toBeTruthy();
      await expect(createCanonicalKnowledgeCheck(learnerId,unsupportedMastery.id,"mastery_check")).rejects.toMatchObject({status:409,code:"QUESTION_BANK_COVERAGE_INSUFFICIENT"});
      const rejectedWrites=await postgres.query<any>(`SELECT (SELECT count(*)::int FROM study_sessions WHERE user_id=$1)::int sessions,(SELECT count(*)::int FROM assessment_sessions WHERE user_id=$1)::int assessments,(SELECT count(*)::int FROM recall_attempts WHERE user_id=$1)::int attempts`,[learnerId]);
      expect(rejectedWrites.rows[0]).toEqual({sessions:5,assessments:5,attempts:25});
    } finally {
      await postgres.query(`DELETE FROM app_users WHERE id=$1`,[learnerId]);
    }
    await seedCanonicalQuestionBank();
    const after=await postgres.query<any>(`SELECT count(*)::int revisions,count(DISTINCT i.id)::int identities FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id`);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("requires an authorized exact-revision approval and lets a later review withdraw eligibility", async () => {
    const client = await postgres.connect();
    try {
      await client.query("BEGIN");
      const users = await client.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'test-only','Test reviewer'),($2,'test-only','Test grantor') RETURNING id`, [`reviewer-${randomUUID()}@test.local`,`grantor-${randomUUID()}@test.local`]);
      const reviewerId = users.rows[0].id;
      const grantorId = users.rows[1].id;
      await client.query(`INSERT INTO canonical_question_reviewers(reviewer_user_id,granted_by_user_id,grant_note) VALUES($1,$2,'Ephemeral integration fixture grant')`, [reviewerId,grantorId]);
      const question = (await client.query<any>(`SELECT i.canonical_concept_id,r.id,r.question_type,r.content_hash FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision WHERE i.slug='http-cache-explanation-cache-paths'`)).rows[0] ??
        (await client.query<any>(`SELECT i.canonical_concept_id,r.id,r.question_type,r.content_hash FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision WHERE i.slug LIKE 'http-cache-%' AND r.question_type<>'mcq' ORDER BY i.slug LIMIT 1`)).rows[0];
      expect(question).toBeTruthy();
      const previouslyEligible=await listEligibleCanonicalQuestions(client,question.canonical_concept_id);
      expect(previouslyEligible.some((candidate:any)=>candidate.revisionId===question.id)).toBe(true);
      const criteria = { technical_correctness: "pass", expected_answer: "pass", explanation: question.question_type === "mcq" ? "pass" : "not_applicable", mcq_key: question.question_type === "mcq" ? "pass" : "not_applicable", distractors: question.question_type === "mcq" ? "pass" : "not_applicable", rubric: question.question_type === "mcq" ? "not_applicable" : "pass", point_mapping: "pass", cognitive_level_difficulty: "pass", source_attribution_license: "pass" };
      await client.query(`INSERT INTO canonical_question_reviews(question_revision_id,reviewer_user_id,decision,content_hash,criteria,review_notes,reviewed_at) VALUES($1,$2,'approved',$3,$4,'Ephemeral integration approval fixture for the gate.',clock_timestamp())`, [question.id,reviewerId,question.content_hash,JSON.stringify(criteria)]);
      await client.query(`UPDATE canonical_question_revisions SET review_status='subject_matter_reviewed',publication_status='published' WHERE id=$1`, [question.id]);
      expect((await listEligibleCanonicalQuestions(client,question.canonical_concept_id)).some((candidate:any)=>candidate.revisionId===question.id)).toBe(true);
      await client.query(`INSERT INTO canonical_question_reviews(question_revision_id,reviewer_user_id,decision,content_hash,criteria,review_notes,reviewed_at) VALUES($1,$2,'changes_requested',$3,$4,'Ephemeral later review withdraws this test approval.',clock_timestamp())`, [question.id,reviewerId,question.content_hash,JSON.stringify(criteria)]);
      await client.query(`UPDATE canonical_question_revisions SET review_status='changes_requested',publication_status='draft' WHERE id=$1`, [question.id]);
      expect((await listEligibleCanonicalQuestions(client,question.canonical_concept_id)).some((candidate:any)=>candidate.revisionId===question.id)).toBe(false);
      await client.query("SAVEPOINT unauthorized_review");
      await expect(client.query(`INSERT INTO canonical_question_reviews(question_revision_id,reviewer_user_id,decision,content_hash,criteria,review_notes) VALUES($1,$2,'approved',$3,$4,'Unauthorized test reviewer should be rejected.')`, [question.id,grantorId,question.content_hash,JSON.stringify(criteria)])).rejects.toThrow("reviewer is not authorized");
      await client.query("ROLLBACK TO SAVEPOINT unauthorized_review");
      await client.query("SAVEPOINT stale_revision");
      await client.query(`INSERT INTO canonical_question_revisions(question_item_id,revision,question_type,assessment_level,difficulty,objective,title,context,prompt,expected_answer,rubric,expected_misconceptions,estimated_minutes,options,correct_option_id,explanation,distractor_rationales,hints,question_origin,source_title,source_url,source_publisher,source_license,source_accessed_on,source_notes,content_hash,review_status,quality_status,publication_status)
        SELECT r.question_item_id,1,r.question_type,r.assessment_level,r.difficulty,r.objective,r.title,r.context,r.prompt,r.expected_answer,r.rubric,r.expected_misconceptions,r.estimated_minutes,r.options,r.correct_option_id,r.explanation,r.distractor_rationales,r.hints,r.question_origin,r.source_title,r.source_url,r.source_publisher,r.source_license,r.source_accessed_on,r.source_notes,r.content_hash,'awaiting_subject_matter_review','valid','draft'
        FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision
        WHERE i.slug LIKE 'http-%' AND i.current_revision>1 AND NOT EXISTS(SELECT 1 FROM canonical_question_revisions old WHERE old.question_item_id=i.id AND old.revision=1) LIMIT 1`);
      const stale = (await client.query<any>(`SELECT r.id,r.content_hash FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id WHERE i.slug LIKE 'http-%' AND r.revision<i.current_revision ORDER BY i.slug,r.revision DESC LIMIT 1`)).rows[0];
      expect(stale).toBeTruthy();
      await expect(client.query(`INSERT INTO canonical_question_reviews(question_revision_id,reviewer_user_id,decision,content_hash,criteria,review_notes) VALUES($1,$2,'approved',$3,$4,'Stale revision review should be rejected.')`, [stale.id,reviewerId,stale.content_hash,JSON.stringify(criteria)])).rejects.toThrow("current question revision");
      await client.query("ROLLBACK TO SAVEPOINT stale_revision");
      await client.query("ROLLBACK");
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* transaction may already be rolled back */ }
      throw error;
    } finally {
      client.release();
    }
  });

  it("blocks case-insensitive duplicate goal creation without hiding existing records", async () => {
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Duplicate Goal Guard') RETURNING id`,[`goal-duplicate-${randomUUID()}@test.local`])).rows[0].id;
    try {
      const results = await Promise.allSettled([
        createGoal(userId,{title:"System Design",description:"First record"}),
        createGoal(userId,{title:" system design ",description:"Duplicate attempt"}),
      ]);
      expect(results.filter((result)=>result.status==="fulfilled")).toHaveLength(1);
      const rejected=results.find((result)=>result.status==="rejected") as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({status:409,code:"DUPLICATE_GOAL"});
      const rows=await postgres.query<any>(`SELECT title FROM goals WHERE user_id=$1 ORDER BY created_at`,[userId]);
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].title).toBe("System Design");
    } finally { await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]); }
  });

  it("deduplicates canonical seed rows, keeps topic identity, and remains stable across migration reruns",async()=>{
    const targets=await postgres.query<any>(`SELECT r.id AS role_id,c.id AS concept_id,c.name AS concept_name,t.name AS topic_name,count(kp.id)::int AS point_rows,count(DISTINCT kp.id)::int AS distinct_ids,count(DISTINCT regexp_replace(lower(trim(kp.statement)),'[[:space:]]+',' ','g'))::int AS distinct_statements FROM roles r JOIN role_skills rs ON rs.role_id=r.id JOIN canonical_skills s ON s.id=rs.skill_id JOIN topics t ON t.skill_id=s.id JOIN canonical_concepts c ON c.topic_id=t.id LEFT JOIN knowledge_points kp ON kp.concept_id=c.id WHERE r.name='Backend Engineer' AND ((t.name='HTTP' AND c.name='HTTP caching') OR (t.name='Caching' AND c.name='Cache-aside pattern')) GROUP BY r.id,c.id,c.name,t.name ORDER BY t.name`);
    expect(targets.rows).toHaveLength(2);
    expect(targets.rows.map((row:any)=>[row.topic_name,row.concept_name,row.point_rows,row.distinct_ids,row.distinct_statements])).toEqual([
      ["Caching","Cache-aside pattern",1,1,1],
      ["HTTP","HTTP caching",1,1,1],
    ]);
    const audit=await postgres.query<any>(`SELECT action,record_count,cardinality(record_ids)::int AS recorded_ids,metadata_variant_count,references_before FROM canonical_knowledge_point_deduplication_audit WHERE concept_id=$1 AND normalized_statement='can distinguish freshness from validation.'`,[targets.rows.find((row:any)=>row.concept_name==="HTTP caching").concept_id]);
    if (audit.rows[0]) {
      expect(audit.rows[0]).toMatchObject({action:"deduplicated",record_count:audit.rows[0]?.recorded_ids,metadata_variant_count:1});
      expect(Number(audit.rows[0]?.record_count)).toBeGreaterThan(1);
    }

    const totalBefore=Number((await postgres.query<any>(`SELECT count(*)::int AS count FROM knowledge_points`)).rows[0].count);
    await runPostgresMigration();
    const totalAfter=Number((await postgres.query<any>(`SELECT count(*)::int AS count FROM knowledge_points`)).rows[0].count);
    expect(totalAfter).toBe(totalBefore);

    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Roadmap Point Count') RETURNING id`,[`roadmap-points-${randomUUID()}@test.local`])).rows[0].id;
    try{
      const roadmap=await getRoleRoadmap(targets.rows[0].role_id,userId);
      const concept=roadmap.skills.flatMap((skill:any)=>skill.topics).flatMap((topic:any)=>topic.concepts).find((node:any)=>node.name==="HTTP caching");
      expect(concept.knowledgePoints).toHaveLength(1);
      expect(concept.knowledgePoints[0]).toMatchObject({statement:"Can distinguish freshness from validation."});
    }finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);}
  });

  it("remaps all canonical-point evidence before deleting safe duplicates and retains metadata conflicts for review",async()=>{
    const client=await postgres.connect();
    try{
      await client.query("BEGIN");
      const concept=(await client.query<any>(`SELECT c.id,kp.statement,kp.importance,kp.difficulty FROM canonical_concepts c JOIN topics t ON t.id=c.topic_id JOIN knowledge_points kp ON kp.concept_id=c.id WHERE t.name='Caching' AND c.name='Cache-aside pattern' LIMIT 1`)).rows[0];
      await client.query(`DROP INDEX IF EXISTS uq_knowledge_points_concept_statement_metadata`);
      const duplicateA="00000000-0000-0000-0000-000000000001";
      const duplicateB="00000000-0000-0000-0000-000000000002";
      await client.query(`INSERT INTO knowledge_points(id,concept_id,statement,importance,difficulty) VALUES($1,$3,$4,$5,$6),($2,$3,$4,$5,$6)`,[duplicateA,duplicateB,concept.id,concept.statement,concept.importance,concept.difficulty]);

      const userId=(await client.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Point Reference Test') RETURNING id`,[`point-refs-${randomUUID()}@test.local`])).rows[0].id;
      const goalId=(await client.query<any>(`INSERT INTO goals(user_id,title) VALUES($1,'Point reference fixture') RETURNING id`,[userId])).rows[0].id;
      const assessmentId=(await client.query<any>(`INSERT INTO baseline_assessments(user_id,goal_id,selected_level,baseline_source) VALUES($1,$2,'familiar','assessed') RETURNING id`,[userId,goalId])).rows[0].id;
      await client.query(`INSERT INTO baseline_questions(assessment_id,concept_id,knowledge_point_id,level,question) VALUES($1,$2,$3,'L1','Fixture baseline'),($1,$2,$4,'L2','Second fixture baseline')`,[assessmentId,concept.id,duplicateA,duplicateB]);

      const sessionId=(await client.query<any>(`INSERT INTO study_sessions(user_id,title) VALUES($1,'Point reference fixture') RETURNING id`,[userId])).rows[0].id;
      const personalConceptId=(await client.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description) VALUES($1,$2,'Point reference fixture','Fixture concept') RETURNING id`,[userId,sessionId])).rows[0].id;
      await client.query(`INSERT INTO learner_knowledge_point_states(user_id,concept_id,point,last_status,canonical_knowledge_point_id) VALUES($1,$2,$3,'correct',$4)`,[userId,personalConceptId,concept.statement,duplicateA]);
      const attemptId=(await client.query<any>(`INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question) VALUES($1,$2,$3,'explain','Fixture recall') RETURNING id`,[userId,personalConceptId,sessionId])).rows[0].id;
      const evaluationId=(await client.query<any>(`INSERT INTO recall_evaluations(recall_attempt_id,overall_coverage,feedback,suggested_recall_type,evaluator_version) VALUES($1,1,'Fixture evidence','explain','integration') RETURNING id`,[attemptId])).rows[0].id;
      await client.query(`INSERT INTO recall_knowledge_point_results(evaluation_id,point,status,canonical_knowledge_point_id) VALUES($1,$2,'correct',$3)`,[evaluationId,concept.statement,duplicateB]);

      const conflictA="00000000-0000-0000-0000-000000000010";
      const conflictB="00000000-0000-0000-0000-000000000011";
      await client.query(`INSERT INTO knowledge_points(id,concept_id,statement,importance,difficulty) VALUES($1,$3,'Metadata conflict point.',50,2),($2,$3,'Metadata conflict point.',90,4)`,[conflictA,conflictB,concept.id]);

      const migration=await readFile(new URL("../../migrations/015_deduplicate_canonical_knowledge_points.sql",import.meta.url),"utf8");
      await client.query(migration);
      const keeper=(await client.query<any>(`SELECT id FROM knowledge_points WHERE concept_id=$1 AND regexp_replace(lower(trim(statement)),'[[:space:]]+',' ','g')=regexp_replace(lower(trim($2)),'[[:space:]]+',' ','g') ORDER BY id LIMIT 1`,[concept.id,concept.statement])).rows[0].id;
      const refs=await client.query<any>(`SELECT (SELECT count(*)::int FROM baseline_questions WHERE assessment_id=$1 AND knowledge_point_id=$2) AS baseline_refs,(SELECT count(*)::int FROM learner_knowledge_point_states WHERE user_id=$3 AND canonical_knowledge_point_id=$2) AS learner_refs,(SELECT count(*)::int FROM recall_knowledge_point_results WHERE evaluation_id=$4 AND canonical_knowledge_point_id=$2) AS recall_refs`,[assessmentId,keeper,userId,evaluationId]);
      expect(refs.rows[0]).toEqual({baseline_refs:2,learner_refs:1,recall_refs:1});
      expect(Number((await client.query<any>(`SELECT count(*)::int AS count FROM knowledge_points WHERE concept_id=$1 AND regexp_replace(lower(trim(statement)),'[[:space:]]+',' ','g')=regexp_replace(lower(trim($2)),'[[:space:]]+',' ','g')`,[concept.id,concept.statement])).rows[0].count)).toBe(1);
      expect(Number((await client.query<any>(`SELECT count(*)::int AS count FROM knowledge_points WHERE id IN ($1,$2)`,[conflictA,conflictB])).rows[0].count)).toBe(2);
      expect((await client.query<any>(`SELECT action FROM canonical_knowledge_point_deduplication_audit WHERE concept_id=$1 AND normalized_statement='metadata conflict point.'`,[concept.id])).rows[0]?.action).toBe("manual_review");
    }finally{
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("persists topic, external source link, and material separately",async()=>{
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Source Identity') RETURNING id`,[`source-${randomUUID()}@test.local`])).rows[0].id;
    try{
      const session=await createSession(userId,{title:"Cache invalidation",sourceUrl:"https://docs.example.test/cache",rawMaterial:"A cache entry is stale when its backing value changes.",sourceType:"url"});
      const fetched=await getSession(session.id,userId);
      expect(serializeSession(fetched)).toMatchObject({title:"Cache invalidation",sourceUrl:"https://docs.example.test/cache",rawMaterial:"A cache entry is stale when its backing value changes."});
    }finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);}
  });

  it("keeps canonical study handoffs, custom topics, and roadmap evidence linked by IDs",async()=>{
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Roadmap Test') RETURNING id`,[`roadmap-${randomUUID()}@test.local`])).rows[0].id;
    try{
      const node=(await postgres.query<any>(`SELECT r.id AS role_id,t.id AS topic_id,c.id AS concept_id,c.name AS concept_name FROM roles r JOIN role_skills rs ON rs.role_id=r.id JOIN canonical_skills s ON s.id=rs.skill_id JOIN topics t ON t.skill_id=s.id JOIN canonical_concepts c ON c.topic_id=t.id JOIN knowledge_points kp ON kp.concept_id=c.id WHERE c.status='active' ORDER BY c.name LIMIT 1`)).rows[0];
      expect(node).toBeDefined();
      const session=await createSession(userId,{title:node.concept_name,rawMaterial:"Database transactions group operations into an atomic unit.",sourceType:"notes",canonicalTopicId:node.topic_id,canonicalConceptId:node.concept_id});
      expect(serializeSession(await getSession(session.id,userId))).toMatchObject({canonicalTopicId:node.topic_id,canonicalConceptId:node.concept_id});
      const repeated=await createSession(userId,{title:node.concept_name,rawMaterial:"A repeated study session with the same canonical target.",canonicalTopicId:node.topic_id,canonicalConceptId:node.concept_id});
      expect(repeated.canonicalConceptId).toBe(session.canonicalConceptId);
      const custom=await createSession(userId,{title:"My private queue notes",rawMaterial:"A custom topic without a curated match."});
      expect(custom.canonicalTopicId).toBeNull();
      expect(custom.canonicalConceptId).toBeNull();
      expect((await postgres.query<any>(`SELECT ss.canonical_concept_id,c.name,lower(regexp_replace(trim(c.name),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim($2),'[[:space:]]+',' ','g')) AS exact_match FROM study_sessions ss JOIN canonical_concepts c ON c.id=ss.canonical_concept_id WHERE ss.id=$1`,[session.id,node.concept_name])).rows[0]).toMatchObject({canonical_concept_id:node.concept_id,exact_match:true});
      const mappedPersonal=(await createConcepts(userId,session.id,[{name:node.concept_name,description:"Exact learner concept match",requiredKnowledgePoints:[],difficulty:3}]))[0];
      expect(mappedPersonal.canonicalConceptId).toBe(node.concept_id);
      const approximatePersonal=(await createConcepts(userId,session.id,[{name:`${node.concept_name} advanced`,description:"Only similar wording",requiredKnowledgePoints:[],difficulty:3}]))[0];
      expect(approximatePersonal.canonicalConceptId).toBeNull();
      const customPersonal=(await createConcepts(userId,custom.id,[{name:node.concept_name,description:"Matching label without selected identity",requiredKnowledgePoints:[],difficulty:3}]))[0];
      expect(customPersonal.canonicalConceptId).toBeNull();

      const initial=await getRoleRoadmap(node.role_id,userId);
      const findConcept=()=>initial.skills.flatMap((skill:any)=>skill.topics.flatMap((topic:any)=>topic.concepts)).find((concept:any)=>concept.id===node.concept_id);
      expect(findConcept().status).toBe("not_started");
      await postgres.query(`UPDATE study_sessions SET status='completed',completed_at=now() WHERE id=$1`,[session.id]);
      expect((await getRoleRoadmap(node.role_id,userId)).skills.flatMap((skill:any)=>skill.topics.flatMap((topic:any)=>topic.concepts)).find((concept:any)=>concept.id===node.concept_id).status).toBe("studied");

      const point=(await postgres.query<any>(`SELECT kp.id,kp.statement FROM knowledge_points kp WHERE kp.concept_id=$1 AND (SELECT count(*) FROM knowledge_points duplicate WHERE duplicate.concept_id=kp.concept_id AND lower(regexp_replace(trim(duplicate.statement),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(kp.statement),'[[:space:]]+',' ','g')))=1 ORDER BY kp.id LIMIT 1`,[node.concept_id])).rows[0];
      if(point){
        const personal=(await postgres.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points) VALUES($1,$2,'Canonical mapping test','Exact label mapping',$3) RETURNING id`,[userId,session.id,[point.statement]])).rows[0];
        const attempt=(await postgres.query<any>(`INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question) VALUES($1,$2,$3,'test','Exact point mapping') RETURNING id`,[userId,personal.id,session.id])).rows[0];
        expect(await withTransaction((client)=>resolveCanonicalKnowledgePoint(client,attempt.id,point.statement))).toBe(point.id);
        expect(await withTransaction((client)=>resolveCanonicalKnowledgePoint(client,attempt.id,`${point.statement} extra`))).toBeNull();
      }

      const goal=(await postgres.query<any>(`INSERT INTO goals(user_id,title) VALUES($1,'Canonical roadmap evidence') RETURNING id`,[userId])).rows[0];
      const baseline=(await postgres.query<any>(`INSERT INTO baseline_assessments(user_id,goal_id,selected_level,baseline_source,status) VALUES($1,$2,'familiar','assessed','completed') RETURNING id`,[userId,goal.id])).rows[0];
      const baselinePoint=(await postgres.query<any>(`SELECT id FROM knowledge_points WHERE concept_id=$1 ORDER BY id LIMIT 1`,[node.concept_id])).rows[0];
      const baselineQuestion=(await postgres.query<any>(`INSERT INTO baseline_questions(assessment_id,concept_id,knowledge_point_id,level,question) VALUES($1,$2,$3,'L1','Roadmap evidence check') RETURNING id`,[baseline.id,node.concept_id,baselinePoint.id])).rows[0];
      await submitBaselineQuestion(baseline.id,userId,{questionId:baselineQuestion.id,answer:"I can describe the required concept from memory.",confidence:6});
      expect((await getRoleRoadmap(node.role_id,userId)).skills.flatMap((skill:any)=>skill.topics.flatMap((topic:any)=>topic.concepts)).find((concept:any)=>concept.id===node.concept_id).status).toBe("assessed");

      const mismatched=(await postgres.query<any>(`SELECT id FROM topics WHERE id<>$1 ORDER BY id LIMIT 1`,[node.topic_id])).rows[0];
      await expect(createStudySession({userId,title:node.concept_name,rawMaterial:"Valid study notes.",canonicalTopicId:mismatched.id,canonicalConceptId:node.concept_id})).rejects.toMatchObject({code:"CANONICAL_NODE_NOT_FOUND"});
      await expect(createStudySession({userId,title:"Unrelated free-text title",rawMaterial:"Valid study notes.",canonicalTopicId:node.topic_id,canonicalConceptId:node.concept_id})).rejects.toMatchObject({code:"CANONICAL_NODE_NOT_FOUND"});
      const counts=await postgres.query<any>(`SELECT count(*)::int AS count FROM canonical_concepts WHERE id=$1`,[node.concept_id]);
      expect(counts.rows[0].count).toBe(1);
    }finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);}
  });

  it("keeps extracted concepts stable and baseline submissions single-write under concurrency",async()=>{
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Integrity Test') RETURNING id`,[`integrity-${randomUUID()}@test.local`])).rows[0].id;
    try{
      const suppliedText="https://video.example/watch?v=topic\nCache reads use a key to find stored values. Cache reads use a key to find stored values.";
      const session=(await postgres.query<any>(`INSERT INTO study_sessions(user_id,title,raw_material) VALUES($1,'Cache notes',$2) RETURNING id`,[userId,suppliedText])).rows[0];
      const first=await createConceptsForSession({userId,studySessionId:session.id,title:"Cache notes",rawMaterial:suppliedText});
      const second=await createConceptsForSession({userId,studySessionId:session.id,title:"Cache notes",rawMaterial:suppliedText});
      expect(first).toHaveLength(1);
      expect(first[0].name).not.toContain("video.example");
      expect(first[0].requiredKnowledgePoints).toHaveLength(1);
      expect(first[0].requiredKnowledgePoints.join(" ")).not.toContain("video.example");
      expect(second[0].id).toBe(first[0].id);
      expect((await postgres.query<any>(`SELECT count(*)::int AS count FROM personal_concepts WHERE user_id=$1 AND study_session_id=$2`,[userId,session.id])).rows[0].count).toBe(1);

      const skill=(await postgres.query<any>(`SELECT s.id FROM canonical_skills s JOIN topics t ON t.skill_id=s.id JOIN canonical_concepts c ON c.topic_id=t.id JOIN knowledge_points kp ON kp.concept_id=c.id GROUP BY s.id ORDER BY count(DISTINCT c.id) DESC,s.id LIMIT 1`)).rows[0];
      const goal=(await postgres.query<any>(`INSERT INTO goals(user_id,title) VALUES($1,'Baseline integrity') RETURNING id`,[userId])).rows[0];
      const baseline=await createBaseline({userId,goalId:goal.id,skillId:skill.id,level:"familiar"});
      expect(baseline.questions.length).toBeGreaterThan(0);
      expect(new Set(baseline.questions.map((question:any)=>question.conceptId)).size).toBe(baseline.questions.length);
      expect(baseline.questions.every((question:any)=>Boolean(question.knowledgePointId))).toBe(true);
      expect(baseline.assessment.observedMastery).toBeNull();
      expect((await getBaseline(baseline.assessment.id,userId)).assessment.observedStatus).toBe("Not assessed");
      expect(baseline.questions.length).toBeGreaterThanOrEqual(3);
      let result=baseline;
      const firstQuestion=baseline.questions[0];
      result=await submitBaselineQuestion(baseline.assessment.id,userId,{questionId:firstQuestion.id,answer:"No relevant answer provided.",confidence:4});
      await expect(submitBaselineQuestion(baseline.assessment.id,userId,{questionId:firstQuestion.id,answer:"A replacement answer must not overwrite submitted evidence.",confidence:10}))
        .rejects.toMatchObject({code:"BASELINE_QUESTION_ALREADY_SUBMITTED",status:409});
      expect((await getBaseline(baseline.assessment.id,userId)).questions.find((question:any)=>question.id===firstQuestion.id)?.answer).toBe("No relevant answer provided.");
      for(const question of baseline.questions.slice(1,-2)){
        result=await submitBaselineQuestion(baseline.assessment.id,userId,{questionId:question.id,answer:"No relevant answer provided.",confidence:4});
      }
      const finalQuestions=baseline.questions.slice(-2);
      await Promise.all(finalQuestions.map((question:any)=>submitBaselineQuestion(baseline.assessment.id,userId,{questionId:question.id,answer:"No relevant answer provided.",confidence:4})));
      result=await getBaseline(baseline.assessment.id,userId);
      expect({status:result.assessment.status,submitted:result.questions.filter((question:any)=>question.submittedAt).length,total:result.questions.length})
        .toEqual({status:"completed",submitted:result.questions.length,total:result.questions.length});
      expect(Number(result.assessment.observedMastery)).toBe(0);
      const baselineReport=(await getBaseline(baseline.assessment.id,userId)).assessment;
      const assessedPoints=result.questions.flatMap((question:any)=>question.knowledgePointResults??[]);
      expect(baselineReport.observedEvidenceCount).toBe(assessedPoints.length);
      expect(baselineReport.observedStatus).toBe("Needs work");
      expect(assessedPoints.length).toBeGreaterThan(0);
      expect(result.questions.every((question:any)=>(question.knowledgePointResults??[]).length===1)).toBe(true);
      const uniquePoints=new Set(result.questions.flatMap((question:any)=>(question.knowledgePointResults??[]).map((point:any)=>`${question.conceptId}:${point.point.trim().toLowerCase().replace(/\s+/g," ")}`)));
      expect(assessedPoints.length).toBe(uniquePoints.size);
    }finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);}
  });

  it("rolls back the final baseline answer when learner-state persistence fails",async()=>{
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Baseline Rollback Test') RETURNING id`,[`baseline-rollback-${randomUUID()}@test.local`])).rows[0].id;
    const triggerName=`fail_baseline_state_${randomUUID().replaceAll("-","")}`;
    let triggerCreated=false;
    let functionCreated=false;
    try{
      const skill=(await postgres.query<any>(`SELECT s.id FROM canonical_skills s JOIN topics t ON t.skill_id=s.id JOIN canonical_concepts c ON c.topic_id=t.id JOIN knowledge_points kp ON kp.concept_id=c.id GROUP BY s.id ORDER BY count(DISTINCT c.id) DESC,s.id LIMIT 1`)).rows[0];
      const goal=(await postgres.query<any>(`INSERT INTO goals(user_id,title) VALUES($1,'Baseline rollback fixture') RETURNING id`,[userId])).rows[0];
      const baseline=await createBaseline({userId,goalId:goal.id,skillId:skill.id,level:"familiar"});
      expect(baseline.questions.length).toBeGreaterThanOrEqual(3);
      for(const question of baseline.questions.slice(0,-1)){
        await submitBaselineQuestion(baseline.assessment.id,userId,{questionId:question.id,answer:"No relevant answer provided.",confidence:4});
      }
      const pending=baseline.questions.at(-1)!;
      await postgres.query(`CREATE FUNCTION ${triggerName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id='${userId}'::uuid THEN RAISE EXCEPTION 'forced baseline learner-state persistence failure'; END IF; RETURN NEW; END $$`);
      functionCreated=true;
      await postgres.query(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON learner_knowledge_states FOR EACH ROW EXECUTE FUNCTION ${triggerName}()`);
      triggerCreated=true;

      await expect(submitBaselineQuestion(baseline.assessment.id,userId,{questionId:pending.id,answer:"This answer should roll back with the failed transaction.",confidence:6}))
        .rejects.toThrow("forced baseline learner-state persistence failure");
      const persisted=await getBaseline(baseline.assessment.id,userId);
      expect(persisted.assessment.status).toBe("pending");
      expect(persisted.questions.find((question:any)=>question.id===pending.id)).toMatchObject({answer:null,submittedAt:null});
      expect(persisted.questions.filter((question:any)=>question.submittedAt)).toHaveLength(baseline.questions.length-1);
      expect(Number((await postgres.query<any>(`SELECT count(*)::int AS count FROM learner_knowledge_states WHERE user_id=$1`,[userId])).rows[0].count)).toBe(0);
    }finally{
      if(triggerCreated){
        await postgres.query(`DROP TRIGGER IF EXISTS ${triggerName} ON learner_knowledge_states`);
      }
      if(functionCreated)await postgres.query(`DROP FUNCTION IF EXISTS ${triggerName}()`);
      await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);
    }
  });

  it("persists structured answers and keeps each knowledge point state independent, including retries",async()=>{
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Structured Test') RETURNING id`,[`structured-${randomUUID()}@test.local`])).rows[0].id;
    try{
      const session=(await postgres.query<any>(`INSERT INTO study_sessions(user_id,title) VALUES($1,'Structured evaluation') RETURNING id`,[userId])).rows[0];
      const points=["Atomicity guarantees all operations commit together or none do.","Isolation prevents concurrent transactions from observing inconsistent intermediate state."];
      const concept=(await postgres.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points) VALUES($1,$2,'Database transactions','Transaction guarantees.',$3) RETURNING id`,[userId,session.id,points])).rows[0];
      const assessment=await createAssessment(userId,concept.id,"mastery_check");
      const structured=assessment.questions.find((item:any)=>item.questionType==="short_explanation");
      expect(structured,"mastery_check should include its short_explanation question").toBeDefined();
      expect(structured.question?.parts,"service result should expose parts on its nested question").toHaveLength(2);
      const [atomicity,isolation]=structured.question.parts;
      expect(structured.question.parts.map((part:any)=>part.knowledgePoints)).toEqual(points.map((point)=>[point]));
      const storedQuestion=await postgres.query<any>(`SELECT question_parts FROM questions WHERE id=$1`,[structured.question.id]);
      expect(storedQuestion.rows[0]?.question_parts,"question_parts should survive PostgreSQL persistence").toEqual(structured.question.parts);
      const apiAttempt=serializeAttempt(structured);
      expect(apiAttempt.questionData?.parts,"HTTP serialization should expose parts as questionData.parts").toEqual(structured.question.parts);
      const submitted=await submitRecall(structured.id,{userId,confidence:8,answers:[{partId:atomicity.id,answer:points[0]},{partId:isolation.id,answer:"Transactions use a database."}]});
      const evaluatedByPart=Object.fromEntries(submitted.attempt.evaluation.knowledgePointResults.map((point:any)=>[point.partId,point]));
      expect(evaluatedByPart[atomicity.id]).toMatchObject({point:points[0],status:"correct"});
      expect(evaluatedByPart[isolation.id]).toMatchObject({point:points[1],status:"missing"});
      expect(submitted.attempt.structuredAnswers).toEqual([{partId:atomicity.id,answer:points[0]},{partId:isolation.id,answer:"Transactions use a database."}]);
      const states=(await postgres.query<any>(`SELECT point,mastery::float AS mastery,attempt_count FROM learner_knowledge_point_states WHERE user_id=$1 AND concept_id=$2 ORDER BY point`,[userId,concept.id])).rows;
      expect(states).toHaveLength(2);
      expect(states.find((state:any)=>state.point===points[0]).mastery).toBe(1);
      expect(states.find((state:any)=>state.point===points[1]).mastery).toBe(0);
      const learnerState=await getConceptState(userId,concept.id);
      expect(learnerState?.knowledgePointStates.find((state:any)=>state.point===points[0])).toMatchObject({mastery:1,attemptCount:1,lastStatus:"correct"});
      expect(learnerState?.knowledgePointStates.find((state:any)=>state.point===points[1])).toMatchObject({mastery:0,attemptCount:1,lastStatus:"missing"});
      const storedResults=await postgres.query<any>(`SELECT k.part_id,k.point,k.status FROM recall_knowledge_point_results k JOIN recall_evaluations e ON e.id=k.evaluation_id WHERE e.recall_attempt_id=$1 ORDER BY k.point`,[structured.id]);
      expect(storedResults.rows.map((row:any)=>[row.part_id,row.point,row.status])).toEqual([[atomicity.id,points[0],"correct"],[isolation.id,points[1],"missing"]]);
      await expect(submitRecall(structured.id,{userId,confidence:8,answers:[{partId:atomicity.id,answer:points[0]},{partId:isolation.id,answer:points[1]}]})).rejects.toThrow("already been submitted");
      const counts=await postgres.query<any>(`SELECT (SELECT count(*)::int FROM recall_evaluations WHERE recall_attempt_id=$1) AS evaluations,(SELECT count(*)::int FROM learner_knowledge_point_states WHERE user_id=$2 AND concept_id=$3) AS states`,[structured.id,userId,concept.id]);
      expect(counts.rows[0]).toMatchObject({evaluations:1,states:2});
    }finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);}
  });

  it("builds readiness from latest submitted point evidence with distinct incorrect, partial, unanswered, and unassessed states",async()=>{
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Readiness evidence test') RETURNING id`,[`readiness-${randomUUID()}@test.local`])).rows[0].id;
    try{
      const selected=(await postgres.query<any>(`WITH ranked_skills AS (
          SELECT cs.id,cs.name,count(kp.id)::int AS total_points
          FROM canonical_skills cs JOIN topics t ON t.skill_id=cs.id JOIN canonical_concepts cc ON cc.topic_id=t.id AND cc.status='active'
          JOIN knowledge_points kp ON kp.concept_id=cc.id GROUP BY cs.id,cs.name
        ), representatives AS (
          SELECT DISTINCT ON (rs.id) rs.id AS skill_id,rs.name AS skill_name,rs.total_points,cc.id AS canonical_concept_id,kp.id AS point_id,kp.statement
          FROM ranked_skills rs JOIN topics t ON t.skill_id=rs.id JOIN canonical_concepts cc ON cc.topic_id=t.id AND cc.status='active'
          JOIN knowledge_points kp ON kp.concept_id=cc.id ORDER BY rs.id,cc.id,kp.id
        ) SELECT * FROM representatives ORDER BY skill_name LIMIT 5`)).rows;
      expect(selected.length).toBeGreaterThanOrEqual(5);
      const goal=(await postgres.query<any>(`INSERT INTO goals(user_id,title) VALUES($1,'Readiness evidence integration') RETURNING id`,[userId])).rows[0];
      for(const [index,item] of selected.entries())await postgres.query(`INSERT INTO learner_skills(user_id,goal_id,name,priority) VALUES($1,$2,$3,$4)`,[userId,goal.id,item.skill_name,90-index]);
      await postgres.query(`INSERT INTO learner_skills(user_id,goal_id,name,priority) VALUES($1,$2,'Unmapped custom focus',50)`,[userId,goal.id]);
      const sessions=new Map<string,{sessionId:string;conceptId:string}>();
      for(const item of selected){
        if(sessions.has(item.canonical_concept_id))continue;
        const session=(await postgres.query<any>(`INSERT INTO study_sessions(user_id,title,canonical_concept_id) VALUES($1,$2,$3) RETURNING id`,[userId,item.skill_name,item.canonical_concept_id])).rows[0];
        const concept=(await postgres.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points,canonical_concept_id) VALUES($1,$2,$3,'Canonical readiness fixture',$4,$5) RETURNING id`,[userId,session.id,item.skill_name,[item.statement],item.canonical_concept_id])).rows[0];
        sessions.set(item.canonical_concept_id,{sessionId:session.id,conceptId:concept.id});
      }
      const baseTime=Date.parse('2026-01-01T00:00:00.000Z');
      async function evidence(item:any,fixture:{id?:string;status:'correct'|'partial'|'missing';submittedAt:number|null;createdAt:number;answer?:string;selectedOptionId?:string;structuredAnswers?:unknown;partId?:string}){
        const owner=sessions.get(item.canonical_concept_id)!;
        const attempt=(await postgres.query<any>(`INSERT INTO recall_attempts(id,user_id,concept_id,study_session_id,question_type,question,answer,selected_option_id,structured_answers,submitted_at,created_at)
          VALUES(COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5,'Readiness point fixture',$6,$7,$8,$9,$10) RETURNING id`,[fixture.id??null,userId,owner.conceptId,owner.sessionId,fixture.structuredAnswers?'short_explanation':fixture.selectedOptionId?'mcq':'descriptive',fixture.answer??'',fixture.selectedOptionId??null,fixture.structuredAnswers?JSON.stringify(fixture.structuredAnswers):null,fixture.submittedAt===null?null:new Date(fixture.submittedAt),new Date(fixture.createdAt)])).rows[0];
        if(fixture.submittedAt!==null){
          const evaluation=(await postgres.query<any>(`INSERT INTO recall_evaluations(recall_attempt_id,overall_coverage,feedback,suggested_recall_type,evaluator_version) VALUES($1,$2,'fixture evaluation','explain','integration-fixture') RETURNING id`,[attempt.id,fixture.status==='correct'?1:fixture.status==='partial'?.5:0])).rows[0];
          await postgres.query(`INSERT INTO recall_knowledge_point_results(evaluation_id,point,status,evidence,feedback,part_id,canonical_knowledge_point_id) VALUES($1,$2,$3,$4,'fixture result',$5,$6)`,[evaluation.id,item.statement,fixture.status,fixture.answer??'',fixture.partId??null,item.point_id]);
        }
        return attempt.id as string;
      }
      await evidence(selected[0],{status:'correct',submittedAt:baseTime,createdAt:baseTime,answer:'Correct earlier answer.'});
      await evidence(selected[0],{id:'00000000-0000-4000-8000-000000000001',status:'correct',submittedAt:baseTime+86400000,createdAt:baseTime+86400000,answer:'Tied correct answer.'});
      await evidence(selected[0],{id:'00000000-0000-4000-8000-000000000002',status:'missing',submittedAt:baseTime+86400000,createdAt:baseTime+86400000,answer:'Tie-break winner contains a misconception.'});
      await evidence(selected[1],{status:'partial',submittedAt:baseTime+172800000,createdAt:baseTime+172800000,answer:'Some but not all of the explanation.'});
      await evidence(selected[2],{status:'missing',submittedAt:baseTime+259200000,createdAt:baseTime+259200000,answer:'',partId:'validation',structuredAnswers:[{partId:'validation',answer:''}]});
      await evidence(selected[3],{status:'correct',submittedAt:baseTime+345600000,createdAt:baseTime+345600000,answer:'Adequate persisted answer.'});
      const tiedTime=baseTime+86400000;
      await evidence(selected[4],{status:'correct',submittedAt:null,createdAt:baseTime+604800000});
      await postgres.query(`INSERT INTO learner_knowledge_point_states(user_id,concept_id,point,mastery,attempt_count,last_status,canonical_knowledge_point_id,updated_at)
        VALUES($1,$2,$3,1,9,'correct',$4,'2099-01-01T00:00:00Z')`,[userId,sessions.get(selected[0].canonical_concept_id)!.conceptId,selected[0].statement,selected[0].point_id]);

      const readiness=await getGoalReadiness(userId,goal.id);
      const outcomes=[
        {assessedPoints:1,strengths:0,partial:0,incorrect:1,unanswered:0},
        {assessedPoints:1,strengths:0,partial:1,incorrect:0,unanswered:0},
        {assessedPoints:1,strengths:0,partial:0,incorrect:0,unanswered:1},
        {assessedPoints:1,strengths:1,partial:0,incorrect:0,unanswered:0},
        {assessedPoints:0,strengths:0,partial:0,incorrect:0,unanswered:0},
      ];
      const latestEvidenceOffsets=[86400000,172800000,259200000,345600000,null];
      for(const [index,item] of selected.entries()){
        const mapped=readiness.skills.find((skill:any)=>skill.name===item.skill_name);
        expect(mapped).toMatchObject({totalPoints:item.total_points,...outcomes[index],unassessedPoints:item.total_points-outcomes[index].assessedPoints,latestEvidenceAt:latestEvidenceOffsets[index]===null?null:new Date(baseTime+latestEvidenceOffsets[index]!)});
      }
      expect(readiness.skills.find((skill:any)=>skill.name==='Unmapped custom focus')).toMatchObject({status:'unmapped',totalPoints:0,assessedPoints:0,latestEvidenceAt:null});
      const otherUser=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Readiness foreign owner') RETURNING id`,[`readiness-foreign-${randomUUID()}@test.local`])).rows[0].id;
      try{await expect(getGoalReadiness(otherUser,goal.id)).rejects.toMatchObject({status:403});}
      finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[otherUser]);}
    }finally{
      await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);
    }
  });

  it("keeps provider-failed study extraction and recall evaluation recoverable without partial evidence",async()=>{
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Provider Failure Test') RETURNING id`,[`provider-failure-${randomUUID()}@test.local`])).rows[0].id;
    const previous={provider:env.llmProvider,key:env.llmApiKey,model:env.llmModel,baseUrl:env.llmBaseUrl};
    const priorSessions=Number((await postgres.query<any>(`SELECT count(*)::int AS count FROM study_sessions WHERE user_id=$1`,[userId])).rows[0].count);
    try{
      env.llmProvider="openai-compatible";env.llmApiKey="integration-only-key";env.llmModel="test-model";env.llmBaseUrl="https://provider.invalid/v1";
      vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({error:{code:"rate_limit_exceeded"}}),{status:429,headers:{"Retry-After":"60"}})));
      resetEvaluatorForTests();
      await expect(createStudySession({userId,title:"Cache invalidation",rawMaterial:"A cache entry becomes stale after its source value changes."})).rejects.toMatchObject({code:"LLM_RATE_LIMITED",retryAfterSeconds:60});
      expect(Number((await postgres.query<any>(`SELECT count(*)::int AS count FROM study_sessions WHERE user_id=$1`,[userId])).rows[0].count)).toBe(priorSessions);

      const session=await createSession(userId,{title:"Provider retry",rawMaterial:"A cache entry becomes stale after its source value changes."});
      const concept=(await postgres.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points) VALUES($1,$2,'Cache invalidation','How cached values remain correct.',$3) RETURNING id`,[userId,session.id,["Cache invalidation removes or refreshes stale entries."]])).rows[0];
      const assessment=await createAssessment(userId,concept.id,"deep_recall");
      const attempt=assessment.questions.find((item:any)=>item.questionType!=="mcq"&&!item.question?.parts?.length);
      expect(attempt).toBeDefined();
      await expect(submitRecall(attempt.id,{userId,answer:"Cache invalidation removes or refreshes stale entries.",confidence:8})).rejects.toMatchObject({code:"LLM_RATE_LIMITED"});
      expect((await getAttempt(attempt.id,userId))?.submittedAt).toBeNull();
      expect((await postgres.query<any>(`SELECT (SELECT count(*)::int FROM recall_evaluations WHERE recall_attempt_id=$1) AS evaluations,(SELECT count(*)::int FROM learner_knowledge_point_states WHERE user_id=$2 AND concept_id=$3) AS states`,[attempt.id,userId,concept.id])).rows[0]).toMatchObject({evaluations:0,states:0});

      vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:"not json"}}]}),{status:200,headers:{"Content-Type":"application/json"}})));
      resetEvaluatorForTests();
      await expect(submitRecall(attempt.id,{userId,answer:"Cache invalidation removes or refreshes stale entries.",confidence:8})).rejects.toMatchObject({code:"INVALID_AI_JSON"});
      expect((await getAttempt(attempt.id,userId))?.submittedAt).toBeNull();
      expect((await postgres.query<any>(`SELECT (SELECT count(*)::int FROM recall_evaluations WHERE recall_attempt_id=$1) AS evaluations,(SELECT count(*)::int FROM learner_knowledge_point_states WHERE user_id=$2 AND concept_id=$3) AS states`,[attempt.id,userId,concept.id])).rows[0]).toMatchObject({evaluations:0,states:0});
    }finally{
      vi.unstubAllGlobals();
      env.llmProvider=previous.provider;env.llmApiKey=previous.key;env.llmModel=previous.model;env.llmBaseUrl=previous.baseUrl;
      resetEvaluatorForTests();
      await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);
    }
  });

  it("persists adaptive assessment, preferences, resources, packs, plans, and missed-task history",async()=>{
    const email=`assessment-${randomUUID()}@test.local`;
    const userResult=await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Assessment Test') RETURNING id`,[email]);
    const userId=userResult.rows[0].id;
    try{
      const session=await postgres.query<any>(`INSERT INTO study_sessions(user_id,title) VALUES($1,'Assessment integration') RETURNING id`,[userId]);
      const tokenConcept=await postgres.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points,difficulty) VALUES($1,$2,'Token bucket rate limiting','Limit bursts and sustained traffic.',$3,3) RETURNING id`,[userId,session.rows[0].id,["Can compare burst capacity and sustained rate.","Refill rate controls sustained request rate."]]);
      const tokenId=tokenConcept.rows[0].id;
      const unassessed=await getConceptState(userId,tokenId);
      expect(unassessed?.mastery).toBeNull();
      expect(unassessed?.confidence).toBeNull();
      expect(unassessed?.successRate).toBeNull();
      expect(unassessed?.hintsUsed).toBeNull();
      const learnerSummary=await (await import("../../src/services/learner/learnerModelService.js")).getLearnerSummary(userId);
      expect(learnerSummary.assessedConcepts).toBe(0);
      expect(learnerSummary.averageMastery).toBeNull();
      const rapid=await createAssessment(userId,tokenId,"rapid_fire");
      expect(rapid.questions).toHaveLength(5);
      expect(new Set(rapid.questions.map((item:any)=>item.question.id)).size).toBe(5);
      const persisted=await postgres.query(`SELECT count(DISTINCT q.id)::int AS count FROM questions q JOIN recall_attempts r ON r.question_id=q.id WHERE r.assessment_session_id=$1`,[rapid.assessment.id]);
      expect(persisted.rows[0].count).toBe(5);
      const rapidAgain=await createAssessment(userId,tokenId,"rapid_fire");
      expect(rapidAgain.questions.map((item:any)=>item.question.id).filter((id:string)=>rapid.questions.some((old:any)=>old.question.id===id))).toHaveLength(0);
      const first=rapid.questions[0];
      const hint=await revealNextHint(userId,first.id);
      expect(hint?.maxHintLevel).toBe(1);
      const afterHint=await getAttempt(first.id,userId);
      expect(afterHint.hintsUsed).toBe(1);
      expect(afterHint.question.revealedHints).toHaveLength(1);
      const submitted=await submitRecall(first.id,{selectedOptionId:afterHint.question.correctOptionId,confidence:8,userId});
      expect(submitted.attempt.evaluation.evaluatorVersion).toBe("deterministic-mcq-1.0");
      expect(submitted.attempt.evaluation.overallCoverage).toBe(1);
      expect(submitted.attempt.recommendation).toBeTruthy();
      const assessed=await getConceptState(userId,tokenId);
      expect(assessed?.attemptCount).toBe(1);
      expect(assessed?.confidence).toBe(.8);
      expect(assessed?.successRate).toBe(1);
      expect(assessed?.hintsUsed).toBe(1);
      const oneDimension=await createAssessment(userId,tokenId,"deep_recall");
      await submitRecall(oneDimension.questions[0].id,{answer:"Token bucket capacity stores tokens for bursts; refill rate governs sustained requests.",confidence:7,userId});
      const dimensionReport=(await getAssessment(userId,oneDimension.assessment.id)).result;
      expect(dimensionReport?.dimensionScores.depth).not.toBeNull();
      expect(Object.entries(dimensionReport?.dimensionScores??{}).filter(([name])=>name!=="depth").every(([,score])=>score===null)).toBe(true);
      const storedRec=await postgres.query(`SELECT action_type FROM assessment_recommendations WHERE recall_attempt_id=$1`,[first.id]);
      expect(storedRec.rowCount).toBe(1);
      const deep=await createAssessment(userId,tokenId,"deep_recall");
      const mastery=await createAssessment(userId,tokenId,"mastery_check");
      expect(deep.questions).toHaveLength(1);
      expect(mastery.questions).toHaveLength(6);
      expect((await getAssessment(userId,mastery.assessment.id)).result).toBeNull();
      expect((await getSettings(userId)).reviewMode).toBe("automatic");
      await updateSettings(userId,{reviewMode:"confirm"});
      expect((await getSettings(userId)).reviewMode).toBe("confirm");

      const httpConcept=await postgres.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points) VALUES($1,$2,'HTTP request lifecycle','HTTP request behavior.',$3) RETURNING id`,[userId,session.rows[0].id,["Can explain method and status semantics."]]);
      const httpAssessment=await createAssessment(userId,httpConcept.rows[0].id,"rapid_fire");
      const httpRecall=httpAssessment.questions.find((item:any)=>item.questionType==="rapid_recall");
      expect(httpRecall).toBeDefined();
      await submitRecall(httpRecall.id,{answer:"I do not know this yet.",confidence:4,userId});
      const resources=await recommendResources({userId,conceptId:httpConcept.rows[0].id,availableMinutes:30});
      expect(resources.length).toBeGreaterThan(0);
      expect(resources.length).toBeLessThanOrEqual(4);
      expect(resources.every((resource)=>resource.estimatedMinutes<=30)).toBe(true);
      expect(resources.every((resource)=>!/% coverage|trust tier|metadata marks it/i.test(resource.reason))).toBe(true);
      expect(resources.every((resource)=>/^https?:\/\//i.test(resource.url))).toBe(true);
      const pack=await buildLearningPack({userId,conceptId:httpConcept.rows[0].id,availableMinutes:60});
      expect(pack.estimatedTotalMinutes).toBeLessThanOrEqual(60);
      expect(pack.items.some((item)=>item.kind==="resource")).toBe(true);

      const goal=await postgres.query<any>(`INSERT INTO goals(user_id,title,weekly_time_budget_minutes) VALUES($1,'HTTP mastery',420) RETURNING id`,[userId]);
      await postgres.query(`INSERT INTO learner_skills(user_id,goal_id,name,priority) VALUES($1,$2,'HTTP request lifecycle',90)`,[userId,goal.rows[0].id]);
      const archivedGoal=await postgres.query<any>(`INSERT INTO goals(user_id,title,status) VALUES($1,'Unassessed goal','archived') RETURNING id`,[userId]);
      await postgres.query(`INSERT INTO learner_skills(user_id,goal_id,name,priority) VALUES($1,$2,'Unassessed skill',90)`,[userId,archivedGoal.rows[0].id]);
      const unassessedSkill=(await getWeakSkills(userId)).find((item:any)=>item.name==="Unassessed skill");
      expect(unassessedSkill?.currentMastery).toBeNull();
      expect(unassessedSkill?.status).toBe("new");
      const plan=await generateGoalPlan(userId,goal.rows[0].id,60);
      expect(plan.timeBudget.plannedMinutes).toBeLessThanOrEqual(60);
      expect(plan.tasks.every((task:any)=>["must","recommended","optional"].includes(task.requiredness))).toBe(true);
      expect(plan.tasks.some((task:any)=>task.resourceUrl)).toBe(true);
      await postgres.query(`UPDATE plan_tasks SET scheduled_for=now()-interval '1 day',status='planned' WHERE user_id=$1 AND plan_id=$2`,[userId,plan.plan.id]);
      const today=await getTodayPlan(userId);
      expect(today.backlog.carriedForwardCount+today.backlog.deferredCount).toBeGreaterThan(0);
      const historical=await postgres.query(`SELECT count(*)::int AS count FROM plan_tasks WHERE user_id=$1 AND plan_id=$2 AND status='missed'`,[userId,plan.plan.id]);
      expect(historical.rows[0].count).toBeGreaterThan(0);
    }finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);}
  });

  it("ingests attributed source text, retrieves a real gap, generates grounded remediation, and verifies improvement",async()=>{
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Grounding Test') RETURNING id`,[`grounding-${randomUUID()}@test.local`])).rows[0].id;
    try{
      const study=await postgres.query<any>(`INSERT INTO study_sessions(user_id,title) VALUES($1,'TCP study') RETURNING id`,[userId]);
      const concept=await postgres.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points) VALUES($1,$2,'TCP Congestion Control','Sender-side traffic regulation.',$3) RETURNING id`,[userId,study.rows[0].id,["cwnd grows during slow start"]]);
      const sourceInput={title:"TCP Congestion Control Notes",text:"TCP congestion control uses the congestion window (cwnd) to limit bytes in flight at the sender. Slow start increases cwnd as acknowledgements arrive until the slow-start threshold or a loss event. Receiver flow control uses rwnd to limit data based on receiver capacity.",sourceType:"markdown",reference:"https://example.test/tcp-notes",provenance:{providedBy:"learner",license:"learner-provided"}};
      const source=await ingestGroundingSource(userId,sourceInput);
      expect(source.processingStatus).toBe("processed");
      expect(source.chunkCount).toBeGreaterThan(0);
      const repeated=await ingestGroundingSource(userId,sourceInput);
      expect(repeated.id).toBe(source.id);
      expect(repeated.duplicate).toBe(true);
      expect((await postgres.query<any>(`SELECT count(*)::int AS count FROM grounding_sources WHERE id=$1`,[source.id])).rows[0].count).toBe(1);
      expect((await postgres.query<any>(`SELECT count(*)::int AS count FROM grounding_chunks WHERE source_id=$1`,[source.id])).rows[0].count).toBe(source.chunkCount);
      await expect(getGroundingSource(userId,randomUUID())).rejects.toThrow("Source not found");
      const outsider=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Other User') RETURNING id`,[`grounding-other-${randomUUID()}@test.local`])).rows[0].id;
      try{await expect(getGroundingSource(outsider,source.id)).rejects.toThrow("Source not found");}finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[outsider]);}

      let triggeringAttempt:any;
      for(let index=0;index<3;index++){
        const run=await createAssessment(userId,concept.rows[0].id,"rapid_fire");
        const mcq=run.questions.find((item:any)=>item.questionType==="mcq");
        const question=mcq??run.questions.find((item:any)=>item.questionType==="rapid_recall");
        const submission=await submitRecall(question.id,mcq?{selectedOptionId:"a",confidence:9,userId}:{answer:"I do not know this yet.",confidence:9,userId});
        triggeringAttempt=submission.attempt;
      }
      expect(triggeringAttempt.recommendation.actionType).toBe("remediation");
      const remediation=await createGroundedRemediation(userId,triggeringAttempt.id);
      expect(remediation?.status).toBe("ready");
      expect(remediation?.knowledgePoint).toBe("cwnd grows during slow start");
      expect(remediation?.reason).toContain("confidence was 9/10");
      expect(remediation?.content.explanation).toContain("cwnd");
      expect(remediation?.sources[0].sourceId).toBe(source.id);
      expect(remediation?.sources[0].reference).toBe(sourceInput.reference);
      const persisted=await postgres.query<any>(`SELECT count(*)::int AS count FROM grounded_remediations WHERE triggering_attempt_id=$1`,[triggeringAttempt.id]);
      expect(persisted.rows[0].count).toBe(1);

      const verification=await createTargetedVerification(userId,remediation!.id);
      expect(verification.question.knowledgePoints).toEqual([remediation!.knowledgePoint]);
      expect(verification.question.prompt).toContain(remediation!.knowledgePoint);
      const priorQuestionIds=(await postgres.query<any>(`SELECT question_id FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 AND id<>$3`,[userId,concept.rows[0].id,verification.id])).rows.map((row:any)=>row.question_id);
      expect(priorQuestionIds).not.toContain(verification.question.id);
      expect((await postgres.query<any>(`SELECT count(*)::int AS count FROM grounded_remediation_chunks WHERE remediation_id=$1`,[remediation!.id])).rows[0].count).toBeGreaterThan(0);
      const sameVerification=await createTargetedVerification(userId,remediation!.id);
      expect(sameVerification.id).toBe(verification.id);
      const masteryBeforeVerification=(await getConceptState(userId,concept.rows[0].id))?.mastery;
      await submitRecall(verification.id,{answer:"cwnd grows during slow start as acknowledgements arrive and is limited by the slow-start threshold or loss",confidence:8,userId});
      const verified=await getGroundedRemediation(userId,remediation!.id);
      expect(verified.status).toBe("verified");
      expect(verified.improved).toBe(true);
      expect(verified.verificationScore).toBeGreaterThan(verified.triggerScore??0);
      const learnerAfterVerification=await getConceptState(userId,concept.rows[0].id);
      expect(learnerAfterVerification?.attemptCount).toBe(4);
      expect(learnerAfterVerification?.mastery).toBeGreaterThan(masteryBeforeVerification??0);

      const unrelated=await postgres.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points) VALUES($1,$2,'Database B tree page splits','Maintains ordered database indexes.',$3) RETURNING id`,[userId,study.rows[0].id,["page split preserves sorted key order"]]);
      const unrelatedAssessment=await createAssessment(userId,unrelated.rows[0].id,"rapid_fire");
      const unrelatedQuestion=unrelatedAssessment.questions.find((item:any)=>item.questionType==="rapid_recall");
      const unrelatedRecall=await submitRecall(unrelatedQuestion.id,{answer:"I do not know this yet.",confidence:4,userId});
      const insufficient=await createGroundedRemediation(userId,unrelatedRecall.attempt.id);
      expect(insufficient?.status).toBe("insufficient_sources");
      expect(insufficient?.content).toBeNull();

      const failedRun=await createAssessment(userId,concept.rows[0].id,"rapid_fire");
      const failedQuestion=failedRun.questions.find((item:any)=>item.questionType==="mcq");
      const failedCandidate=failedQuestion??failedRun.questions.find((item:any)=>item.questionType==="rapid_recall");
      const failedRecall=await submitRecall(failedCandidate.id,failedQuestion?{selectedOptionId:"a",confidence:9,userId}:{answer:"I do not know this yet.",confidence:9,userId});
      const failedGeneration=await createGroundedRemediation(userId,failedRecall.attempt.id,{remediator:{name:"failing-test-generator",generate:async()=>{throw new Error("test generation failure");}}});
      expect(failedGeneration?.status).toBe("failed");
      expect(failedGeneration?.sources.length).toBeGreaterThan(0);
      const retriedGeneration=await createGroundedRemediation(userId,failedRecall.attempt.id);
      expect(retriedGeneration?.status).toBe("ready");
      expect((await postgres.query<any>(`SELECT count(*)::int AS count FROM grounded_remediations WHERE triggering_attempt_id=$1`,[failedRecall.attempt.id])).rows[0].count).toBe(1);

      const noEmbedding={name:"bad-test-embedder",dimensions:64,embed:async()=>[]};
      await expect(ingestGroundingSource(userId,{title:"Failed embedding source",text:"This document is retained with failed processing status for retry."},{embeddingProvider:noEmbedding})).rejects.toThrow("missing or invalid vectors");
      const sources=await postgres.query<any>(`SELECT processing_status FROM grounding_sources WHERE user_id=$1 AND title='Failed embedding source'`,[userId]);
      expect(sources.rows[0].processing_status).toBe("failed");
      const retriedSource=await ingestGroundingSource(userId,{title:"Failed embedding source",text:"This document is retained with failed processing status for retry."});
      expect(retriedSource.id).toBe((await postgres.query<any>(`SELECT id FROM grounding_sources WHERE user_id=$1 AND title='Failed embedding source'`,[userId])).rows[0].id);
      expect(retriedSource.processingStatus).toBe("processed");
    }finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);}
  });
});
