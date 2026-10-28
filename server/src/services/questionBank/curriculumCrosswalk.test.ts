import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Registry = { sources: Array<{ id: string }> };
type Crosswalk = {
  schemaVersion: number;
  sourceRegistry: string;
  crosswalk: Array<{ concept: { id: string }; knowledgePoint: { id: string } | null }>;
  curriculumAreas: Array<{ id: string; existingConceptIds: string[]; existingKnowledgePointIds: string[]; disposition: string }>;
  pilot: {
    points: Array<{
      id: string;
      canonicalKnowledgePointId: string;
      sourceIds: string[];
      candidateSourceIds?: string[];
      eligibleCurrentRevisionCount: number;
      revisionIds: string[];
      revisionContentHashes: string[];
      expectedAnswerCriteria: string[];
      targetRoles: string[];
      distinctVerificationCriteria: string;
      semanticQuestionAlignment: string;
      answerRubricStatus: string;
      verification: string;
    }>;
    questionRevisions: Array<{
      canonicalKnowledgePointId: string;
      revisionId: string;
      contentHash: string;
      questionType: string;
      exactAutomatedApproval: boolean;
      authoredHashMatches: boolean;
      publicationStatus: string;
      reviewStatus: string;
      qualityStatus: string;
    }>;
    limitations: string[];
  };
};

async function loadArtifact<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(path.resolve(process.cwd(), "../docs/research", filename), "utf8")) as T;
}

describe("consolidated curriculum artifacts", () => {
  it("links the bounded pilot to unique existing knowledge points and registered sources", async () => {
    const [crosswalk, registry] = await Promise.all([
      loadArtifact<Crosswalk>("curriculum_crosswalk.json"),
      loadArtifact<Registry>("source_registry.json"),
    ]);
    const catalogPointIds = new Set(crosswalk.crosswalk.flatMap((entry) => entry.knowledgePoint ? [entry.knowledgePoint.id] : []));
    const sourceIds = new Set(registry.sources.map((source) => source.id));
    const pilotIds = crosswalk.pilot.points.map((point) => point.id);
    const revisionIds = crosswalk.pilot.questionRevisions.map((revision) => revision.revisionId);

    expect(crosswalk.schemaVersion).toBe(1);
    expect(crosswalk.sourceRegistry).toBe("source_registry.json");
    expect(crosswalk.crosswalk.length).toBeGreaterThan(0);
    expect(crosswalk.pilot.points).toHaveLength(8);
    expect(crosswalk.pilot.questionRevisions).toHaveLength(48);
    expect(new Set(revisionIds).size).toBe(48);
    expect(new Set(pilotIds).size).toBe(pilotIds.length);
    expect(new Set(crosswalk.pilot.points.map((point) => point.canonicalKnowledgePointId)).size).toBe(8);
    for (const point of crosswalk.pilot.points) {
      expect(catalogPointIds.has(point.canonicalKnowledgePointId)).toBe(true);
      expect(point.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of point.sourceIds) expect(sourceIds.has(sourceId)).toBe(true);
      for (const sourceId of point.candidateSourceIds ?? []) expect(sourceIds.has(sourceId)).toBe(true);
      expect(point.eligibleCurrentRevisionCount).toBe(6);
      expect(point.revisionIds).toHaveLength(6);
      expect(point.revisionContentHashes.every((hash) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
      expect(point.expectedAnswerCriteria.length).toBeGreaterThan(0);
      expect(point.targetRoles.length).toBeGreaterThan(0);
      expect(point.distinctVerificationCriteria.length).toBeGreaterThan(0);
      expect(point.semanticQuestionAlignment).toMatch(/review .* remains open/i);
      expect(point.answerRubricStatus).toMatch(/not independently re-evaluated/i);
      expect(point.verification).toMatch(/not independent human validation/i);
      const revisions = crosswalk.pilot.questionRevisions.filter((revision) => revision.canonicalKnowledgePointId === point.canonicalKnowledgePointId);
      expect(revisions).toHaveLength(6);
      expect(revisions.every((revision) => revision.exactAutomatedApproval && revision.authoredHashMatches && revision.publicationStatus === "published" && revision.reviewStatus === "automated_reviewed" && revision.qualityStatus === "valid")).toBe(true);
      expect(revisions.filter((revision) => revision.questionType === "mcq")).toHaveLength(2);
      expect(revisions.filter((revision) => revision.questionType === "rapid_recall")).toHaveLength(3);
      expect(revisions.filter((revision) => revision.questionType === "short_explanation")).toHaveLength(1);
    }
    for (const area of crosswalk.curriculumAreas) {
      expect(area.existingConceptIds.every((id) => crosswalk.crosswalk.some((entry) => entry.concept.id === id))).toBe(true);
      expect(area.existingKnowledgePointIds.every((id) => catalogPointIds.has(id))).toBe(true);
      if (area.existingConceptIds.length === 0) expect(area.disposition).toMatch(/^new_canonical_area/);
    }
    expect(crosswalk.pilot.limitations.some((limitation) => /no .*prerequisite edges/i.test(limitation))).toBe(true);
  });
});
