import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { postgres, runPostgresMigration, withTransaction } from "../../src/db/postgres.js";
import { createAssessment,getAssessment } from "../../src/services/question/assessmentService.js";
import { createBaseline,getBaseline,submitBaselineQuestion } from "../../src/services/baseline/baselineService.js";
import { createConceptsForSession } from "../../src/services/concept/conceptService.js";
import { createConcepts,createSession,getAttempt,getSession,revealNextHint,resolveCanonicalKnowledgePoint } from "../../src/repositories/legacyPostgresRepositories.js";
import { submitRecall } from "../../src/services/recall/recallService.js";
import { getSettings,updateSettings } from "../../src/services/settings/settingsService.js";
import { recommendResources } from "../../src/services/resources/resourceRecommendationService.js";
import { buildLearningPack } from "../../src/services/resources/learningPackService.js";
import { generateGoalPlan,getTodayPlan } from "../../src/services/goal/goalService.js";
import { getConceptState,getWeakSkills } from "../../src/services/learner/learnerModelService.js";
import { createGroundedRemediation,getGroundedRemediation,getGroundingSource,ingestGroundingSource } from "../../src/services/grounding/groundedRemediationService.js";
import { createTargetedVerification } from "../../src/services/question/assessmentService.js";
import { serializeAttempt,serializeSession } from "../../src/lib/serialize.js";
import { getRoleRoadmap } from "../../src/services/knowledge/knowledgeService.js";
import { createStudySession } from "../../src/services/study/studySessionService.js";
import { env } from "../../src/config/env.js";
import { resetEvaluatorForTests } from "../../src/services/evaluator/index.js";

