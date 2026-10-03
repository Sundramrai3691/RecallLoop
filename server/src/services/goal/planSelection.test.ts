import { describe, expect, it } from "vitest";
import { fitTasksToBudget } from "./planSelection.js";

describe("planner task selection", () => {
  it("keeps the ordered learning sequence within the available minutes", () => {
    const result = fitTasksToBudget([
      { taskType:"practice",priority:70,estimatedMinutes:25,sequenceOrder:3 },
      { taskType:"recall",priority:100,estimatedMinutes:10,sequenceOrder:1,recallAttemptId:"due" },
      { taskType:"learn",priority:80,estimatedMinutes:20,sequenceOrder:2 },
    ],30,"goal");
    expect(result.tasks.map((item) => item.taskType)).toEqual(["recall","learn"]);
    expect(result.plannedMinutes).toBe(30);
    expect(result.remainingMinutes).toBe(0);
  });
  it("does not repeat a recall or exceed the budget", () => {
    const result = fitTasksToBudget([
      { taskType:"recall",priority:100,estimatedMinutes:10,sequenceOrder:1,recallAttemptId:"same" },
      { taskType:"recall",priority:99,estimatedMinutes:10,sequenceOrder:2,recallAttemptId:"same" },
      { taskType:"practice",priority:80,estimatedMinutes:15,sequenceOrder:3 },
    ],20,"goal");
    expect(result.tasks).toHaveLength(1);
    expect(result.plannedMinutes).toBeLessThanOrEqual(20);
  });
});
