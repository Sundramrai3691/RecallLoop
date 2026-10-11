import { createHash } from "node:crypto";
import { env } from "../../config/env.js";
import { unavailable } from "../../utils/errors.js";
import { providerHttpError } from "../../lib/llm/providerErrors.js";

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
      response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/embeddings`, { method: "POST", signal: AbortSignal.timeout(30_000), headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey.trim()}` }, body: JSON.stringify({ model: this.model, input: texts }) });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw unavailable("Embedding provider request timed out after 30 seconds", "EMBEDDING_TIMEOUT");
      throw unavailable("Embedding provider is unreachable", "EMBEDDING_UNAVAILABLE");
    }
    if (!response.ok) throw providerHttpError("Embedding", response.status);
    let payload: { data?: Array<{ index?: number; embedding: number[] }> };
    try { payload = await response.json() as typeof payload; }
    catch { throw unavailable("Embedding provider returned a non-JSON response", "EMBEDDING_INVALID_RESPONSE"); }
    const rows = payload.data;
    if (!rows || rows.length !== texts.length || rows.some((row) => !row || !Array.isArray(row.embedding) || !row.embedding.length || row.embedding.some((n) => !Number.isFinite(n)))) throw unavailable("Embedding provider returned invalid vectors", "EMBEDDING_INVALID_RESPONSE");
    const indexed = rows.every((row) => Number.isInteger(row.index) && row.index! >= 0 && row.index! < texts.length) && new Set(rows.map((row) => row.index)).size === texts.length;
    const unindexed = rows.every((row) => row.index === undefined);
    if (!indexed && !unindexed) throw unavailable("Embedding provider returned invalid vector indices", "EMBEDDING_INVALID_RESPONSE");
    const dimensions = rows[0].embedding.length;
    if (rows.some((row) => row.embedding.length !== dimensions)) throw unavailable("Embedding provider returned inconsistent vector dimensions", "EMBEDDING_INVALID_RESPONSE");
    return (indexed ? [...rows].sort((a, b) => a.index! - b.index!) : rows).map((row) => row.embedding);
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  if (env.embeddingProvider === "mock") return new DeterministicEmbeddingProvider();
  if (env.embeddingProvider === "openai-compatible") {
    if (!env.embeddingApiKey.trim() || !env.embeddingModel.trim() || !env.embeddingBaseUrl.trim()) throw unavailable("EMBEDDING_PROVIDER=openai-compatible requires EMBEDDING_API_KEY, EMBEDDING_MODEL, and EMBEDDING_BASE_URL.", "EMBEDDING_NOT_CONFIGURED");
    return new OpenAiCompatibleEmbeddingProvider(env.embeddingBaseUrl, env.embeddingModel, env.embeddingApiKey);
  }
  throw unavailable(`Unsupported EMBEDDING_PROVIDER=${env.embeddingProvider}. Use mock or openai-compatible.`, "EMBEDDING_PROVIDER_UNSUPPORTED");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0, an = 0, bn = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; an += a[i] * a[i]; bn += b[i] * b[i]; }
  return an && bn ? dot / Math.sqrt(an * bn) : 0;
}
