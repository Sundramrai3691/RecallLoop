import { query } from "../../db/postgres.js";
import { AppError, notFound } from "../../utils/errors.js";

export type ReviewMode = "automatic" | "confirm" | "manual";
const MODES = new Set<ReviewMode>(["automatic","confirm","manual"]);

export async function getSettings(userId: string) {
  const result = await query<any>(`SELECT review_mode AS "reviewMode" FROM app_users WHERE id=$1`,[userId]);
  if (!result.rows[0]) throw notFound("User not found","USER_NOT_FOUND");
  return { reviewMode: result.rows[0].reviewMode as ReviewMode };
}

export async function updateSettings(userId: string, input: { reviewMode?: string }) {
  if (input.reviewMode === undefined || !MODES.has(input.reviewMode as ReviewMode)) throw new AppError("reviewMode must be automatic, confirm, or manual",400,"VALIDATION_ERROR");
  const result = await query<any>(`UPDATE app_users SET review_mode=$2,updated_at=now() WHERE id=$1 RETURNING review_mode AS "reviewMode"`,[userId,input.reviewMode]);
  if (!result.rows[0]) throw notFound("User not found","USER_NOT_FOUND");
  return { reviewMode: result.rows[0].reviewMode as ReviewMode };
}
