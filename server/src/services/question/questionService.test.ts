import { describe, expect, it } from "vitest";
import { assessmentBlueprint, buildQuestion, buildTargetedVerificationQuestion, createStructuredParts, evaluateMcq, evaluateStructuredParts, evidenceWeight, mapStructuredAnswers, nextHint, selectAssessment, validateQuestionParts } from "./questionService.js";
import { findBuiltinMcq } from "./mcqBank.js";

describe("question engine primitives", () => {
  it("maps question types to the six assessment dimensions", () => {
    const cases = [["mcq","recognition"],["rapid_recall","recall"],["short_explanation","explanation"],["scenario","application"],["descriptive","depth"],["transfer","transfer"]] as const;
    for (const [type, level] of cases) expect(buildQuestion("Caching",type,["cache keys"]).assessmentLevel).toBe(level);
  });
  it("selects easier evidence after repeated failure and progresses after success", () => {
    expect(selectAssessment({ mastery: .7, recentFailures: 2 }).assessmentLevel).toBe("explanation");
    expect(selectAssessment({ mastery: .4, recentSuccesses: 2 }).assessmentLevel).toBe("explanation");
  });
  it("avoids selecting the same recent question type when an adjacent level is available", () => {
    const next = selectAssessment({ mastery: .1,recentTypes:["mcq"] });
    expect(next.questionType).not.toBe("mcq");
  });
  it("grades MCQs deterministically against the stored option id", () => {
    expect(evaluateMcq({ selectedOptionId:"ok", correctOptionId:"ok", knowledgePoints:["a"] }).overallCoverage).toBe(1);
    expect(evaluateMcq({ selectedOptionId:"no", correctOptionId:"ok", knowledgePoints:["a"] }).overallCoverage).toBe(0);
  });
  it("reveals hints sequentially and stops at the configured maximum", () => {
    const hints = ["one","two","three"];
    expect(nextHint(hints,0)).toEqual({ level:1,hint:"one" });
    expect(nextHint(hints,1)).toEqual({ level:2,hint:"two" });
    expect(nextHint(hints,3)).toBeNull();
  });
  it("reduces evidence transparently based on hint count", () => {
    expect(evidenceWeight(0)).toBe(1);
    expect(evidenceWeight(1)).toBeLessThan(evidenceWeight(0));
    expect(evidenceWeight(3)).toBeLessThan(evidenceWeight(2));
  });
  it("creates a short breadth session and a balanced six-dimension mastery blueprint", () => {
    expect(assessmentBlueprint("rapid_fire")).toHaveLength(5);
    expect(new Set(assessmentBlueprint("mastery_check").map((type) => buildQuestion("Queues",type,["acks"]).assessmentLevel))).toEqual(new Set(["recognition","recall","explanation","application","depth","transfer"]));
  });
  it("uses specific misconceptions and deterministic explanations for curated seed MCQs",()=>{
    const mcq=findBuiltinMcq("Token bucket rate limiting","Can compare burst capacity and sustained rate.");
    expect(mcq?.prompt).toContain("token-bucket");
    expect(mcq?.distractors.some((option)=>option.toLowerCase().includes("fixed-window"))).toBe(true);
    expect(mcq?.explanation).toContain("Refill rate");
  });
  it("targets verification at the evaluated weak knowledge point with alternate wording",()=>{
    const point="cwnd grows during slow start";
    const first=buildTargetedVerificationQuestion("TCP Congestion Control",point,0);
    const second=buildTargetedVerificationQuestion("TCP Congestion Control",point,1);
    expect(first.knowledgePoints).toEqual([point]);
    expect(first.prompt).toContain(point);
    expect(second.prompt).not.toBe(first.prompt);
  });
  it("varies stable question prompts across a bounded wording set",()=>{
    const question1=buildQuestion("Queues","short_explanation",["ack timing"],2,0,0);
    const question2=buildQuestion("Queues","short_explanation",["ack timing"],2,0,1);
    expect(question1.prompt).not.toBe(question2.prompt);
  });
  it("creates parts only for multi-point explanatory questions and preserves legacy single-point questions",()=>{
    expect(buildQuestion("Transactions","short_explanation",["Atomicity","Isolation"]).parts).toHaveLength(2);
    expect(buildQuestion("Transactions","short_explanation",["Atomicity"]).parts).toBeNull();
    expect(buildQuestion("Transactions","descriptive",["Atomicity","Isolation"]).parts).toBeNull();
    expect(buildQuestion("Transactions","mcq",["Atomicity","Isolation"]).parts).toBeNull();
  });
  it("validates question part IDs and their knowledge-point associations",()=>{
    const parts=createStructuredParts(["Atomicity","Isolation"],"Transactions")!;
    expect(validateQuestionParts(parts,["Atomicity","Isolation"])).toEqual(parts);
    expect(()=>validateQuestionParts([{...parts[0],knowledgePoints:["unknown"]},parts[1]],["Atomicity","Isolation"])).toThrow();
    expect(()=>validateQuestionParts([{...parts[0],id:parts[1].id},parts[1]],["Atomicity","Isolation"])).toThrow();
  });
  it("maps each answer by part ID, fills omitted parts as unanswered, and rejects unexpected or duplicate IDs",()=>{
    const parts=createStructuredParts(["Atomicity","Isolation"],"Transactions")!;
    expect(mapStructuredAnswers(parts,[{partId:"part-2",answer:"isolation answer"}])).toEqual([{partId:"part-1",answer:""},{partId:"part-2",answer:"isolation answer"}]);
    expect(()=>mapStructuredAnswers(parts,[{partId:"wrong",answer:"answer"}])).toThrow();
    expect(()=>mapStructuredAnswers(parts,[{partId:"part-1",answer:"a"},{partId:"part-1",answer:"b"}])).toThrow();
    expect(()=>mapStructuredAnswers(parts,[null])).toThrow();
  });
  it("evaluates each part against only its own answer and rubric",async()=>{
    const parts=createStructuredParts(["Atomicity: all operations commit or none do","Isolation: concurrent transactions do not interfere"],"Transactions")!;
    const mapped=mapStructuredAnswers(parts,[{partId:"part-1",answer:"Atomicity: all operations commit or none do"},{partId:"part-2",answer:"unrelated answer"}]);
    const evaluated=await evaluateStructuredParts(parts,mapped,async(part,answer)=>({feedback:`checked ${part.id}`,knowledgePointResults:[{point:part.knowledgePoints[0],status:answer===part.knowledgePoints[0]?"correct":"missing",evidence:answer,feedback:"checked"}]}));
    expect(evaluated.knowledgePointResults.map((item)=>[item.partId,item.status])).toEqual([["part-1","correct"],["part-2","missing"]]);
    expect(evaluated.overallCoverage).toBe(.5);
  });
  it("records missing structured answers as missing without invoking the evaluator",async()=>{
    const parts=createStructuredParts(["Atomicity","Isolation"],"Transactions")!;
    const mapped=mapStructuredAnswers(parts,[{partId:"part-1",answer:""},{partId:"part-2",answer:"isolation"}]);
    const evaluatePart=async(part:any,answer:string)=>({feedback:"checked",knowledgePointResults:[{point:part.knowledgePoints[0],status:"correct" as const,evidence:answer,feedback:"ok"}]});
    const evaluated=await evaluateStructuredParts(parts,mapped,evaluatePart);
    expect(evaluated.knowledgePointResults.map((item)=>item.status)).toEqual(["missing","correct"]);
    expect(evaluated.knowledgePointResults[0].evidence).toBe("");
    await expect(evaluateStructuredParts(parts,mapped,async()=>{throw new Error("provider unavailable");})).rejects.toThrow("provider unavailable");
  });
});
