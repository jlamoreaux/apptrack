// @jest-environment node
import {
  buildCoachSystemPrompt,
  getCoachGoal,
  COACH_GOALS,
} from "@/lib/careerotter/coach-prompt";
import { grantFractionReceivedInYear } from "@/components/careerotter/comp-tracker";

describe("COACH_GOALS", () => {
  it("has unique ids", () => {
    const ids = COACH_GOALS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every goal has a stage, kickoff, and guidance", () => {
    for (const g of COACH_GOALS) {
      expect(g.stage.length).toBeGreaterThan(0);
      expect(g.kickoff.length).toBeGreaterThan(0);
      expect(g.guidance.length).toBeGreaterThan(0);
    }
  });
});

describe("getCoachGoal", () => {
  it("finds a goal by id", () => {
    expect(getCoachGoal("storybank")?.label).toBe("Build my storybank");
  });

  it("returns null for unknown or non-string input", () => {
    expect(getCoachGoal("nope")).toBeNull();
    expect(getCoachGoal(undefined)).toBeNull();
    expect(getCoachGoal(42)).toBeNull();
  });
});

describe("buildCoachSystemPrompt with a guided activity", () => {
  const wins = [{ text: "Shipped billing migration early", tag: "delivery" }];

  it("appends the activity guidance", () => {
    const goal = getCoachGoal("find-gaps");
    const p = buildCoachSystemPrompt({ mode: "promotion" }, wins, goal);
    expect(p).toContain('guided activity "Find my gaps"');
    expect(p).toContain(goal!.guidance);
  });

  it("is unchanged when no activity is given", () => {
    const p = buildCoachSystemPrompt({ mode: "promotion" }, wins);
    expect(p).not.toContain("guided activity");
  });
});

describe("grantFractionReceivedInYear", () => {
  const start = new Date("2026-01-01T00:00:00");

  it("gives roughly 1/vestYears for a full mid-vest year with no cliff", () => {
    expect(grantFractionReceivedInYear(2027, start, 4, 0)).toBeCloseTo(0.25, 2);
  });

  it("is 0 for a year entirely after vesting ends", () => {
    expect(grantFractionReceivedInYear(2031, start, 4, 0)).toBe(0);
  });

  it("is 0 for a year entirely before vesting starts", () => {
    expect(grantFractionReceivedInYear(2025, start, 4, 0)).toBe(0);
  });

  it("halves the first year's share for a mid-year start with no cliff", () => {
    const julyStart = new Date("2026-07-01T00:00:00");
    const frac = grantFractionReceivedInYear(2026, julyStart, 4, 0);
    expect(frac).toBeGreaterThan(0.1);
    expect(frac).toBeLessThan(0.15);
  });

  it("sums to the full grant across the window", () => {
    const years = [2026, 2027, 2028, 2029, 2030];
    const total = years.reduce(
      (sum, y) => sum + grantFractionReceivedInYear(y, start, 4, 0),
      0
    );
    expect(total).toBeCloseTo(1, 5);
  });

  describe("with a 12-month cliff (Dec 2025 start, 4-year vest)", () => {
    const decStart = new Date("2025-12-01T00:00:00");

    it("pays nothing before the cliff", () => {
      expect(grantFractionReceivedInYear(2025, decStart, 4, 12)).toBe(0);
    });

    it("pays the cliff lump (a year's worth plus remaining months) in the cliff year", () => {
      const frac = grantFractionReceivedInYear(2026, decStart, 4, 12);
      // ~13 of 48 months land in 2026: the 12-month lump at the Dec 2026
      // cliff plus December's linear vesting.
      expect(frac).toBeGreaterThan(0.25);
      expect(frac).toBeLessThan(0.29);
    });

    it("returns to ~1/vestYears in later years", () => {
      expect(grantFractionReceivedInYear(2027, decStart, 4, 12)).toBeCloseTo(0.25, 2);
    });

    it("still sums to the full grant across the window", () => {
      const years = [2025, 2026, 2027, 2028, 2029, 2030];
      const total = years.reduce(
        (sum, y) => sum + grantFractionReceivedInYear(y, decStart, 4, 12),
        0
      );
      expect(total).toBeCloseTo(1, 5);
    });
  });
});