describe("PostgreSQL runtime integration", () => {
  beforeAll(async () => {
    await runPostgresMigration();
  });

  afterAll(async () => {
    await postgres.end();
  });

  it("applies relational schema and exposes core tables", async () => {
    const result = await postgres.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('app_users','goals','study_sessions','recall_attempts','recall_evaluations','review_states','canonical_concepts','baseline_assessments','resources','questions','assessment_sessions','recall_dimension_results','assessment_recommendations')`);
    expect(result.rows.length).toBe(13);
    const structured=await postgres.query<any>(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='questions' AND column_name='question_parts') OR (table_name='recall_attempts' AND column_name='structured_answers') OR (table_name='recall_knowledge_point_results' AND column_name IN ('part_id','canonical_knowledge_point_id')) OR (table_name='learner_knowledge_point_states' AND column_name='canonical_knowledge_point_id') OR (table_name='personal_concepts' AND column_name='canonical_concept_id') OR (table_name='study_sessions' AND column_name IN ('source_url','canonical_topic_id','canonical_concept_id')))`);
    expect(structured.rows).toHaveLength(9);
  });

  it("deduplicates canonical seed rows, keeps topic identity, and remains stable across migration reruns",async()=>{
    const targets=await postgres.query<any>(`SELECT r.id AS role_id,c.id AS concept_id,c.name AS concept_name,t.name AS topic_name,count(kp.id)::int AS point_rows,count(DISTINCT kp.id)::int AS distinct_ids,count(DISTINCT regexp_replace(lower(trim(kp.statement)),'[[:space:]]+',' ','g'))::int AS distinct_statements FROM roles r JOIN role_skills rs ON rs.role_id=r.id JOIN canonical_skills s ON s.id=rs.skill_id JOIN topics t ON t.skill_id=s.id JOIN canonical_concepts c ON c.topic_id=t.id LEFT JOIN knowledge_points kp ON kp.concept_id=c.id WHERE r.name='Backend Engineer' AND ((t.name='HTTP' AND c.name='HTTP caching') OR (t.name='Caching' AND c.name='Cache-aside pattern')) GROUP BY r.id,c.id,c.name,t.name ORDER BY t.name`);
    expect(targets.rows).toHaveLength(2);
    expect(targets.rows.map((row:any)=>[row.topic_name,row.concept_name,row.point_rows,row.distinct_ids,row.distinct_statements])).toEqual([
      ["Caching","Cache-aside pattern",1,1,1],
      ["HTTP","HTTP caching",1,1,1],
    ]);
    const audit=await postgres.query<any>(`SELECT action,record_count,cardinality(record_ids)::int AS recorded_ids,metadata_variant_count,references_before FROM canonical_knowledge_point_deduplication_audit WHERE concept_id=$1 AND normalized_statement='can distinguish freshness from validation.'`,[targets.rows.find((row:any)=>row.concept_name==="HTTP caching").concept_id]);
    expect(audit.rows[0]).toMatchObject({action:"deduplicated",record_count:audit.rows[0]?.recorded_ids,metadata_variant_count:1});
    expect(Number(audit.rows[0]?.record_count)).toBeGreaterThan(1);

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
      const concept=(await client.query<any>(`SELECT c.id FROM canonical_concepts c JOIN topics t ON t.id=c.topic_id WHERE t.name='HTTP' AND c.name='HTTP caching' LIMIT 1`)).rows[0];
      await client.query(`DROP INDEX IF EXISTS uq_knowledge_points_concept_statement_metadata`);
      const duplicateA="00000000-0000-0000-0000-000000000001";
      const duplicateB="00000000-0000-0000-0000-000000000002";
      await client.query(`INSERT INTO knowledge_points(id,concept_id,statement,importance,difficulty) VALUES($1,$3,'Can distinguish freshness from validation.',80,3),($2,$3,'Can distinguish freshness from validation.',80,3)`,[duplicateA,duplicateB,concept.id]);

      const userId=(await client.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Point Reference Test') RETURNING id`,[`point-refs-${randomUUID()}@test.local`])).rows[0].id;
      const goalId=(await client.query<any>(`INSERT INTO goals(user_id,title) VALUES($1,'Point reference fixture') RETURNING id`,[userId])).rows[0].id;
      const assessmentId=(await client.query<any>(`INSERT INTO baseline_assessments(user_id,goal_id,selected_level,baseline_source) VALUES($1,$2,'familiar','assessed') RETURNING id`,[userId,goalId])).rows[0].id;
      await client.query(`INSERT INTO baseline_questions(assessment_id,concept_id,knowledge_point_id,level,question) VALUES($1,$2,$3,'L1','Fixture baseline'),($1,$2,$4,'L2','Second fixture baseline')`,[assessmentId,concept.id,duplicateA,duplicateB]);

      const sessionId=(await client.query<any>(`INSERT INTO study_sessions(user_id,title) VALUES($1,'Point reference fixture') RETURNING id`,[userId])).rows[0].id;
      const personalConceptId=(await client.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description) VALUES($1,$2,'Point reference fixture','Fixture concept') RETURNING id`,[userId,sessionId])).rows[0].id;
      await client.query(`INSERT INTO learner_knowledge_point_states(user_id,concept_id,point,last_status,canonical_knowledge_point_id) VALUES($1,$2,'Can distinguish freshness from validation.','correct',$3)`,[userId,personalConceptId,duplicateA]);
      const attemptId=(await client.query<any>(`INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question) VALUES($1,$2,$3,'explain','Fixture recall') RETURNING id`,[userId,personalConceptId,sessionId])).rows[0].id;
      const evaluationId=(await client.query<any>(`INSERT INTO recall_evaluations(recall_attempt_id,overall_coverage,feedback,suggested_recall_type,evaluator_version) VALUES($1,1,'Fixture evidence','explain','integration') RETURNING id`,[attemptId])).rows[0].id;
      await client.query(`INSERT INTO recall_knowledge_point_results(evaluation_id,point,status,canonical_knowledge_point_id) VALUES($1,'Can distinguish freshness from validation.','correct',$2)`,[evaluationId,duplicateB]);

      const conflictA="00000000-0000-0000-0000-000000000010";
      const conflictB="00000000-0000-0000-0000-000000000011";
      await client.query(`INSERT INTO knowledge_points(id,concept_id,statement,importance,difficulty) VALUES($1,$3,'Metadata conflict point.',50,2),($2,$3,'Metadata conflict point.',90,4)`,[conflictA,conflictB,concept.id]);

      const migration=await readFile(new URL("../../migrations/015_deduplicate_canonical_knowledge_points.sql",import.meta.url),"utf8");
      await client.query(migration);
      const keeper=(await client.query<any>(`SELECT id FROM knowledge_points WHERE concept_id=$1 AND regexp_replace(lower(trim(statement)),'[[:space:]]+',' ','g')='can distinguish freshness from validation.' ORDER BY id LIMIT 1`,[concept.id])).rows[0].id;
      const refs=await client.query<any>(`SELECT (SELECT count(*)::int FROM baseline_questions WHERE assessment_id=$1 AND knowledge_point_id=$2) AS baseline_refs,(SELECT count(*)::int FROM learner_knowledge_point_states WHERE user_id=$3 AND canonical_knowledge_point_id=$2) AS learner_refs,(SELECT count(*)::int FROM recall_knowledge_point_results WHERE evaluation_id=$4 AND canonical_knowledge_point_id=$2) AS recall_refs`,[assessmentId,keeper,userId,evaluationId]);
      expect(refs.rows[0]).toEqual({baseline_refs:2,learner_refs:1,recall_refs:1});
      expect(Number((await client.query<any>(`SELECT count(*)::int AS count FROM knowledge_points WHERE concept_id=$1 AND regexp_replace(lower(trim(statement)),'[[:space:]]+',' ','g')='can distinguish freshness from validation.'`,[concept.id])).rows[0].count)).toBe(1);
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

  it("keeps extracted concepts and points stable across repeated processing and scores unique baseline evidence",async()=>{
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

      const skill=(await postgres.query<any>(`SELECT id FROM canonical_skills ORDER BY name LIMIT 1`)).rows[0];
      const goal=(await postgres.query<any>(`INSERT INTO goals(user_id,title) VALUES($1,'Baseline integrity') RETURNING id`,[userId])).rows[0];
      const baseline=await createBaseline({userId,goalId:goal.id,skillId:skill.id,level:"familiar"});
      expect(baseline.questions.length).toBeGreaterThan(0);
      expect(new Set(baseline.questions.map((question:any)=>question.conceptId)).size).toBe(baseline.questions.length);
      expect(baseline.questions.every((question:any)=>Boolean(question.knowledgePointId))).toBe(true);
      expect(baseline.assessment.observedMastery).toBeNull();
      expect((await getBaseline(baseline.assessment.id,userId)).assessment.observedStatus).toBe("Not assessed");
      let result=baseline;
      for(const question of baseline.questions){
        result=await submitBaselineQuestion(baseline.assessment.id,userId,{questionId:question.id,answer:"No relevant answer provided.",confidence:4});
      }
      expect(Number(result.assessment.observedMastery)).toBe(0);
      const baselineReport=(await getBaseline(baseline.assessment.id,userId)).assessment;
      expect(baselineReport.observedEvidenceCount).toBeLessThan(3);
      expect(baselineReport.observedStatus).toBe("Early signal");
      const assessedPoints=result.questions.flatMap((question:any)=>question.knowledgePointResults??[]);
      expect(assessedPoints.length).toBeGreaterThan(0);
      expect(result.questions.every((question:any)=>(question.knowledgePointResults??[]).length===1)).toBe(true);
      const uniquePoints=new Set(result.questions.flatMap((question:any)=>(question.knowledgePointResults??[]).map((point:any)=>`${question.conceptId}:${point.point.trim().toLowerCase().replace(/\s+/g," ")}`)));
      expect(assessedPoints.length).toBe(uniquePoints.size);
    }finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);}
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
