import { describe, expect, it } from "vitest";
import { validateStudySessionInput } from "./studySessionService.js";

describe("study topic and source identity", () => {
  it("rejects a video URL as the topic with a correction path", () => {
    expect(() => validateStudySessionInput({ title: "https://youtube.com/watch?v=abc", rawMaterial: "some notes" }))
      .toThrow("Enter a topic name here, not a URL");
  });

  it("requires supplied text and does not treat the URL itself as extracted content", () => {
    expect(() => validateStudySessionInput({ title: "Cache invalidation", rawMaterial: "https://example.test/article" }))
      .toThrow("does not fetch webpage or video contents");
  });

  it("keeps the topic, source link, and supplied text as separate values", () => {
    expect(validateStudySessionInput({ title: "Cache invalidation", sourceUrl: " https://docs.example.test/cache ", rawMaterial: "A cache entry becomes stale when the underlying data changes." }))
      .toEqual({ title: "Cache invalidation", sourceUrl: "https://docs.example.test/cache", rawMaterial: "A cache entry becomes stale when the underlying data changes.", canonicalTopicId:null, canonicalConceptId:null });
  });

  it("rejects malformed source links", () => {
    expect(() => validateStudySessionInput({ title: "Cache invalidation", sourceUrl: "javascript:alert(1)", rawMaterial: "Notes" }))
      .toThrow("valid http(s) source link");
  });

  it("keeps custom topics unmapped unless canonical IDs are explicitly selected", () => {
    expect(validateStudySessionInput({ title:"My queue notes", rawMaterial:"A queue stores messages until a consumer receives them." }))
      .toMatchObject({canonicalTopicId:null,canonicalConceptId:null});
  });

  it("accepts explicit canonical IDs and rejects malformed or incomplete relationships", () => {
    expect(validateStudySessionInput({ title:"HTTP", rawMaterial:"HTTP requests include a method and target.", canonicalTopicId:"123e4567-e89b-42d3-a456-426614174000", canonicalConceptId:"123e4567-e89b-42d3-a456-426614174001" }))
      .toMatchObject({canonicalTopicId:"123e4567-e89b-42d3-a456-426614174000",canonicalConceptId:"123e4567-e89b-42d3-a456-426614174001"});
    expect(() => validateStudySessionInput({title:"HTTP",rawMaterial:"notes",canonicalConceptId:"123e4567-e89b-42d3-a456-426614174001"})).toThrow("must include its parent topic");
    expect(() => validateStudySessionInput({title:"HTTP",rawMaterial:"notes",canonicalTopicId:"not-a-uuid"})).toThrow("topic ID is invalid");
  });
});
