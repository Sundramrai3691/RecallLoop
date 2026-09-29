import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgres } from "./postgres.js";

try {
  const filename = fileURLToPath(import.meta.url);
  const sql = await fs.readFile(path.resolve(path.dirname(filename), "../../migrations/002_seed_knowledge.sql"), "utf8");
  await postgres.query(sql);
  console.log("PostgreSQL curated knowledge seed applied.");
} finally {
  await postgres.end();
}
