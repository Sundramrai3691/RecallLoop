import { IntervalScheduler } from "./intervalScheduler.js";
import type { Scheduler } from "./types.js";

let scheduler: Scheduler = new IntervalScheduler();

export function getScheduler(): Scheduler {
  return scheduler;
}

/** Test/FSRS hook: swap the implementation without touching recall services. */
export function setScheduler(next: Scheduler): void {
  scheduler = next;
}

export { IntervalScheduler } from "./intervalScheduler.js";
export { coverageToOutcome, nextIntervalDays } from "./outcome.js";
export type {
  Scheduler,
  ScheduleNextReviewInput,
  ReviewStateSnapshot,
  ReviewOutcome,
} from "./types.js";
