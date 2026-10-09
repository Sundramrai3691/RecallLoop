import { describe,expect,it } from "vitest";
import { alignKnowledgePoints } from "./llmEvaluator.js";

describe("structured evaluator result alignment",()=>{
  it("rejects unexpected, missing, or duplicate knowledge-point labels in strict mode",()=>{
    expect(()=>alignKnowledgePoints(["Atomicity"],[{point:"Isolation",status:"correct",evidence:"",feedback:""}],true)).toThrow("unexpected knowledge points");
    expect(()=>alignKnowledgePoints(["Atomicity","Isolation"],[{point:"Atomicity",status:"correct",evidence:"",feedback:""}],true)).toThrow("unexpected knowledge points");
    expect(()=>alignKnowledgePoints(["Atomicity"],[{point:"Atomicity",status:"correct",evidence:"",feedback:""},{point:"Atomicity",status:"missing",evidence:"",feedback:""}],true)).toThrow("unexpected knowledge points");
  });
  it("preserves legacy alignment behavior when strict part mapping is not requested",()=>{
    expect(alignKnowledgePoints(["Atomicity"],[{point:"Atomicity",status:"correct",evidence:"all or nothing",feedback:"good"}])).toEqual([{point:"Atomicity",status:"correct",evidence:"all or nothing",feedback:"good"}]);
  });
});
