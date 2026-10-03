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
});
