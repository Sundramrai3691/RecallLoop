import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { unavailable } from "../../utils/errors.js";

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number | null;
  embed(texts: string[]): Promise<number[][]>;
}

const TOKEN = /[a-z0-9_+-]{2,}/gi;
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly name = "hash-token-v1";
  constructor(readonly dimensions = 64) {}
  async embed(texts: string[]) {
    return texts.map((text) => {
      const vector = Array(this.dimensions).fill(0) as number[];
      const tokens = text.toLowerCase().match(TOKEN) ?? [];
      for (const token of tokens) {
        const digest = createHash("sha256").update(token).digest();
        const index = digest.readUInt32BE(0) % this.dimensions;
        vector[index] += digest[4] % 2 ? 1 : -1;
      }
      const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
      return norm ? vector.map((value) => value / norm) : vector;
    });
  }
}

export class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number | null = null;
  constructor(private readonly baseUrl: string, private readonly model: string, private readonly apiKey: string) { this.name = `${model}`; }
  async embed(texts: string[]): Promise<number[][]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/embeddings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, input: texts }) });
    } catch { throw unavailable("Embedding provider is unreachable", "EMBEDDING_UNAVAILABLE"); }
    if (!response.ok) throw unavailable(`Embedding provider returned HTTP ${response.status}`, "EMBEDDING_UNAVAILABLE");
    const payload = await response.json() as { data?: Array<{ index: number; embedding: number[] }> };
    const rows = payload.data;
    if (!rows || rows.length !== texts.length || rows.some((row) => !Array.isArray(row.embedding) || row.embedding.some((n) => !Number.isFinite(n)))) throw unavailable("Embedding provider returned invalid vectors", "EMBEDDING_INVALID_RESPONSE");
    return [...rows].sort((a, b) => a.index - b.index).map((row) => row.embedding);
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  if (env.embeddingProvider === "openai-compatible") {
    if (!env.embeddingApiKey || !env.embeddingModel || !env.embeddingBaseUrl) throw unavailable("Embedding provider is configured but its required environment variables are missing", "EMBEDDING_NOT_CONFIGURED");
    return new OpenAiCompatibleEmbeddingProvider(env.embeddingBaseUrl, env.embeddingModel, env.embeddingApiKey);
  }
  return new DeterministicEmbeddingProvider();
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0, an = 0, bn = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; an += a[i] * a[i]; bn += b[i] * b[i]; }
  return an && bn ? dot / Math.sqrt(an * bn) : 0;
}
