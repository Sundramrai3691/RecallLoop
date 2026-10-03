import { describe, expect, it } from "vitest";
import { assessmentBlueprint, buildQuestion, evaluateMcq, evidenceWeight, nextHint, selectAssessment } from "./questionService.js";

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
});
