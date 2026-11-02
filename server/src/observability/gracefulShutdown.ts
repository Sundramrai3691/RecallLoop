import type { Server } from "node:http";

export function createGracefulShutdown(
  server: Pick<Server, "close"> & Partial<Pick<Server, "closeAllConnections">>,
  closeDatabase: () => Promise<void>,
  exit: (code: number) => void = (code) => process.exit(code),
  timeoutMs = 10_000,
  warn: (message: string) => void = (message) => console.warn(message),
): () => void {
  let shuttingDown = false;
  let finalized = false;
  let timedOut = false;
  let exited = false;
  const exitOnce = (code: number) => { if (exited) return; exited = true; exit(code); };

  return () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const finish = async (code: number) => {
      if (finalized) return;
      finalized = true;
      clearTimeout(deadline);
      const databaseDeadline = setTimeout(() => {
        warn("Database pool shutdown deadline reached.");
        exitOnce(1);
      }, Math.min(timeoutMs, 2_000));
      databaseDeadline.unref?.();
      try {
        await closeDatabase();
        clearTimeout(databaseDeadline);
        exitOnce(code);
      } catch {
        clearTimeout(databaseDeadline);
        warn("Database pool shutdown failed.");
        exitOnce(1);
      }
    };
    const deadline = setTimeout(() => {
      timedOut = true;
      warn("Graceful shutdown deadline reached; closing remaining HTTP connections.");
      server.closeAllConnections?.();
      void finish(1);
    }, timeoutMs);
    deadline.unref?.();
    server.close(() => { if (!timedOut) void finish(0); });
  };
}

export function installGracefulShutdown(server: Server, closeDatabase: () => Promise<void>): void {
  const shutdown = createGracefulShutdown(server, closeDatabase);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
