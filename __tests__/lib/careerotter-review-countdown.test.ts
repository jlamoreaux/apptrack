// @jest-environment node
import { reviewCountdown } from "@/lib/careerotter/review-countdown";

const NOW = new Date("2026-07-18T00:00:00Z");

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
    const c = reviewCountdown("2026-07-01", new Date("2026-06-01T12:00:00Z"));
    expect(c!.label).toBe("Review in 4 weeks");
  });

  it("uses the supplied noun for a job-search target date", () => {
    const now = new Date("2026-06-01T12:00:00Z");
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
