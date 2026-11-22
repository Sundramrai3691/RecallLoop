import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { postgres,runPostgresMigration } from "../../src/db/postgres.js";
import { seedCanonicalQuestionBank } from "../../src/db/seedCanonicalQuestionBank.js";
import { abandonSprint,completeSprint,getActiveSprint,startSprint } from "../../src/services/sprint/sprintService.js";
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
});
