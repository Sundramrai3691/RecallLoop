import {describe,expect,it} from "vitest";
import {DeterministicGroundedRemediator,parseGroundedRemediation} from "./remediationGenerator.js";

describe("grounded remediation generation",()=>{
  const input={conceptName:"TCP Congestion Control",knowledgePoint:"cwnd grows during slow start",whyThis:"Your latest answer missed cwnd behavior.",evaluationEvidence:{status:"missing",feedback:"The point was missing.",mistakes:["Did not describe cwnd"],confidence:8},sources:[{sourceId:"s1",chunkId:"c1",title:"TCP notes",reference:"https://example.test/tcp",sourceType:"markdown",relevance:.83,text:"During slow start, TCP increases the congestion window (cwnd) as acknowledgements arrive. This exponential growth continues until the threshold or a loss event."}]};
  it("constructs an extractive explanation tied to the retrieved chunk and observed mistake",async()=>{
    const result=await new DeterministicGroundedRemediator().generate(input);
    expect(result.explanation).toContain("cwnd");
    expect(result.commonMistake).toContain("Did not describe cwnd");
    expect(result.whyThis).toBe(input.whyThis);
    expect(result.unsupportedAspects).toEqual([]);
  });
  it("rejects invalid structured provider output",()=>expect(()=>parseGroundedRemediation("{\"title\":\"x\"}")).toThrow("failed validation"));
  it("fails safely when the retrieved context has no usable statements",async()=>{
    await expect(new DeterministicGroundedRemediator().generate({...input,sources:[{...input.sources[0],text:"short"}]})).rejects.toThrow("did not contain a usable statement");
  });
});
