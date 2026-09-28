/**
 * Coverage math (M2): breadth across the four impact areas, capped depth, and
 * the "biggest gap" the coach/dashboard point at.
 */

// @jest-environment node

import {
  computeCoverage,
  coverageFromCounts,
  COVERAGE_TARGET_PER_AREA,
} from "@/lib/careerotter/coverage";
import type { WinTag } from "@/lib/constants/careerotter";

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
    expect(c.untagged).toBe(2);
    expect(c.areas.find((a) => a.tag === "delivery")?.count).toBe(1);
  });

  it("treats an unknown tag as untagged", () => {
    const c = computeCoverage([w("vibes")]);
    expect(c.untagged).toBe(1);
    expect(c.overallPct).toBe(0);
  });
});

describe("coverageFromCounts", () => {
  it("matches computeCoverage for the same wins", () => {
    const wins = [w("delivery"), w("delivery"), w("craft"), w(null), w("unknown")];
    const counts = { total: 5, byTag: new Map<WinTag, number>([["delivery", 2], ["craft", 1]]), untagged: 2 };
    expect(coverageFromCounts(counts)).toEqual(computeCoverage(wins));
  });

  it("treats areas missing from the counts as empty", () => {
    const c = coverageFromCounts({ total: 0, byTag: new Map(), untagged: 0 });
    expect(c.areas.every((area) => area.count === 0)).toBe(true);
    expect(c.overallPct).toBe(0);
  });
});
