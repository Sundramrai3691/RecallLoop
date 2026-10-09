import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { postgres, runPostgresMigration } from "../../src/db/postgres.js";
import { createAssessment,getAssessment } from "../../src/services/question/assessmentService.js";
import { getAttempt,revealNextHint } from "../../src/repositories/legacyPostgresRepositories.js";
import { submitRecall } from "../../src/services/recall/recallService.js";
import { getSettings,updateSettings } from "../../src/services/settings/settingsService.js";
import { recommendResources } from "../../src/services/resources/resourceRecommendationService.js";
import { buildLearningPack } from "../../src/services/resources/learningPackService.js";
import { generateGoalPlan,getTodayPlan } from "../../src/services/goal/goalService.js";
import { getConceptState,getWeakSkills } from "../../src/services/learner/learnerModelService.js";
import { createGroundedRemediation,getGroundedRemediation,getGroundingSource,ingestGroundingSource } from "../../src/services/grounding/groundedRemediationService.js";
import { createTargetedVerification } from "../../src/services/question/assessmentService.js";

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
    const structured=await postgres.query<any>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='questions' AND column_name='question_parts') OR (table_name='recall_attempts' AND column_name='structured_answers') OR (table_name='recall_knowledge_point_results' AND column_name='part_id'))`);
    expect(structured.rows).toHaveLength(3);
  });

  it("persists structured answers and keeps each knowledge point state independent, including retries",async()=>{
    const userId=(await postgres.query<any>(`INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration-hash','Structured Test') RETURNING id`,[`structured-${randomUUID()}@test.local`])).rows[0].id;
    try{
      const session=(await postgres.query<any>(`INSERT INTO study_sessions(user_id,title) VALUES($1,'Structured evaluation') RETURNING id`,[userId])).rows[0];
      const points=["Atomicity guarantees all operations commit together or none do.","Isolation prevents concurrent transactions from observing inconsistent intermediate state."];
      const concept=(await postgres.query<any>(`INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points) VALUES($1,$2,'Database transactions','Transaction guarantees.',$3) RETURNING id`,[userId,session.id,points])).rows[0];
      const assessment=await createAssessment(userId,concept.id,"mastery_check");
      const structured=assessment.questions.find((item:any)=>item.questionType==="short_explanation");
      expect(structured?.questionData?.parts).toHaveLength(2);
      const [atomicity,isolation]=structured.questionData.parts;
      const submitted=await submitRecall(structured.id,{userId,confidence:8,answers:[{partId:atomicity.id,answer:points[0]},{partId:isolation.id,answer:"Transactions use a database."}]});
      expect(submitted.attempt.evaluation.knowledgePointResults.map((point:any)=>[point.partId,point.status])).toEqual([[atomicity.id,"correct"],[isolation.id,"missing"]]);
      expect(submitted.attempt.structuredAnswers).toEqual([{partId:atomicity.id,answer:points[0]},{partId:isolation.id,answer:"Transactions use a database."}]);
      const states=(await postgres.query<any>(`SELECT point,mastery::float AS mastery,attempt_count FROM learner_knowledge_point_states WHERE user_id=$1 AND concept_id=$2 ORDER BY point`,[userId,concept.id])).rows;
      expect(states).toHaveLength(2);
      expect(states.find((state:any)=>state.point===points[0]).mastery).toBe(0.6);
      expect(states.find((state:any)=>state.point===points[1]).mastery).toBe(0);
      await expect(submitRecall(structured.id,{userId,confidence:8,answers:[{partId:atomicity.id,answer:points[0]},{partId:isolation.id,answer:points[1]}]})).rejects.toThrow("already been submitted");
      const counts=await postgres.query<any>(`SELECT (SELECT count(*)::int FROM recall_evaluations WHERE recall_attempt_id=$1) AS evaluations,(SELECT count(*)::int FROM learner_knowledge_point_states WHERE user_id=$2 AND concept_id=$3) AS states`,[structured.id,userId,concept.id]);
      expect(counts.rows[0]).toMatchObject({evaluations:1,states:2});
    }finally{await postgres.query(`DELETE FROM app_users WHERE id=$1`,[userId]);}
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
      const httpMcq=httpAssessment.questions.find((item:any)=>item.questionType==="mcq");
      await submitRecall(httpMcq.id,{selectedOptionId:"a",confidence:4,userId});
      const resources=await recommendResources({userId,conceptId:httpConcept.rows[0].id,availableMinutes:30});
      expect(resources.length).toBeGreaterThan(0);
      expect(resources.length).toBeLessThanOrEqual(4);
      expect(resources.every((resource)=>resource.estimatedMinutes<=30)).toBe(true);
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
        const submission=await submitRecall(mcq.id,{selectedOptionId:"a",confidence:9,userId});
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
      const unrelatedQuestion=unrelatedAssessment.questions.find((item:any)=>item.questionType==="mcq");
      const unrelatedRecall=await submitRecall(unrelatedQuestion.id,{selectedOptionId:"a",confidence:4,userId});
      const insufficient=await createGroundedRemediation(userId,unrelatedRecall.attempt.id);
      expect(insufficient?.status).toBe("insufficient_sources");
      expect(insufficient?.content).toBeNull();

      const failedRun=await createAssessment(userId,concept.rows[0].id,"rapid_fire");
      const failedQuestion=failedRun.questions.find((item:any)=>item.questionType==="mcq");
      const failedRecall=await submitRecall(failedQuestion.id,{selectedOptionId:"a",confidence:9,userId});
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
