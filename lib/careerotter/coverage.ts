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

const PERCENT = 100;

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
  /** Wins with no area. They are in the log but count toward no area's depth. */
  untagged: number;
}

/** Win counts per impact area: what coverage is computed from. */
export interface WinTagCounts {
  total: number;
  /** Areas missing from the map count as zero. */
  byTag: ReadonlyMap<WinTag, number>;
  /** Wins in no known area. */
  untagged: number;
}

function isWinTag(value: string): value is WinTag {
  return WIN_TAGS.some((tag) => tag === value);
}

function countTags(wins: ReadonlyArray<{ tag: string | null }>): WinTagCounts {
  const byTag = new Map<WinTag, number>();
  let untagged = 0;
  for (const win of wins) {
    if (win.tag !== null && isWinTag(win.tag)) {
      byTag.set(win.tag, (byTag.get(win.tag) ?? 0) + 1);
    } else {
      untagged += 1;
    }
  }
  return { total: wins.length, byTag, untagged };
}

function toArea(tag: WinTag, count: number): CoverageArea {
  const depth = Math.min(count, COVERAGE_TARGET_PER_AREA);
  return { tag, count, pct: Math.round((depth / COVERAGE_TARGET_PER_AREA) * PERCENT) };
}

/** Coverage from per-area counts, for callers that count in the database. */
export function coverageFromCounts(counts: WinTagCounts): Coverage {
  const areas = WIN_TAGS.map((tag) => toArea(tag, counts.byTag.get(tag) ?? 0));
  const covered = areas.reduce(
    (sum, area) => sum + Math.min(area.count, COVERAGE_TARGET_PER_AREA),
    0
  );
  const overallPct = Math.round(
    (covered / (COVERAGE_TARGET_PER_AREA * WIN_TAGS.length)) * PERCENT
  );
  // Fewest-wins area (first in tag order on a tie); only a "gap" if under target.
  const lowest = areas.reduce((min, area) => (area.count < min.count ? area : min), areas[0]);
  const biggestGap = lowest.count < COVERAGE_TARGET_PER_AREA ? lowest.tag : null;
  return { overallPct, areas, biggestGap, totalWins: counts.total, untagged: counts.untagged };
}

export function computeCoverage(
  wins: ReadonlyArray<{ tag: string | null }>
): Coverage {
  return coverageFromCounts(countTags(wins));
}
