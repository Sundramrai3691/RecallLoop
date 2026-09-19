import { isMockLlm } from "../../config/env.js";
import { MockLlmProvider } from "./mockProvider.js";
import { OpenAiCompatibleProvider } from "./openaiCompatibleProvider.js";
import type { LlmProvider } from "./types.js";

export function createLlmProvider(): LlmProvider {
  if (isMockLlm()) {
    return new MockLlmProvider();
  }
  return new OpenAiCompatibleProvider();
}
