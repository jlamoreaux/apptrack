"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { computeCoverage } from "@/lib/careerotter/coverage";
import { WIN_TAG_OPTIONS, type WinTag } from "@/lib/constants/careerotter";

const TAG_LABEL: Record<WinTag, string> = Object.fromEntries(
  WIN_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<WinTag, string>;

/**
 * The one line under the meter. It names the single thing to do next: tag the
 * wins that have no area (they count toward nothing until they do), then close
 * the thinnest area, then nothing, because the case has no gaps.
 */
function coverageLine(c: ReturnType<typeof computeCoverage>): string {
  if (c.totalWins === 0) {
    return "No wins logged yet. Log one. Future-you, sitting in a review, will be glad you did.";
  }
  const built = `Your case is ${c.overallPct}% built.`;
  if (c.untagged > 0) {
    const n = c.untagged;
    const subject =
      n === c.totalWins
        ? n === 1
          ? "Your win has"
          : "Your wins have"
        : `${n} of your wins ${n === 1 ? "has" : "have"}`;
    const verb = n === 1 ? "it counts" : "they count";
    return `${built} ${subject} no area yet, so ${verb} toward nothing. Set an area on each and coverage moves.`;
  }
  if (c.biggestGap) {
    return `${built} The gap is ${TAG_LABEL[c.biggestGap].toLowerCase()} evidence. Close it before the meeting, not during it.`;
  }
  return `Your case is ${c.overallPct}% built, with evidence in every area. That's a case with no gaps in it.`;
}

/**
 * Case coverage: per-area depth + an overall percentage, stated plainly. No
 * points, no streaks (D6). The one line of copy names the next thing to do,
 * tying progress to the actual payoff.
 */
export function CoverageMeter({ wins }: { wins: ReadonlyArray<{ tag: string | null }> }) {
  const coverage = computeCoverage(wins);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Case coverage</h3>
          <span className="text-2xl font-bold tabular-nums text-primary">
            {coverage.overallPct}%
          </span>
        </div>

        <div className="space-y-3">
          {coverage.areas.map((area) => (
            <div key={area.tag} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-muted-foreground">
                {TAG_LABEL[area.tag]}
              </span>
              <Progress value={area.pct} className="h-2 flex-1" />
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {area.count === 0 ? "0" : `${area.count} win${area.count === 1 ? "" : "s"}`}
              </span>
            </div>
          ))}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {coverageLine(coverage)}
        </p>
      </CardContent>
    </Card>
  );
}
