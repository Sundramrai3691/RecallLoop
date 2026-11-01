import { describe, expect, it } from "vitest";
import { classifyProviderConnectionFailure, providerConnectionAppError } from "./connectionFailure.js";

describe("provider connection failure diagnostics", () => {
  it.each([
    ["ENOTFOUND", "dns_error"],
    ["ECONNREFUSED", "connection_refused"],
    ["ETIMEDOUT", "connection_timeout"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "tls_error"],
    ["ERR_PROXY_CONNECTION_FAILED", "proxy_error"],
    ["EACCES", "outbound_blocked"],
  ])("classifies %s as %s", (code, category) => {
    const error = Object.assign(new Error("private native message"), { cause: Object.assign(new Error("nested"), { code }) });
    expect(classifyProviderConnectionFailure(error)).toEqual({ category, networkCode: code });
    const wrapped = providerConnectionAppError(error);
    expect(wrapped.code).toBe(category === "outbound_blocked" ? "LLM_OUTBOUND_BLOCKED" : `LLM_${category.toUpperCase()}`);
    expect(wrapped.message).not.toContain("private native message");
    expect(wrapped.diagnosticCode).toBe(code);
  });

  it("finds a blocked socket inside an AggregateError and avoids arbitrary error text", () => {
    const error = new AggregateError([Object.assign(new Error("socket details"), { code: "EACCES" })], "fetch failed");
    expect(classifyProviderConnectionFailure(error)).toEqual({ category: "outbound_blocked", networkCode: "EACCES" });
    expect(classifyProviderConnectionFailure(new Error("no safe code"))).toEqual({ category: "unknown_provider_error", networkCode: null });
  });
});
