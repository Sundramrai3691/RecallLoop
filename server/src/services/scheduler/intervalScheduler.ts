import { addDays, coverageToOutcome, nextIntervalDays } from "./outcome.js";
import type {
  ReviewLifecycle,
  ReviewStateSnapshot,
  ScheduleNextReviewInput,
  Scheduler,
} from "./types.js";

function nextLifecycle(
  outcome: ScheduleNextReviewInput extends never ? never : ReturnType<typeof coverageToOutcome>,
  previous?: ReviewStateSnapshot | null,
): ReviewLifecycle {
  if (outcome === "again") return previous ? "relearning" : "learning";
  if (!previous || previous.state === "new") return "learning";
  return "review";
}

export class IntervalScheduler implements Scheduler {
  scheduleNextReview(input: ScheduleNextReviewInput): ReviewStateSnapshot {
    const outcome = coverageToOutcome(input.coverage);
    const previousInterval = input.previous?.intervalDays ?? 0;
    const intervalDays = nextIntervalDays(outcome, previousInterval);
    const dueAt = addDays(input.now, intervalDays);
    const success = outcome === "good" || outcome === "easy";
    const consecutiveSuccesses = success
      ? (input.previous?.consecutiveSuccesses ?? 0) + 1
      : outcome === "again"
        ? 0
        : input.previous?.consecutiveSuccesses ?? 0;

    const difficulty =
      input.conceptDifficulty != null
        ? input.conceptDifficulty / 5
        : (input.previous?.difficulty ?? 0.3);

    return {
      conceptId: input.conceptId,
      state: nextLifecycle(outcome, input.previous),
      dueAt,
      intervalDays,
      stability: intervalDays,
      difficulty,
      lastRecallAt: input.now,
      lastOutcome: outcome,
      consecutiveSuccesses,
      updatedAt: input.now,
    };
  }
}

export const defaultScheduler = new IntervalScheduler();
