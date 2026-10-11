import { AppError } from "../../utils/errors.js";

type Provider = "LLM" | "Embedding";
type ProviderErrorBody = { error?: { code?: unknown; type?: unknown; status?: unknown; message?: unknown } };

function errorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const error = (body as ProviderErrorBody).error;
  if (!error || typeof error !== "object") return undefined;
  for (const value of [error.code, error.type, error.status]) {
    if (typeof value === "string" && /^[a-z0-9_.-]{1,80}$/i.test(value)) return value;
  }
  return undefined;
}

function errorMessage(body: unknown): string {
  const error = (body as ProviderErrorBody | null)?.error;
  return error && typeof error.message === "string" ? error.message.toLowerCase() : "";
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value.trim());
  const millis = Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1000
    : Date.parse(value) - now;
  if (!Number.isFinite(millis) || millis < 0) return undefined;
  return Math.ceil(millis / 1000);
}

export function providerHttpError(provider: Provider, status: number, body?: unknown, retryAfterSeconds?: number) {
  const prefix = provider === "LLM" ? "LLM" : "EMBEDDING";
  const upstreamCode = errorCode(body);
  const message = errorMessage(body);
  const quota = status === 429 && (/quota|billing|payment/.test(`${upstreamCode ?? ""} ${message}`));
  if (status === 401) return new AppError(`${provider} provider authentication failed (HTTP 401). Check the configured API key.`, 503, `${prefix}_AUTHENTICATION_FAILED`);
  if (status === 403) return new AppError(`${provider} provider denied access (HTTP 403). Check model access and project permissions.`, 503, `${prefix}_ACCESS_DENIED`);
  if (quota) return new AppError(`${provider} provider quota or billing limit is exhausted. The operation was not completed.`, 503, `${prefix}_QUOTA_EXHAUSTED`);
  if (status === 429) return new AppError(`${provider} provider is temporarily rate-limited. Retry after the indicated delay.`, 429, `${prefix}_RATE_LIMITED`, { retryable: true, retryAfterSeconds });
  if (status >= 500) return new AppError(`${provider} provider failed (HTTP ${status}). Retry after the provider recovers.`, 503, `${prefix}_PROVIDER_FAILURE`, { retryable: true, retryAfterSeconds });
  return new AppError(`${provider} provider rejected the request (HTTP ${status}). Check the model and request configuration.`, 503, `${prefix}_REQUEST_REJECTED`);
}

/** Provider bodies are parsed only for bounded, allowlisted classification fields; never log/return raw bodies. */
export async function readProviderError(response: Response, provider: Provider): Promise<AppError> {
  let body: unknown;
  try { body = await response.json(); } catch { body = undefined; }
  return providerHttpError(provider, response.status, body, parseRetryAfter(response.headers.get("retry-after")));
}
