import { AppError, unavailable } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import type { LlmCompleteOptions, LlmMessage, LlmProvider } from "./types.js";
import { readProviderError } from "./providerErrors.js";

const MAX_INLINE_RETRY_MS = 1_000;
const REQUEST_TIMEOUT_MS = 30_000;

function boundedRetryDelay(error: AppError): number | null {
  if (!error.retryable) return null;
  if (error.retryAfterSeconds !== undefined) {
    const delay = error.retryAfterSeconds * 1_000;
    return delay <= MAX_INLINE_RETRY_MS ? delay : null;
  }
  return 100 + Math.floor(Math.random() * 201);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class OpenAiCompatibleProvider implements LlmProvider {
  name = "openai-compatible";

  async complete(messages: LlmMessage[], options?: LlmCompleteOptions): Promise<string> {
    const url = `${env.llmBaseUrl.replace(/\/+$/, "")}/chat/completions`;
    const gemini3Model = env.llmModel.toLowerCase().startsWith("gemini-3");
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(url, {
          method: "POST",
          signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.llmApiKey.trim()}`,
          },
          body: JSON.stringify({
            model: env.llmModel,
            ...(gemini3Model ? {} : { temperature: options?.temperature ?? 0 }),
            messages,
            ...(options?.json ? { response_format: { type: "json_object" } } : {}),
          }),
        });
      } catch (error) {
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
          throw unavailable("LLM provider request exceeded its 30-second total time limit", "LLM_TIMEOUT");
        }
        throw unavailable("LLM provider is unreachable", "LLM_UNAVAILABLE");
      }
      if (response.ok) break;
      const providerError = await readProviderError(response, "LLM");
      const delay = attempt === 0 ? boundedRetryDelay(providerError) : null;
      if (delay === null) throw providerError;
      await wait(delay);
    }

    if (!response?.ok) throw unavailable("LLM provider request failed", "LLM_PROVIDER_FAILURE");

    let payload: { choices?: { message?: { content?: unknown } }[] };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw unavailable("LLM provider returned a non-JSON response", "LLM_INVALID_RESPONSE");
    }
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw unavailable("LLM provider response did not contain choices[0].message.content as nonempty text", "LLM_INVALID_RESPONSE");
    }
    return content;
  }
}
