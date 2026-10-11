import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import { OpenAiCompatibleProvider } from "./openaiCompatibleProvider.js";

describe("OpenAI-compatible chat provider", () => {
  const original = { llmBaseUrl: env.llmBaseUrl, llmModel: env.llmModel, llmApiKey: env.llmApiKey };

  afterEach(() => {
    vi.useRealTimers();
    env.llmBaseUrl = original.llmBaseUrl;
    env.llmModel = original.llmModel;
    env.llmApiKey = original.llmApiKey;
    vi.unstubAllGlobals();
  });

  it("uses the configured base URL, bearer authentication, model and OpenAI chat response shape", async () => {
    env.llmBaseUrl = "https://provider.example/v1beta/openai///";
    env.llmModel = "gemini-test-model";
    env.llmApiKey = "test-only-key";
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ choices: [{ message: { content: "{\"ok\":true}" } }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new OpenAiCompatibleProvider().complete([{ role: "user", content: "test" }], { json: true });

    expect(result).toBe('{"ok":true}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://provider.example/v1beta/openai/chat/completions");
    expect(new Headers(init?.headers).get("authorization")?.startsWith("Bearer ")).toBe(true);
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("gemini-test-model");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("leaves Gemini 3 sampling at its provider default", async () => {
    env.llmBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
    env.llmModel = "gemini-3.8-flash";
    env.llmApiKey = "test-only-key";
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: "{}" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await new OpenAiCompatibleProvider().complete([{ role: "user", content: "test" }], { temperature: 0, json: true });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(Object.hasOwn(body, "temperature")).toBe(false);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it.each([
    [401, "LLM_AUTHENTICATION_FAILED", /authentication failed/],
    [403, "LLM_ACCESS_DENIED", /denied access/],
    [429, "LLM_RATE_LIMITED", /temporarily rate-limited/],
    [503, "LLM_PROVIDER_FAILURE", /provider failed/],
    [400, "LLM_REQUEST_REJECTED", /rejected the request/],
  ])("surfaces provider HTTP %i as a specific safe error", async (status, code, message) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: Number(status) })));
    const error = await new OpenAiCompatibleProvider().complete([{ role: "user", content: "test" }]).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    expect((error as Error).message).toMatch(message);
    expect((error as Error).message).not.toContain(env.llmApiKey);
  });

  it("rejects malformed and unexpected chat response bodies without exposing them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { content: null } }] })));
    const error = await new OpenAiCompatibleProvider().complete([{ role: "user", content: "test" }]).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("LLM_INVALID_RESPONSE");
    expect((error as Error).message).not.toContain(env.llmApiKey);
  });

  it("classifies quota exhaustion from a structured provider response without exposing its body", async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: { code: "insufficient_quota", message: "account secret details" } }, { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const error = await new OpenAiCompatibleProvider().complete([{ role: "user", content: "test" }]).catch((value: unknown) => value);
    expect(error).toMatchObject({ status: 503, code: "LLM_QUOTA_EXHAUSTED" });
    expect((error as Error).message).not.toContain("account secret details");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("respects Retry-After and does not block the request for a long upstream delay", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), { status: 429, headers: { "Retry-After": "45" } }));
    vi.stubGlobal("fetch", fetchMock);
    const error = await new OpenAiCompatibleProvider().complete([{ role: "user", content: "test" }]).catch((value: unknown) => value);
    expect(error).toMatchObject({ status: 429, code: "LLM_RATE_LIMITED", retryable: true, retryAfterSeconds: 45 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not treat an ambiguous RESOURCE_EXHAUSTED code as proof that quota is exhausted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), { status: 429, headers: { "Retry-After": "60" } })));
    const error = await new OpenAiCompatibleProvider().complete([{ role: "user", content: "test" }]).catch((value: unknown) => value);
    expect(error).toMatchObject({ status: 429, code: "LLM_RATE_LIMITED", retryAfterSeconds: 60 });
  });

  it("makes one bounded retry for a transient limit and returns success if it clears", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), { status: 429, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const promise = new OpenAiCompatibleProvider().complete([{ role: "user", content: "test" }]);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
