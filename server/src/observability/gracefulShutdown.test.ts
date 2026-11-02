import { describe, expect, it, vi } from "vitest";
import { createGracefulShutdown } from "./gracefulShutdown.js";

describe("bounded graceful shutdown", () => {
  it("stops accepting work, closes the database pool once, and exits successfully", async () => {
    let onClosed: (() => void) | undefined;
    const server = { close: vi.fn((callback: () => void) => { onClosed = callback; }) };
    const closeDatabase = vi.fn(async () => {});
    const exit = vi.fn();
    const shutdown = createGracefulShutdown(server, closeDatabase, exit, 100);
    shutdown(); shutdown();
    expect(server.close).toHaveBeenCalledTimes(1);
    onClosed?.();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(closeDatabase).toHaveBeenCalledTimes(1);
  });

  it("forces remaining HTTP connections and exits nonzero after the deadline", async () => {
    const closeAllConnections = vi.fn();
    const server = { close: vi.fn(), closeAllConnections };
    const closeDatabase = vi.fn(async () => {});
    const exit = vi.fn();
    const warn = vi.fn();
    createGracefulShutdown(server, closeDatabase, exit, 5, warn)();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(closeAllConnections).toHaveBeenCalledTimes(1);
    expect(closeDatabase).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("Graceful shutdown deadline reached; closing remaining HTTP connections.");
  });

  it("bounds a stalled PostgreSQL pool close and exits only once", async () => {
    const server = { close: (callback: () => void) => callback() };
    const closeDatabase = vi.fn(() => new Promise<void>(() => {}));
    const exit = vi.fn();
    const warn = vi.fn();
    createGracefulShutdown(server, closeDatabase, exit, 10, warn)();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    expect(warn).toHaveBeenCalledWith("Database pool shutdown deadline reached.");
  });
});
