/**
 * Coverage math (M2): breadth across the four impact areas, capped depth, and
 * the "biggest gap" the coach/dashboard point at.
 */

// @jest-environment node

import {
  computeCoverage,
  COVERAGE_TARGET_PER_AREA,
} from "@/lib/careerotter/coverage";

const w = (tag: string | null) => ({ tag });

describe("computeCoverage", () => {
  it("is 0% with no wins and reports a gap", () => {
    const c = computeCoverage([]);
    expect(c.overallPct).toBe(0);
    expect(c.totalWins).toBe(0);
    expect(c.biggestGap).toBe("delivery"); // first area, all tied at 0
  });

  it("is 100% when every area hits the target depth", () => {
    const wins = ["delivery", "leadership", "collaboration", "craft"].flatMap(
      (t) => Array.from({ length: COVERAGE_TARGET_PER_AREA }, () => w(t))
    );
    const c = computeCoverage(wins);
    expect(c.overallPct).toBe(100);
    expect(c.biggestGap).toBeNull();
  });

  it("caps an over-stuffed area so breadth matters", () => {
    // 9 delivery wins, nothing else: delivery caps at its 25% share.
    const c = computeCoverage(Array.from({ length: 9 }, () => w("delivery")));
    expect(c.overallPct).toBe(25);
    expect(c.areas.find((a) => a.tag === "delivery")?.pct).toBe(100);
    expect(c.biggestGap).not.toBe("delivery");
  });

  it("names the emptiest area as the biggest gap", () => {
    const c = computeCoverage([
      w("delivery"),
      w("delivery"),
      w("collaboration"),
      w("craft"),
      // leadership: none
    ]);
    expect(c.biggestGap).toBe("leadership");
  });

  it("ignores untagged wins for coverage but counts them in the total", () => {
    const c = computeCoverage([w(null), w(null), w("delivery")]);
    expect(c.totalWins).toBe(3);
    expect(c.areas.find((a) => a.tag === "delivery")?.count).toBe(1);
  });
});
