import { unavailable } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import type { LlmCompleteOptions, LlmMessage, LlmProvider } from "./types.js";

export class OpenAiCompatibleProvider implements LlmProvider {
  name = "openai-compatible";

  async complete(messages: LlmMessage[], options?: LlmCompleteOptions): Promise<string> {
    const url = `${env.llmBaseUrl.replace(/\/$/, "")}/chat/completions`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.llmApiKey}`,
        },
        body: JSON.stringify({
          model: env.llmModel,
          temperature: options?.temperature ?? 0,
          messages,
          ...(options?.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
    } catch {
      throw unavailable("LLM provider is unreachable", "LLM_UNAVAILABLE");
    }

    if (!response.ok) {
      throw unavailable(
        `LLM provider returned HTTP ${response.status}`,
        "LLM_UNAVAILABLE",
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw unavailable("LLM provider returned an empty response", "LLM_UNAVAILABLE");
    }
    return content;
  }
}
