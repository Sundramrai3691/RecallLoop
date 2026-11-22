import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { postgres,runPostgresMigration } from "../../src/db/postgres.js";
import { seedCanonicalQuestionBank } from "../../src/db/seedCanonicalQuestionBank.js";
import { abandonSprint,completeSprint,getActiveSprint,startSprint,startSprintVerification } from "../../src/services/sprint/sprintService.js";
import { submitRecall } from "../../src/services/recall/recallService.js";

describe("Recall Sprint persistence integration",()=>{
  beforeAll(async()=>{
    await runPostgresMigration();
    await seedCanonicalQuestionBank();
  });
  afterAll(async()=>{await postgres.end();});

  it("creates one resumable due Sprint and preserves duplicate/retry semantics",async()=>{
    const userId=(await postgres.query<{id:string}>(
      `INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration','Sprint user') RETURNING id`,
      [`sprint-${randomUUID()}@test.local`],
    )).rows[0].id;
    const sessionId=(await postgres.query<{id:string}>(
      `INSERT INTO study_sessions(user_id,title,raw_material,source_type,status,completed_at)
       VALUES($1,'Sprint fixture','Recall the fixture concept.','notes','completed',now()) RETURNING id`,
      [userId],
    )).rows[0].id;
    const conceptId=(await postgres.query<{id:string}>(
      `INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points,difficulty,mastery)
       VALUES($1,$2,'Sprint fixture','A disposable Sprint concept',ARRAY['Explain the fixture concept.'],2,0.4) RETURNING id`,
      [userId,sessionId],
    )).rows[0].id;
    const attemptId=(await postgres.query<{id:string}>(
      `INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question)
       VALUES($1,$2,$3,'rapid_recall','Explain the Sprint fixture concept from memory.') RETURNING id`,
      [userId,conceptId,sessionId],
    )).rows[0].id;
    await postgres.query(
      `INSERT INTO review_states(user_id,concept_id,state,due_at,difficulty)
       VALUES($1,$2,'review',now()-interval '1 hour',0.4)`,
      [userId,conceptId],
    );

    const key=randomUUID();
    const sprint=await startSprint(userId,key);
    expect(sprint.status).toBe("in_progress");
    expect(sprint.items).toHaveLength(1);
    expect(sprint.items[0].source).toBe("due");
    expect(sprint.items[0].recallAttemptId).toBe(attemptId);

    await expect(startSprint(userId,key,"different-request-hash")).rejects.toMatchObject({code:"SPRINT_IDEMPOTENCY_REUSED"});

    const retried=await startSprint(userId,randomUUID());
    expect(retried.id).toBe(sprint.id);

    const active=await getActiveSprint(userId);
    expect(active?.id).toBe(sprint.id);

    await expect(completeSprint(userId,sprint.id)).rejects.toMatchObject({code:"SPRINT_INCOMPLETE"});

    await submitRecall(attemptId,{
      answer:"The fixture concept explains one bounded behavior.",
      confidence:7,
      userId,
    });

    const completed=await completeSprint(userId,sprint.id);
    expect(completed.status).toBe("completed");
    expect(completed.progress.submitted).toBe(1);
    expect(completed.progress.total).toBe(1);
    expect((await getActiveSprint(userId))).toBeNull();

    const idempotent=await startSprint(userId,key);
    expect(idempotent.id).toBe(sprint.id);
    expect(idempotent.status).toBe("completed");
  });

  it("abandonment is explicit and owner-scoped",async()=>{
    const owner=(await postgres.query<{id:string}>(
      `INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration','Sprint owner') RETURNING id`,
      [`owner-${randomUUID()}@test.local`],
    )).rows[0].id;
    const other=(await postgres.query<{id:string}>(
      `INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration','Sprint other') RETURNING id`,
      [`other-${randomUUID()}@test.local`],
    )).rows[0].id;
    const sessionId=(await postgres.query<{id:string}>(
      `INSERT INTO study_sessions(user_id,title,raw_material,source_type,status,completed_at)
       VALUES($1,'Abandon fixture','Fixture.','notes','completed',now()) RETURNING id`,
      [owner],
    )).rows[0].id;
    const conceptId=(await postgres.query<{id:string}>(
      `INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points,difficulty)
       VALUES($1,$2,'Abandon fixture','Fixture',ARRAY['Abandon fixture behavior.'],2) RETURNING id`,
      [owner,sessionId],
    )).rows[0].id;
    const attemptId=(await postgres.query<{id:string}>(
      `INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question)
       VALUES($1,$2,$3,'rapid_recall','Explain the abandon fixture.') RETURNING id`,
      [owner,conceptId,sessionId],
    )).rows[0].id;
    await postgres.query(
      `INSERT INTO review_states(user_id,concept_id,state,due_at,difficulty)
       VALUES($1,$2,'review',now()-interval '1 hour',0.4)`,
      [owner,conceptId],
    );
    const sprint=await startSprint(owner,randomUUID());
    expect(sprint.items[0].recallAttemptId).toBe(attemptId);

    await expect(abandonSprint(other,sprint.id)).rejects.toMatchObject({code:"SPRINT_NOT_FOUND"});
    const abandoned=await abandonSprint(owner,sprint.id);
    expect(abandoned.status).toBe("abandoned");
  });

  it("does not create a Sprint when no eligible work exists",async()=>{
    const userId=(await postgres.query<{id:string}>(
      `INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration','Empty Sprint user') RETURNING id`,
      [`empty-sprint-${randomUUID()}@test.local`],
    )).rows[0].id;
    await expect(startSprint(userId,randomUUID())).rejects.toMatchObject({code:"SPRINT_NO_ELIGIBLE_WORK"});
    const rows=await postgres.query<{count:string}>(`SELECT count(*)::text AS count FROM recall_sprints WHERE user_id=$1`,[userId]);
    expect(rows.rows[0].count).toBe("0");
  });

  it("allows concurrent starts to reuse one Sprint and subsequent Sprint after abandonment",async()=>{
    const userId=(await postgres.query<{id:string}>(
      `INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration','Concurrent Sprint user') RETURNING id`,
      [`concurrent-sprint-${randomUUID()}@test.local`],
    )).rows[0].id;
    const sessionId=(await postgres.query<{id:string}>(
      `INSERT INTO study_sessions(user_id,title,raw_material,source_type,status,completed_at)
       VALUES($1,'Concurrent Sprint fixture','Fixture.','notes','completed',now()) RETURNING id`,
      [userId],
    )).rows[0].id;
    const conceptId=(await postgres.query<{id:string}>(
      `INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points,difficulty)
       VALUES($1,$2,'Concurrent Sprint','Fixture',ARRAY['Concurrent Sprint behavior.'],2) RETURNING id`,
      [userId,sessionId],
    )).rows[0].id;
    const attemptId=(await postgres.query<{id:string}>(
      `INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question)
       VALUES($1,$2,$3,'rapid_recall','Explain concurrent Sprint behavior.') RETURNING id`,
      [userId,conceptId,sessionId],
    )).rows[0].id;
    await postgres.query(
      `INSERT INTO review_states(user_id,concept_id,state,due_at,difficulty)
       VALUES($1,$2,'review',now()-interval '1 hour',0.4)`,
      [userId,conceptId],
    );

    const key=randomUUID();
    const [first,second]=await Promise.all([startSprint(userId,key),startSprint(userId,key)]);
    expect(first.id).toBe(second.id);
    expect((await postgres.query<{count:string}>(`SELECT count(*)::text AS count FROM recall_sprints WHERE user_id=$1 AND status='in_progress'`,[userId])).rows[0].count).toBe("1");

    const abandoned=await abandonSprint(userId,first.id);
    expect(abandoned.status).toBe("abandoned");
    expect((await getActiveSprint(userId))).toBeNull();
    expect((await postgres.query<any>(`SELECT submitted_at FROM recall_attempts WHERE id=$1`,[attemptId])).rows[0].submitted_at).toBeNull();

    const resumed=await startSprint(userId,randomUUID());
    expect(resumed.id).not.toBe(first.id);
    expect(resumed.items[0].recallAttemptId).toBe(attemptId);
  });

  it("allows exactly one concurrent submission for the same recall attempt",async()=>{
    const userId=(await postgres.query<{id:string}>(
      `INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration','Concurrent submission user') RETURNING id`,
      [`concurrent-submit-${randomUUID()}@test.local`],
    )).rows[0].id;
    const sessionId=(await postgres.query<{id:string}>(
      `INSERT INTO study_sessions(user_id,title,raw_material,source_type,status,completed_at)
       VALUES($1,'Concurrent submit fixture','Fixture.','notes','completed',now()) RETURNING id`,
      [userId],
    )).rows[0].id;
    const conceptId=(await postgres.query<{id:string}>(
      `INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points,difficulty)
       VALUES($1,$2,'Concurrent submit','Fixture',ARRAY['Exactly one submission.'],2) RETURNING id`,
      [userId,sessionId],
    )).rows[0].id;
    const attemptId=(await postgres.query<{id:string}>(
      `INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question)
       VALUES($1,$2,$3,'rapid_recall','Explain exactly one submission.') RETURNING id`,
      [userId,conceptId,sessionId],
    )).rows[0].id;

    const results=await Promise.allSettled([
      submitRecall(attemptId,{userId,answer:"Exactly one submission is stored.",confidence:7}),
      submitRecall(attemptId,{userId,answer:"A competing answer must not overwrite it.",confidence:4}),
    ]);
    expect(results.filter((result)=>result.status==="fulfilled")).toHaveLength(1);
    expect(results.filter((result)=>result.status==="rejected")).toHaveLength(1);
    const evaluationCount=await postgres.query<{count:string}>(
      `SELECT count(*)::text AS count FROM recall_evaluations WHERE recall_attempt_id=$1`,
      [attemptId],
    );
    expect(evaluationCount.rows[0].count).toBe("1");
    const learningEvents=await postgres.query<{count:string}>(
      `SELECT count(*)::text AS count FROM learning_events WHERE user_id=$1 AND entity_type='RecallAttempt' AND entity_id=$2 AND type='RECALL_SUBMITTED'`,
      [userId,attemptId],
    );
    expect(learningEvents.rows[0].count).toBe("1");
  });

  it("keeps abandoned attempt history and reuses it in a subsequent Sprint",async()=>{
    const userId=(await postgres.query<{id:string}>(
      `INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration','Abandon recovery user') RETURNING id`,
      [`abandon-recovery-${randomUUID()}@test.local`],
    )).rows[0].id;
    const sessionId=(await postgres.query<{id:string}>(
      `INSERT INTO study_sessions(user_id,title,raw_material,source_type,status,completed_at)
       VALUES($1,'Abandon recovery fixture','Fixture.','notes','completed',now()) RETURNING id`,
      [userId],
    )).rows[0].id;
    const conceptId=(await postgres.query<{id:string}>(
      `INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points,difficulty)
       VALUES($1,$2,'Abandon recovery','Fixture',ARRAY['Abandon recovery behavior.'],2) RETURNING id`,
      [userId,sessionId],
    )).rows[0].id;
    const attemptId=(await postgres.query<{id:string}>(
      `INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question)
       VALUES($1,$2,$3,'rapid_recall','Explain abandon recovery behavior.') RETURNING id`,
      [userId,conceptId,sessionId],
    )).rows[0].id;
    await postgres.query(
      `INSERT INTO review_states(user_id,concept_id,state,due_at,difficulty)
       VALUES($1,$2,'review',now()-interval '1 hour',0.4)`,
      [userId,conceptId],
    );

    const first=await startSprint(userId,randomUUID());
    const abandoned=await abandonSprint(userId,first.id);
    expect(abandoned.status).toBe("abandoned");
    expect((await postgres.query<{count:string}>(`SELECT count(*)::text AS count FROM recall_attempts WHERE id=$1 AND submitted_at IS NULL`,[attemptId])).rows[0].count).toBe("1");
    expect((await postgres.query<{count:string}>(`SELECT count(*)::text AS count FROM recall_sprint_items WHERE sprint_id=$1 AND recall_attempt_id=$2`,[first.id,attemptId])).rows[0].count).toBe("1");

    const subsequent=await startSprint(userId,randomUUID());
    expect(subsequent.id).not.toBe(first.id);
    expect(subsequent.items.some((item)=>item.recallAttemptId===attemptId)).toBe(true);
  });

  it("blocks canonical verification when no eligible distinct revision exists",async()=>{
    const userId=(await postgres.query<{id:string}>(
      `INSERT INTO app_users(email,password_hash,name) VALUES($1,'integration','No verification user') RETURNING id`,
      [`no-verification-${randomUUID()}@test.local`],
    )).rows[0].id;
    const canonical=(await postgres.query<{id:string}>(`SELECT id FROM canonical_concepts WHERE status='active' ORDER BY id LIMIT 1`)).rows[0];
    expect(canonical).toBeDefined();
    const sessionId=(await postgres.query<{id:string}>(
      `INSERT INTO study_sessions(user_id,title,raw_material,source_type,status,completed_at,canonical_concept_id)
       VALUES($1,'No verification fixture','Fixture.','notes','completed',now(),$2) RETURNING id`,
      [userId,canonical.id],
    )).rows[0].id;
    const conceptId=(await postgres.query<{id:string}>(
      `INSERT INTO personal_concepts(user_id,study_session_id,name,description,required_knowledge_points,difficulty,canonical_concept_id)
       VALUES($1,$2,'No verification','Fixture',ARRAY['No verification behavior.'],2,$3) RETURNING id`,
      [userId,sessionId,canonical.id],
    )).rows[0].id;
    const attemptId=(await postgres.query<{id:string}>(
      `INSERT INTO recall_attempts(user_id,concept_id,study_session_id,question_type,question,submitted_at,result_status)
       VALUES($1,$2,$3,'rapid_recall','Explain no verification behavior.',now(),'incorrect') RETURNING id`,
      [userId,conceptId,sessionId],
    )).rows[0].id;
    const remediationId=(await postgres.query<{id:string}>(
      `INSERT INTO grounded_remediations(user_id,triggering_attempt_id,concept_id,knowledge_point,reason,status,trigger_score)
       VALUES($1,$2,$3,'No verification behavior.','Test fixture','ready',0) RETURNING id`,
      [userId,attemptId,conceptId],
    )).rows[0].id;
    const sprintId=(await postgres.query<{id:string}>(
      `INSERT INTO recall_sprints(user_id,status,idempotency_key,repair_remediation_id)
       VALUES($1,'in_progress',$2,$3) RETURNING id`,
      [userId,randomUUID(),remediationId],
    )).rows[0].id;

    await expect(startSprintVerification(userId,sprintId)).rejects.toMatchObject({code:"NO_FRESH_VERIFICATION",status:409});
    const stored=await postgres.query<any>(`SELECT verification_attempt_id FROM grounded_remediations WHERE id=$1`,[remediationId]);
    expect(stored.rows[0].verification_attempt_id).toBeNull();
  });
});
