import type { LlmCompleteOptions, LlmMessage, LlmProvider } from "./types.js";

const SAMPLE_CONCEPTS = `{
  "concepts": [
    {
      "name": "Cache Aside Pattern",
      "description": "The application treats the cache as a lookup layer beside the database: read cache first, load from the database on miss, then write the result back to cache.",
      "requiredKnowledgePoints": [
        "Application checks the cache first",
        "Cache miss causes database lookup",
        "Fetched result is returned to the application",
        "Fetched result is written into cache"
      ],
      "difficulty": 3
    }
  ]
}`;

export class MockLlmProvider implements LlmProvider {
  name = "mock";

  async complete(messages: LlmMessage[], _options?: LlmCompleteOptions): Promise<string> {
    const last = messages[messages.length - 1]?.content ?? "";
    if (/extract concepts/i.test(last) || /"concepts"/i.test(last) === false && /topic/i.test(last)) {
      return SAMPLE_CONCEPTS;
    }
    return SAMPLE_CONCEPTS;
  }
}
