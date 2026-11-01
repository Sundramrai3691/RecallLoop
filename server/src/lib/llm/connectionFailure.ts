import { AppError } from "../../utils/errors.js";

export type ProviderConnectionCategory =
  | "dns_error" | "connection_refused" | "connection_timeout" | "tls_error"
  | "proxy_error" | "outbound_blocked" | "unknown_provider_error";

const KNOWN_CODES = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT",
  "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "EACCES", "EPERM", "ERR_PROXY_CONNECTION_FAILED", "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

function collectCodes(error: unknown): string[] {
  const found: string[] = [];
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  while (queue.length && found.length < 8) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const value = current as { code?: unknown; cause?: unknown; errors?: unknown };
    if (typeof value.code === "string" && KNOWN_CODES.has(value.code)) found.push(value.code);
    if (value.cause) queue.push(value.cause);
    if (Array.isArray(value.errors)) queue.push(...value.errors.slice(0, 8));
  }
  return found;
}

export function classifyProviderConnectionFailure(error: unknown): { category: ProviderConnectionCategory; networkCode: string | null } {
  const codes = collectCodes(error);
  const code = codes[0] ?? null;
  if (codes.some((item) => item === "EACCES" || item === "EPERM")) return { category: "outbound_blocked", networkCode: code };
  if (codes.some((item) => item === "ENOTFOUND" || item === "EAI_AGAIN")) return { category: "dns_error", networkCode: code };
  if (codes.includes("ECONNREFUSED")) return { category: "connection_refused", networkCode: code };
  if (codes.some((item) => item === "ETIMEDOUT" || item === "UND_ERR_CONNECT_TIMEOUT")) return { category: "connection_timeout", networkCode: code };
  if (codes.some((item) => item.startsWith("ERR_TLS") || item.startsWith("CERT_") || item.includes("CERTIFICATE"))) return { category: "tls_error", networkCode: code };
  if (codes.some((item) => item.startsWith("ERR_PROXY") || item.includes("TUNNEL"))) return { category: "proxy_error", networkCode: code };
  return { category: "unknown_provider_error", networkCode: code };
}

export function providerConnectionAppError(error: unknown): AppError {
  const failure = classifyProviderConnectionFailure(error);
  const code = failure.category === "outbound_blocked" ? "LLM_OUTBOUND_BLOCKED" :
    failure.category === "dns_error" ? "LLM_DNS_ERROR" :
    failure.category === "connection_refused" ? "LLM_CONNECTION_REFUSED" :
    failure.category === "connection_timeout" ? "LLM_CONNECTION_TIMEOUT" :
    failure.category === "tls_error" ? "LLM_TLS_ERROR" :
    failure.category === "proxy_error" ? "LLM_PROXY_ERROR" : "LLM_UNAVAILABLE";
  const message = failure.category === "outbound_blocked"
    ? "LLM provider connection was denied by the network environment."
    : "LLM provider connection failed before an HTTP response was received.";
  return new AppError(message, 503, code, { diagnosticCode: failure.networkCode ?? undefined });
}
