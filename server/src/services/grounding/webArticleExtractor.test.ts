import { describe, expect, it, vi } from "vitest";
import { extractHtmlArticle, fetchPublicArticle, validatePublicArticleUrl } from "./webArticleExtractor.js";

const publicLookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }]);
const html = `<!doctype html><html><head><title>PostgreSQL Indexes</title></head><body><nav>Navigation boilerplate</nav><main><h1>Indexes</h1><p>${"An index can improve retrieval by avoiding a full table scan. ".repeat(4)}</p><script>ignore secret</script><h2>Trade-offs</h2><p>${"Indexes require additional storage and maintenance during writes. ".repeat(2)}</p></main></body></html>`;

describe("public web article extraction", () => {
  it("rejects private, local, credentialed, non-HTTP, and non-standard-port destinations", async () => {
    await expect(validatePublicArticleUrl("http://127.0.0.1/article", publicLookup)).rejects.toMatchObject({ code: "RESOURCE_URL_BLOCKED" });
    await expect(validatePublicArticleUrl("http://10.1.2.3/article", publicLookup)).rejects.toMatchObject({ code: "RESOURCE_URL_BLOCKED" });
    await expect(validatePublicArticleUrl("http://localhost/article", publicLookup)).rejects.toMatchObject({ code: "RESOURCE_URL_BLOCKED" });
    await expect(validatePublicArticleUrl("https://user:secret@example.com/article", publicLookup)).rejects.toMatchObject({ code: "RESOURCE_URL_INVALID" });
    await expect(validatePublicArticleUrl("file:///C:/secret", publicLookup)).rejects.toMatchObject({ code: "RESOURCE_URL_INVALID" });
    await expect(validatePublicArticleUrl("https://example.com:8443/article", publicLookup)).rejects.toMatchObject({ code: "RESOURCE_URL_INVALID" });
  });

  it("blocks a host when any DNS answer is private", async () => {
    const resolve = vi.fn(async () => [{ address: "93.184.216.34", family: 4 as const }, { address: "192.168.1.2", family: 4 as const }]);
    await expect(validatePublicArticleUrl("https://example.com/", resolve)).rejects.toMatchObject({ code: "RESOURCE_URL_BLOCKED" });
  });

  it("allows a public IPv4 pin when the same public host also advertises IPv6", async () => {
    const resolve = vi.fn(async () => [{ address: "2001:db8::10", family: 6 as const }, { address: "93.184.216.34", family: 4 as const }]);
    await expect(validatePublicArticleUrl("https://example.com/", resolve)).resolves.toMatchObject({ hostname: "example.com" });
  });

  it("extracts readable main/article content, title, and section headings while dropping navigation and scripts", () => {
    const result = extractHtmlArticle(html, "https://example.com/post");
    expect(result.title).toBe("PostgreSQL Indexes");
    expect(result.text).toContain("An index can improve retrieval");
    expect(result.text).not.toContain("Navigation boilerplate");
    expect(result.text).not.toContain("ignore secret");
    expect(result.sections).toEqual(["Indexes", "Trade-offs"]);
  });

  it("revalidates every redirect destination before fetching it", async () => {
    const validate = vi.fn(async (raw: string) => {
      if (raw.includes("private")) throw Object.assign(new Error("blocked"), { code: "RESOURCE_URL_BLOCKED" });
      return new URL(raw);
    });
    const fetchPage = vi.fn().mockResolvedValueOnce({ status: 302, location: "http://private.local/", contentType: "", body: Buffer.alloc(0) });
    await expect(fetchPublicArticle("https://public.example/article", validate as never, fetchPage)).rejects.toMatchObject({ code: "RESOURCE_URL_BLOCKED" });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("rejects oversized/non-HTML and content-thin pages with an actionable status", async () => {
    const validate = async (raw: string) => new URL(raw);
    await expect(fetchPublicArticle("https://example.com/file.pdf", validate, async () => ({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF") }))).rejects.toMatchObject({ code: "RESOURCE_TYPE_UNSUPPORTED" });
    await expect(fetchPublicArticle("https://example.com/empty", validate, async () => ({ status: 200, contentType: "text/html", body: Buffer.from("<html><body>tiny</body></html>") }))).rejects.toMatchObject({ code: "RESOURCE_CONTENT_UNAVAILABLE" });
  });
});
