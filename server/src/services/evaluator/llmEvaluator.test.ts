import { describe,expect,it } from "vitest";
import { AppError } from "../../utils/errors.js";
import { alignKnowledgePoints } from "./llmEvaluator.js";
import { LlmEvaluator } from "./llmEvaluator.js";

describe("structured evaluator result alignment",()=>{
  it("rejects unexpected, missing, or duplicate knowledge-point labels in strict mode",()=>{
    expect(()=>alignKnowledgePoints(["Atomicity"],[{point:"Isolation",status:"correct",evidence:"",feedback:""}],true)).toThrow("unexpected knowledge points");
    expect(()=>alignKnowledgePoints(["Atomicity","Isolation"],[{point:"Atomicity",status:"correct",evidence:"",feedback:""}],true)).toThrow("unexpected knowledge points");
    expect(()=>alignKnowledgePoints(["Atomicity"],[{point:"Atomicity",status:"correct",evidence:"",feedback:""},{point:"Atomicity",status:"missing",evidence:"",feedback:""}],true)).toThrow("unexpected knowledge points");
  });
  it("preserves legacy alignment behavior when strict part mapping is not requested",()=>{
    expect(alignKnowledgePoints(["Atomicity"],[{point:"Atomicity",status:"correct",evidence:"all or nothing",feedback:"good"}])).toEqual([{point:"Atomicity",status:"correct",evidence:"all or nothing",feedback:"good"}]);
  });
  it("does not retry provider authentication, quota, or transport failures", async () => {
    let calls = 0;
    const evaluator = new LlmEvaluator({ name: "test", complete: async () => { calls += 1; throw new AppError("provider authentication failed (HTTP 401)", 503, "LLM_AUTHENTICATION_FAILED"); } });
    await expect(evaluator.extractConcepts({ title: "Caching", rawMaterial: "Cache aside loads from the database on a cache miss." })).rejects.toMatchObject({ code: "LLM_AUTHENTICATION_FAILED" });
    expect(calls).toBe(1);
  });
  it("reports malformed or schema-invalid output after its bounded retry", async () => {
    let calls = 0;
    const evaluator = new LlmEvaluator({ name: "test", complete: async () => { calls += 1; return "not json"; } });
    await expect(evaluator.extractConcepts({ title: "Caching", rawMaterial: "Cache aside loads from the database on a cache miss." })).rejects.toThrow("malformed or schema-invalid JSON after retry");
    expect(calls).toBe(2);
  });
});
