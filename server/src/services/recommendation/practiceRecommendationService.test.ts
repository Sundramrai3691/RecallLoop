import {describe,expect,it} from "vitest";
import {recommendNextAction} from "./practiceRecommendationService.js";

describe("deterministic next action",()=>{
  const base={conceptName:"Rate Limiting",mastery:.7,latestCoverage:.8,dimensions:{recognition:.9,recall:.85,explanation:.8,application:.4,depth:null,transfer:null},consecutiveFailures:0};
  it("recommends application practice when application lags recall",()=>{const result=recommendNextAction(base);expect(result.actionType).toBe("practice");expect(result.reason).toContain("weaker than recall");});
  it("recommends remediation for a repeated missing point",()=>{expect(recommendNextAction({...base,latestCoverage:.4,repeatedMissingPoint:"ack timing",repeatedMissingCount:3}).actionType).toBe("remediation");});
  it("does not claim a dimension gap without evidence",()=>{const result=recommendNextAction({...base,dimensions:{recognition:.9,recall:null,explanation:.8,application:null,depth:null,transfer:null}});expect(result.reason).not.toContain("Recall performance");});
});
