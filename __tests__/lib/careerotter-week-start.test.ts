/**
 * The ISO week boundary. weekly_recaps.week_start has a Monday CHECK and the
 * recap cron upserts against it, so this has to land on Monday for every day of
 * the week — Sunday included, which is where a naive getUTCDay() shift breaks.
 */

// @jest-environment node

import { weekStartOf, weekStartMs } from "@/lib/careerotter/week-start";

describe("weekStartOf", () => {
  it("returns the same Monday for every day of that ISO week", () => {
    // 2026-06-15 is a Monday; 2026-06-21 is the Sunday that ends its week.
    const days = [
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
    ];
    for (const day of days) {
      expect(weekStartOf(new Date(`${day}T12:00:00Z`))).toBe("2026-06-15");
    }
  });

  it("rolls to the next Monday once the week turns over", () => {
    expect(weekStartOf(new Date("2026-06-22T00:00:00Z"))).toBe("2026-06-22");
  });

  it("always lands on a Monday, matching the weekly_recaps CHECK", () => {
    for (let offset = 0; offset < 400; offset += 1) {
      const day = new Date(Date.UTC(2026, 0, 1) + offset * 86_400_000);
      const start = new Date(`${weekStartOf(day)}T00:00:00Z`);
      expect(start.getUTCDay()).toBe(1);
      expect(start.getTime()).toBeLessThanOrEqual(day.getTime());
    }
  });

  it("crosses a month and a year boundary correctly", () => {
    // 2027-01-01 is a Friday, so its week starts in December.
    expect(weekStartOf(new Date("2027-01-01T12:00:00Z"))).toBe("2026-12-28");
  });

  it("weekStartMs agrees with weekStartOf", () => {
    const now = new Date("2026-06-18T09:30:00Z");
    expect(weekStartMs(now)).toBe(Date.UTC(2026, 5, 15));
  });
});
