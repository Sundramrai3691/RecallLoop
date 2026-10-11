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
      .toEqual({ title: "Cache invalidation", sourceUrl: "https://docs.example.test/cache", rawMaterial: "A cache entry becomes stale when the underlying data changes." });
  });

  it("rejects malformed source links", () => {
    expect(() => validateStudySessionInput({ title: "Cache invalidation", sourceUrl: "javascript:alert(1)", rawMaterial: "Notes" }))
      .toThrow("valid http(s) source link");
  });
});
