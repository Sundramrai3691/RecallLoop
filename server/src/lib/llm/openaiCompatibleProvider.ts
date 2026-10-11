import { unavailable } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import type { LlmCompleteOptions, LlmMessage, LlmProvider } from "./types.js";
import { providerHttpError } from "./providerErrors.js";

export class OpenAiCompatibleProvider implements LlmProvider {
  name = "openai-compatible";

  async complete(messages: LlmMessage[], options?: LlmCompleteOptions): Promise<string> {
    const url = `${env.llmBaseUrl.replace(/\/+$/, "")}/chat/completions`;
    const gemini3Model = env.llmModel.toLowerCase().startsWith("gemini-3");
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
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
        throw unavailable("LLM provider request timed out after 30 seconds", "LLM_TIMEOUT");
      }
      throw unavailable("LLM provider is unreachable", "LLM_UNAVAILABLE");
    }

    if (!response.ok) throw providerHttpError("LLM", response.status);

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
