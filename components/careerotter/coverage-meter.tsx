"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { computeCoverage } from "@/lib/careerotter/coverage";
import { WIN_TAG_OPTIONS, type WinTag } from "@/lib/constants/careerotter";

const TAG_LABEL: Record<WinTag, string> = Object.fromEntries(
  WIN_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<WinTag, string>;

/**
 * Case coverage: per-area depth + an overall percentage, stated plainly. No
 * points, no streaks (D6). The one line of copy names the biggest gap, tying
 * progress to the actual payoff.
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
          {coverage.totalWins === 0
            ? "No wins logged yet. Log one. Future-you, sitting in a review, will be glad you did."
            : coverage.biggestGap
              ? `Your case is ${coverage.overallPct}% built. The gap is ${TAG_LABEL[coverage.biggestGap].toLowerCase()} evidence. Close it before the meeting, not during it.`
              : `Your case is ${coverage.overallPct}% built, with evidence in every area. That's a case with no gaps in it.`}
        </p>
      </CardContent>
    </Card>
  );
}
