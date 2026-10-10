import { describe, expect, it } from "vitest";
import { displayResourceTitle } from "./resourceTitle.js";

describe("resource title presentation", () => {
  it("preserves trusted titles and leaves the original URL untouched for callers", () => {
    const url = "https://example.test/watch?v=abc";
    expect(displayResourceTitle("Concurrency explained", "Example", url)).toBe("Concurrency explained");
  });

  it("replaces a YouTube URL used as a title with a safe source-based label", () => {
    const url = "https://www.youtube.com/watch?v=abc";
    expect(displayResourceTitle(url, "YouTube", url)).toBe("YouTube video");
  });

  it("uses provider attribution when a raw link has no known title format", () => {
    const url = "https://example.test/resource/123";
    expect(displayResourceTitle(url, "Example", url)).toBe("Example resource");
  });
});
