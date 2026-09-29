import { postgres, runPostgresMigration } from "./postgres.js";

try {
  await runPostgresMigration();
  console.log("PostgreSQL migrations and curated knowledge seed applied.");
} finally {
  await postgres.end();
}
