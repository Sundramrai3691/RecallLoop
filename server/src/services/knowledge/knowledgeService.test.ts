import { describe, expect, it } from "vitest";
import { roadmapStatus, rollupRoadmapStatus } from "./knowledgeService.js";

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
