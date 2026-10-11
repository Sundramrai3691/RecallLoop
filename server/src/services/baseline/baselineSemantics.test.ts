import { describe, expect, it } from "vitest";
import { summarizeBaselineEvidence } from "./baselineSemantics.js";

describe("baseline evidence semantics", () => {
  it("distinguishes no evidence, measured zero, and a single-answer early signal", () => {
    expect(summarizeBaselineEvidence([])).toMatchObject({ evidenceCount: 0, mastery: null, status: "Not assessed" });
    expect(summarizeBaselineEvidence([{ conceptId: "c1", knowledgePointId: "p1", knowledgePointResults: [{ point: "Atomicity", status: "missing" }] }]))
      .toMatchObject({ evidenceCount: 1, mastery: 0, status: "Early signal" });
    expect(summarizeBaselineEvidence([{ conceptId: "c1", knowledgePointId: "p1", knowledgePointResults: [{ point: "Atomicity", status: "correct" }] }]))
      .toMatchObject({ evidenceCount: 1, mastery: 1, status: "Early signal" });
  });

  it("counts canonical points once and uses the same unique outcomes for the band", () => {
    const result = summarizeBaselineEvidence([
      { conceptId: "c1", knowledgePointId: "p1", knowledgePointResults: [{ point: "Atomicity", status: "correct" }] },
      { conceptId: "c1", knowledgePointId: "p1", knowledgePointResults: [{ point: "Atomicity", status: "missing" }] },
      { conceptId: "c2", knowledgePointId: "p2", knowledgePointResults: [{ point: "Isolation", status: "missing" }] },
      { conceptId: "c3", knowledgePointId: "p3", knowledgePointResults: [{ point: "Durability", status: "missing" }] },
    ]);
    expect(result).toMatchObject({ evidenceCount: 3, mastery: 0, status: "Needs work" });
  });
});
