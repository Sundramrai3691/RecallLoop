/**
 * MVP scheduler — isolated from the LLM.
 *
 * This is an MVP scheduler and is not the final learning-science implementation.
 * Replace `IntervalScheduler` with an FSRS adapter that still implements `Scheduler`.
 */

export const REVIEW_OUTCOMES = ["again", "hard", "good", "easy"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export type ReviewLifecycle = "new" | "learning" | "review" | "relearning";

export interface ReviewStateSnapshot {
  conceptId: string;
  state: ReviewLifecycle;
  dueAt: Date;
  intervalDays: number;
  stability: number;
  difficulty: number;
  lastRecallAt?: Date;
  lastOutcome?: ReviewOutcome;
  consecutiveSuccesses: number;
  updatedAt: Date;
}

export interface ScheduleNextReviewInput {
  conceptId: string;
  coverage: number;
  now: Date;
  previous?: ReviewStateSnapshot | null;
  /** Optional concept difficulty 1-5; stored as a placeholder FSRS difficulty signal. */
  conceptDifficulty?: number;
}

export interface Scheduler {
  scheduleNextReview(input: ScheduleNextReviewInput): ReviewStateSnapshot;
}
