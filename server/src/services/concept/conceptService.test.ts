import { describe, expect, it, vi } from "vitest";
import { prepareConcepts } from "./conceptService.js";
import type { Evaluator } from "../evaluator/types.js";

function evaluatorReturning(concepts: Awaited<ReturnType<Evaluator["extractConcepts"]>>): Pick<Evaluator, "extractConcepts"> {
  return { extractConcepts: vi.fn().mockResolvedValue(concepts) };
}

describe("study concept content integrity", () => {
  it("removes source links before extraction and keeps evidence text", async () => {
    const evaluator = evaluatorReturning([{ name: "Cache invalidation", description: "Cache entries become stale when values change.", requiredKnowledgePoints: ["Entries need invalidation after the backing value changes."], difficulty: 3 }]);

    await prepareConcepts({ title: "Cache invalidation", rawMaterial: "Cache entries become stale. Read https://docs.example.test/cache for more. www.example.test/more" }, evaluator);

    const extractedInput = vi.mocked(evaluator.extractConcepts).mock.calls[0]?.[0];
    expect(extractedInput?.rawMaterial).toContain("Cache entries become stale.");
    expect(extractedInput?.rawMaterial).not.toMatch(/https?:\/\/|www\./i);
  });

  it.each([
    { name: "https://video.example.test/watch", description: "A concept", requiredKnowledgePoints: ["A valid point"] },
    { name: "A concept", description: "See https://docs.example.test", requiredKnowledgePoints: ["A valid point"] },
    { name: "A concept", description: "A valid description", requiredKnowledgePoints: ["Open www.example.test/page"] },
  ])("rejects provider output containing a URL in learner-facing content", async (concept) => {
    await expect(prepareConcepts({ title: "Caching", rawMaterial: "Cache entries become stale after values change." }, evaluatorReturning([concept])))
      .rejects.toMatchObject({ code: "INVALID_EXTRACTED_CONTENT", status: 502 });
  });
});
