import { describe, expect, it } from "vitest";
import { roadmapStatus, rollupRoadmapStatus, uniqueKnowledgePointsById } from "./knowledgeService.js";

describe("roadmap evidence status", () => {
  it("keeps unassessed concepts unassessed, including completed study sessions", () => {
    expect(roadmapStatus(false,false)).toBe("not_started");
    expect(roadmapStatus(true,false)).toBe("studied");
  });

  it("shows evidence only after an assessment result exists", () => {
    expect(roadmapStatus(false,true)).toBe("assessed");
    expect(rollupRoadmapStatus(["not_started","studied"])).toBe("studied");
    expect(rollupRoadmapStatus(["studied","assessed"])).toBe("assessed");
  });
});

describe("canonical roadmap point identity",()=>{
  it("collapses repeated query rows by canonical ID without merging distinct records by display text",()=>{
    const point={id:"canonical-point-a",statement:"Freshness differs from validation."};
    expect(uniqueKnowledgePointsById([point,{...point},{id:"canonical-point-b",statement:point.statement}])).toEqual([point,{id:"canonical-point-b",statement:point.statement}]);
  });
});
