export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompleteOptions {
  temperature?: number;
  json?: boolean;
}

export interface LlmProvider {
  name: string;
  complete(messages: LlmMessage[], options?: LlmCompleteOptions): Promise<string>;
}
