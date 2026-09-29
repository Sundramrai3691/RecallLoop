import { postgres } from "./postgres.js";

export async function connectDatabase(): Promise<void> {
  await postgres.query("SELECT 1");
}

export async function disconnectDatabase(): Promise<void> {
  await postgres.end();
}
