import { describe, expect, it } from "vitest";
import { buildResourceReasons } from "./resourceRecommendationService.js";

describe("resource recommendation explanations", () => {
  it("uses catalog relationships and labels duration as an estimate without unsupported metadata claims", () => {
    const text = buildResourceReasons({ conceptName: "Cache invalidation", goalRelevant: false, mastery: null, difficulty: 3, appGap: false, availableMinutes: 45, estimatedMinutes: 15 }).map((reason) => reason.text).join(" ");
    expect(text).toContain("catalog links this source to Cache invalidation");
    expect(text).toContain("time estimate (~15 min)");
    expect(text).not.toMatch(/\d+% coverage|trust tier|freshness/i);
  });
});
