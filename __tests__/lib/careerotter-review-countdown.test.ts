// @jest-environment node
import { reviewCountdown } from "@/lib/careerotter/review-countdown";

// No trailing Z anywhere in this file: reviewCountdown reads the local
// calendar date, so a UTC instant would make these assertions depend on the
// runner's timezone.
const NOW = new Date("2026-07-18T00:00:00");

describe("reviewCountdown", () => {
  it("returns null with no date", () => {
    expect(reviewCountdown(null, NOW)).toBeNull();
    expect(reviewCountdown(undefined, NOW)).toBeNull();
  });

  it("counts whole weeks out", () => {
    const c = reviewCountdown("2026-09-19", NOW); // ~9 weeks
    expect(c?.weeks).toBe(9);
    expect(c?.isPast).toBe(false);
    expect(c?.label).toBe("Review in 9 weeks");
  });

  it("switches to days inside a week", () => {
    const c = reviewCountdown("2026-07-22", NOW); // 4 days
    expect(c?.label).toBe("Review in 4 days");
  });

  it("flags a past date", () => {
    const c = reviewCountdown("2026-07-01", NOW);
    expect(c?.isPast).toBe(true);
    expect(c?.label).toBe("Review date passed");
  });

  it("returns null for an unparseable date", () => {
    expect(reviewCountdown("not-a-date", NOW)).toBeNull();
  });
});

describe("label noun", () => {
  it("leads with Review by default", () => {
    const c = reviewCountdown("2026-07-01", new Date("2026-06-01T12:00:00"));
    expect(c!.label).toBe("Review in 4 weeks");
  });

  it("uses the supplied noun for a job-search target date", () => {
    const now = new Date("2026-06-01T12:00:00");
    expect(reviewCountdown("2026-07-01", now, { noun: "Target" })!.label).toBe(
      "Target in 4 weeks"
    );
    expect(reviewCountdown("2026-06-03", now, { noun: "Target" })!.label).toBe(
      "Target in 2 days"
    );
    expect(reviewCountdown("2026-05-01", now, { noun: "Target" })!.label).toBe(
      "Target date passed"
    );
  });
});

describe("calendar-day boundaries", () => {
  // A stored review date is a calendar date, not an instant: the label must not
  // depend on the time of day, and must not turn over until the review day is
  // actually over in the reader's own timezone.
  it("does not call the review past on the review day itself", () => {
    for (const hour of ["00:00", "08:00", "17:30", "23:59"]) {
      const c = reviewCountdown("2026-07-18", new Date(`2026-07-18T${hour}:00`));
      expect(c!.isPast).toBe(false);
      expect(c!.days).toBe(0);
      expect(c!.label).toBe("Review is today");
    }
  });

  it("still says tomorrow late on the evening before", () => {
    const c = reviewCountdown("2026-07-18", new Date("2026-07-17T23:30:00"));
    expect(c!.isPast).toBe(false);
    expect(c!.label).toBe("Review is tomorrow");
  });

  it("flips to past only once the review day is over", () => {
    const c = reviewCountdown("2026-07-18", new Date("2026-07-19T00:01:00"));
    expect(c!.isPast).toBe(true);
    expect(c!.days).toBe(1);
  });

  it("counts whole days regardless of time of day", () => {
    const early = reviewCountdown("2026-07-22", new Date("2026-07-18T00:01:00"));
    const late = reviewCountdown("2026-07-22", new Date("2026-07-18T23:59:00"));
    expect(early!.days).toBe(4);
    expect(late!.days).toBe(4);
    expect(early!.label).toBe(late!.label);
  });
});
