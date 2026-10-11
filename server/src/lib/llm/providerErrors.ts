import { unavailable } from "../../utils/errors.js";

export function providerHttpError(provider: "LLM" | "Embedding", status: number) {
  const prefix = provider === "LLM" ? "LLM" : "EMBEDDING";
  if (status === 401) {
    return unavailable(`${provider} provider authentication failed (HTTP 401). Check the configured API key.`, `${prefix}_AUTHENTICATION_FAILED`);
  }
  if (status === 403) {
    return unavailable(`${provider} provider denied access (HTTP 403). Check model access and project permissions.`, `${prefix}_ACCESS_DENIED`);
  }
  if (status === 429) {
    return unavailable(`${provider} provider rate limit or quota was exceeded (HTTP 429).`, `${prefix}_RATE_LIMITED`);
  }
  if (status >= 500) {
    return unavailable(`${provider} provider failed (HTTP ${status}). Retry after the provider recovers.`, `${prefix}_PROVIDER_FAILURE`);
  }
  return unavailable(`${provider} provider rejected the request (HTTP ${status}). Check the model and request configuration.`, `${prefix}_REQUEST_REJECTED`);
}
