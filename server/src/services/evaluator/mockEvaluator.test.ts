import { describe, expect, it } from "vitest";
import { MockEvaluator } from "./mockEvaluator.js";

describe("deterministic local concept extraction", () => {
  const evaluator = new MockEvaluator();

  it("does not synthesize a concept from an empty source", async () => {
    await expect(evaluator.extractConcepts({ title: "Caching", rawMaterial: "" })).resolves.toEqual([]);
  });

  it("derives extracted points from supplied text, not a URL", async () => {
    const text = "Cache invalidation removes or refreshes entries after the underlying data changes. Applications can use time-to-live expiry to bound how long stale values remain available.";
    const concepts = await evaluator.extractConcepts({ title: "Caching", rawMaterial: text });
    expect(concepts[0].requiredKnowledgePoints.join(" ")).toContain("underlying data changes");
    expect(concepts[0].name).not.toMatch(/^https?:/i);
  });

  it("removes a single Markdown heading before naming its extracted concept", async () => {
    const concepts = await evaluator.extractConcepts({
      title: "HTTP caching",
      rawMaterial: "# HTTP caching.\n\nCan distinguish freshness from validation.",
    });
    expect(concepts[0].name).toBe("HTTP caching");
    expect(concepts[0].requiredKnowledgePoints).toContain("Can distinguish freshness from validation.");
  });
});
