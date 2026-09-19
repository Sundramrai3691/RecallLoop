import { describe, expect, it } from "vitest";
import { coverageToOutcome, nextIntervalDays } from "./outcome.js";
import { IntervalScheduler } from "./intervalScheduler.js";

describe("coverageToOutcome", () => {
  it("maps coverage bands to review outcomes", () => {
    expect(coverageToOutcome(0)).toBe("again");
    expect(coverageToOutcome(0.49)).toBe("again");
    expect(coverageToOutcome(0.5)).toBe("hard");
    expect(coverageToOutcome(0.74)).toBe("hard");
    expect(coverageToOutcome(0.75)).toBe("good");
    expect(coverageToOutcome(0.89)).toBe("good");
    expect(coverageToOutcome(0.9)).toBe("easy");
    expect(coverageToOutcome(1)).toBe("easy");
  });
});

describe("nextIntervalDays", () => {
  it("uses the MVP interval policy", () => {
    expect(nextIntervalDays("again", 10)).toBe(1);
    expect(nextIntervalDays("hard", 0)).toBe(1);
    expect(nextIntervalDays("hard", 2)).toBe(3);
    expect(nextIntervalDays("good", 0)).toBe(2);
    expect(nextIntervalDays("good", 3)).toBe(6);
    expect(nextIntervalDays("easy", 0)).toBe(4);
    expect(nextIntervalDays("easy", 2)).toBe(6);
  });
});

describe("IntervalScheduler", () => {
  it("schedules first easy review at least 4 days out", () => {
    const scheduler = new IntervalScheduler();
    const now = new Date("2026-09-19T12:00:00.000Z");
    const next = scheduler.scheduleNextReview({
      conceptId: "c1",
      coverage: 0.95,
      now,
    });
    expect(next.lastOutcome).toBe("easy");
    expect(next.intervalDays).toBe(4);
    expect(next.dueAt.toISOString()).toBe("2026-09-23T12:00:00.000Z");
    expect(next.consecutiveSuccesses).toBe(1);
  });

  it("resets consecutive successes on again", () => {
    const scheduler = new IntervalScheduler();
    const now = new Date("2026-09-19T12:00:00.000Z");
    const next = scheduler.scheduleNextReview({
      conceptId: "c1",
      coverage: 0.2,
      now,
      previous: {
        conceptId: "c1",
        state: "review",
        dueAt: now,
        intervalDays: 8,
        stability: 8,
        difficulty: 0.3,
        consecutiveSuccesses: 4,
        updatedAt: now,
      },
    });
    expect(next.lastOutcome).toBe("again");
    expect(next.intervalDays).toBe(1);
    expect(next.consecutiveSuccesses).toBe(0);
    expect(next.state).toBe("relearning");
  });
});
