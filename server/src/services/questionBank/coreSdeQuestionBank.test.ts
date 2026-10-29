import { describe, expect, it } from "vitest";
import { canonicalCoreSdeQuestions, canonicalDbmsQuestions, validateCoreSdeQuestionBank } from "./coreSdeQuestionBank.js";

describe("Core SDE question bank",()=>{
  it("provides stable six-candidate coverage for each authored point without duplicating prompts",()=>{
    expect(validateCoreSdeQuestionBank()).toEqual([]);
    expect(canonicalCoreSdeQuestions).toHaveLength(162);
    expect(new Set(canonicalCoreSdeQuestions.map((question)=>question.slug)).size).toBe(162);
    expect(new Set(canonicalCoreSdeQuestions.map((question)=>question.prompt.toLowerCase())).size).toBe(162);
    const points=new Set(canonicalCoreSdeQuestions.map((question)=>`${question.canonicalConceptName}\u0000${question.knowledgePoint}`));
    expect(points.size).toBe(27);
    for(const point of points){
      const group=canonicalCoreSdeQuestions.filter((question)=>`${question.canonicalConceptName}\u0000${question.knowledgePoint}`===point);
      expect(group.filter((question)=>question.questionType==="mcq")).toHaveLength(2);
      expect(group.filter((question)=>question.questionType==="rapid_recall")).toHaveLength(3);
      expect(group.filter((question)=>question.questionType==="short_explanation")).toHaveLength(1);
    }
  });

  it("adds four DBMS concepts with eight mapped points and written, non-executable SQL reasoning checks",()=>{
    expect(canonicalDbmsQuestions).toHaveLength(48);
    const expected = new Map([
      ["Data partitioning",2], ["Read replication",2], ["Join and aggregation queries",2], ["Relational data modeling",2],
    ]);
    for (const [concept, count] of expected) {
      const group = canonicalDbmsQuestions.filter((question)=>question.canonicalConceptName===concept);
      expect(new Set(group.map((question)=>question.knowledgePoint)).size).toBe(count);
      expect(group.every((question)=>question.source.url.includes("postgresql.org/docs/18/") || question.source.url.includes("15445.courses.cs.cmu.edu/fall2026/"))).toBe(true);
    }
    const sqlTasks = canonicalDbmsQuestions.filter((question)=>question.slug==="sde-db-partition-key-pruning-skew-verification" || question.slug==="sde-db-aggregate-grain-filter-verification");
    expect(sqlTasks).toHaveLength(2);
    expect(sqlTasks.every((question)=>question.prompt.toLowerCase().includes("write") && /application does not execute (?:this SQL|the SQL)/i.test(question.expectedAnswer))).toBe(true);
    expect(sqlTasks.every((question)=>question.rubric[0]?.fullCredit && question.rubric[0]?.partialCredit && question.rubric[0]?.insufficient)).toBe(true);
  });

  it("keeps deterministic answer keys and source provenance on each revision candidate",()=>{
    for(const question of canonicalCoreSdeQuestions){
      expect(question.source.accessedOn).toMatch(/^2026-10-\d{2}$/);
      expect(question.source.notes).toContain(`Accessed ${question.source.accessedOn}`);
      expect(question.source.url).toMatch(/^https:\/\//);
      if(question.questionType==="mcq"){
        expect(question.options?.filter((option)=>option.id===question.correctOptionId)).toHaveLength(1);
        expect(question.distractorRationales).toHaveLength(3);
      }
    }
  });

  it("reissues the OS and PostgreSQL index pilot points with exact source sections and corrected scoring contracts",()=>{
    const corrected=canonicalCoreSdeQuestions.filter((question)=>
      question.slug.startsWith("sde-os-process-thread-isolation-")||
      question.slug.startsWith("sde-os-race-protect-invariant-")||
      question.slug.startsWith("sde-db-composite-index-order-"),
    );
    expect(corrected).toHaveLength(18);
    expect(corrected.every((question)=>question.revision===2)).toBe(true);
    for(const question of corrected){
      expect(question.expectedAnswer.trim()).not.toBe("");
      expect(question.rubric.length).toBeGreaterThan(0);
      expect(question.rubric.every((dimension)=>dimension.fullCredit&&dimension.partialCredit&&dimension.insufficient)).toBe(true);
      if(question.questionType==="mcq"){
        expect(question.options?.find((option)=>option.id===question.correctOptionId)?.text).toBe(question.expectedAnswer);
        expect(question.options?.filter((option)=>option.id===question.correctOptionId)).toHaveLength(1);
      }
    }

    const processQuestions=corrected.filter((question)=>question.slug.startsWith("sde-os-process-thread-isolation-"));
    expect(processQuestions.every((question)=>question.source.url==="https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf"&&question.source.notes.includes("ch. 26")&&question.source.notes.includes("cpu-intro.pdf"))).toBe(true);
    const raceQuestions=corrected.filter((question)=>question.slug.startsWith("sde-os-race-protect-invariant-"));
    expect(raceQuestions.every((question)=>question.source.url==="https://eel.is/c%2B%2Bdraft/intro.races"&&question.source.notes.includes("[intro.races]")&&question.source.notes.includes("threads-bugs.pdf")&&question.source.notes.includes("threads-locks.pdf"))).toBe(true);
    expect(raceQuestions.filter((question)=>!question.slug.endsWith("-verification")).every((question)=>question.expectedAnswer.toLowerCase().includes("invariant")&&question.expectedAnswer.toLowerCase().includes("happens-before")&&question.expectedAnswer.toLowerCase().includes("undefined behavior"))).toBe(true);

    const indexQuestions=corrected.filter((question)=>question.slug.startsWith("sde-db-composite-index-order-"));
    expect(indexQuestions.every((question)=>question.source.url==="https://www.postgresql.org/docs/16/indexes-multicolumn.html"&&question.source.notes.includes("11.3"))).toBe(true);
    expect(indexQuestions.every((question)=>question.expectedAnswer.includes("tenant_id"))).toBe(true);
    expect(indexQuestions.filter((question)=>!question.slug.endsWith("-verification")).every((question)=>question.expectedAnswer.includes("created_at"))).toBe(true);
    const indexVerification=indexQuestions.find((question)=>question.slug.endsWith("-verification"));
    expect(indexVerification?.prompt).toContain("event_type = 'login'");
    expect(indexVerification?.prompt).not.toContain("created_at range");
    expect(indexVerification?.rubric[0]?.fullCredit).toContain("leading tenant_id");

    const processVerification=processQuestions.find((question)=>question.slug.endsWith("-verification"));
    expect(processVerification?.prompt).toContain("large read-only model");
    expect(processVerification?.prompt).not.toContain("new implementation changes one constraint");
    expect(processVerification?.rubric[0]?.fullCredit).toContain("threads share one process address space");
    const raceVerification=raceQuestions.find((question)=>question.slug.endsWith("-verification"));
    expect(raceVerification?.prompt).toContain("daily_total");
    expect(raceVerification?.rubric[0]?.partialCredit).toContain("multi-field invariant");
  });
});
