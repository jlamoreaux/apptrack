/**
 * Case coverage — the deadpan version of progress (brand guide D6: no points, no
 * streaks, no confetti). Coverage ties directly to the promo case: each of the
 * four impact areas contributes up to an equal share, scaling with win count up
 * to a target depth. The biggest gap is the area with the fewest wins, which is
 * what the coach and dashboard point at ("the gap is leadership evidence").
 */

import { WIN_TAGS, type WinTag } from "@/lib/constants/careerotter";

// Wins-per-area at which an area is considered fully evidenced. Beyond this,
// extra wins in one area don't inflate overall coverage — breadth is the point.
export const COVERAGE_TARGET_PER_AREA = 3;

export interface CoverageArea {
  tag: WinTag;
  count: number;
  /** 0-100, this area's depth toward the target. */
  pct: number;
}

export interface Coverage {
  /** 0-100 across all four areas. */
  overallPct: number;
  areas: CoverageArea[];
  /** The tag with the fewest wins while still under target, else null. */
  biggestGap: WinTag | null;
  totalWins: number;
}

export function computeCoverage(
  wins: ReadonlyArray<{ tag: string | null }>
): Coverage {
  const counts = new Map<WinTag, number>(WIN_TAGS.map((t) => [t, 0]));
  for (const w of wins) {
    if (w.tag && counts.has(w.tag as WinTag)) {
      counts.set(w.tag as WinTag, (counts.get(w.tag as WinTag) ?? 0) + 1);
    }
  }

  const areas: CoverageArea[] = WIN_TAGS.map((tag) => {
    const count = counts.get(tag) ?? 0;
    const pct = Math.round(
      (Math.min(count, COVERAGE_TARGET_PER_AREA) / COVERAGE_TARGET_PER_AREA) * 100
    );
    return { tag, count, pct };
  });

  const covered = areas.reduce(
    (sum, a) => sum + Math.min(a.count, COVERAGE_TARGET_PER_AREA),
    0
  );
  const overallPct = Math.round(
    (covered / (COVERAGE_TARGET_PER_AREA * WIN_TAGS.length)) * 100
  );

  // Fewest-wins area (first in tag order on a tie); only a "gap" if under target.
  const lowest = areas.reduce((min, a) => (a.count < min.count ? a : min), areas[0]);
  const biggestGap = lowest.count < COVERAGE_TARGET_PER_AREA ? lowest.tag : null;

  return {
    overallPct,
    areas,
    biggestGap,
    totalWins: wins.length,
  };
}
