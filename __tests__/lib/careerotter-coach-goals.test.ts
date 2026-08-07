// @jest-environment node
import {
  buildCoachSystemPrompt,
  getCoachGoal,
  COACH_GOALS,
} from "@/lib/careerotter/coach-prompt";
import { vestedFractionOfYear } from "@/components/careerotter/comp-tracker";

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

describe("vestedFractionOfYear", () => {
  const start = new Date("2026-01-01T00:00:00");

  it("is 1 for a year fully inside the vest window", () => {
    expect(vestedFractionOfYear(2027, start, 4)).toBeCloseTo(1, 5);
  });

  it("is 0 for a year entirely after vesting ends", () => {
    expect(vestedFractionOfYear(2031, start, 4)).toBe(0);
  });

  it("is 0 for a year entirely before vesting starts", () => {
    expect(vestedFractionOfYear(2025, start, 4)).toBe(0);
  });

  it("prorates a partial first year for a mid-year start", () => {
    const julyStart = new Date("2026-07-01T00:00:00");
    const frac = vestedFractionOfYear(2026, julyStart, 4);
    expect(frac).toBeGreaterThan(0.4);
    expect(frac).toBeLessThan(0.6);
  });

  it("covers roughly vestYears of total time across the window", () => {
    const years = [2026, 2027, 2028, 2029, 2030];
    const total = years.reduce(
      (sum, y) => sum + vestedFractionOfYear(y, start, 4),
      0
    );
    expect(total).toBeCloseTo(4, 1);
  });
});
