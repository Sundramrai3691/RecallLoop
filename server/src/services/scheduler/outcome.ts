import type { ReviewOutcome } from "./types.js";

/**
 * Temporary coverage → outcome mapping for the MVP scheduler.
 * Not a scientific grade mapping; FSRS should consume richer signals later.
 */
export function coverageToOutcome(coverage: number): ReviewOutcome {
  if (coverage < 0.5) return "again";
  if (coverage < 0.75) return "hard";
  if (coverage < 0.9) return "good";
  return "easy";
}

export function nextIntervalDays(
  outcome: ReviewOutcome,
  previousIntervalDays: number,
): number {
  const previous = Number.isFinite(previousIntervalDays) ? previousIntervalDays : 0;
  switch (outcome) {
    case "again":
      return 1;
    case "hard":
      return Math.max(1, previous * 1.5);
    case "good":
      return Math.max(2, previous * 2);
    case "easy":
      return Math.max(4, previous * 3);
    default:
      return 1;
  }
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
