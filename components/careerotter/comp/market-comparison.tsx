"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMP_LEVELS,
  COMP_ROLE_FAMILIES,
  compDelta,
  type MarketRange,
} from "@/lib/careerotter/market-data";
import { formatCompactUsd, formatUsd } from "@/lib/careerotter/comp-projection";

interface MarketComparisonProps {
  roleTitle: string;
  level: string;
  onRoleTitleChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  marketRange: MarketRange | null;
  isPro: boolean;
  /** Annual total comp to place on the range; null before the first entry. */
  annualTotal: number | null;
}

/**
 * Map a free-text job title to a known benchmark role family when it clearly
 * matches one, so the market comparison still works for common titles. Any
 * other title is passed through unchanged and simply shows the user's own
 * history.
 */
export function resolveRoleFamily(title: string): string {
  const t = title.trim().toLowerCase();
  if (!t) return "";
  const match = COMP_ROLE_FAMILIES.find((r) => {
    const label = r.label.toLowerCase();
    // Exact match always wins; substring matching only for meaningful lengths so
    // a single letter like "d" can't resolve to the first family that contains it.
    return t === label || t === r.value || (t.length >= 3 && (t.includes(label) || label.includes(t)));
  });
  return match ? match.value : title.trim();
}

/**
 * Role and level pickers plus the range they map to, drawn as one track from
 * the market low to its high with the midpoint marked and the user's own
 * number placed on it. Pro-gated by the API; the pickers stay usable so a
 * free user sees what the comparison would be against.
 */
export function MarketComparison({
  roleTitle,
  level,
  onRoleTitleChange,
  onLevelChange,
  marketRange,
  isPro,
  annualTotal,
}: MarketComparisonProps) {
  const delta = marketRange && annualTotal !== null ? compDelta(annualTotal, marketRange) : null;
  const span = marketRange ? marketRange.high - marketRange.low : 0;
  const place = (v: number) =>
    marketRange && span > 0 ? Math.min(100, Math.max(0, ((v - marketRange.low) / span) * 100)) : 0;
  const youPct = marketRange && annualTotal !== null ? place(annualTotal) : null;
  const offTrack =
    marketRange && annualTotal !== null
      ? annualTotal < marketRange.low
        ? "below"
        : annualTotal > marketRange.high
          ? "above"
          : null
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="comp-role">Role</Label>
          <Input
            id="comp-role"
            list="comp-role-suggestions"
            value={roleTitle}
            onChange={(e) => onRoleTitleChange(e.target.value)}
            placeholder="e.g. Staff Software Engineer"
            className="min-h-[44px]"
            autoComplete="off"
          />
          <datalist id="comp-role-suggestions">
            {COMP_ROLE_FAMILIES.map((r) => (
              <option key={r.value} value={r.label} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="comp-level">Level</Label>
          <Select value={level} onValueChange={onLevelChange}>
            <SelectTrigger id="comp-level" className="min-h-[44px]">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {COMP_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {marketRange ? (
        <div className="space-y-2">
          <div className="relative pt-6">
            {youPct !== null && (
              <div
                className="absolute top-0 -translate-x-1/2 text-xs font-medium text-foreground"
                style={{ left: `${youPct}%` }}
              >
                you
              </div>
            )}
            <div className="relative h-2 rounded-full bg-surface-raised">
              <div
                className="absolute inset-y-0 rounded-full bg-primary/25"
                style={{ left: 0, width: `${place(marketRange.mid)}%` }}
                aria-hidden="true"
              />
              <span
                className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-muted-foreground"
                style={{ left: `${place(marketRange.mid)}%` }}
                aria-hidden="true"
              />
              {youPct !== null && (
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow"
                  style={{ left: `${youPct}%` }}
                  role="img"
                  aria-label={`You: ${formatUsd(annualTotal ?? 0)}`}
                />
              )}
            </div>
            <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted-foreground">
              <span>Low {formatCompactUsd(marketRange.low)}</span>
              <span>Mid {formatCompactUsd(marketRange.mid)}</span>
              <span>High {formatCompactUsd(marketRange.high)}</span>
            </div>
          </div>
          <p className="text-sm text-foreground">
            {delta ? (
              <>
                <span className="font-semibold tabular-nums">
                  {delta.pct > 0 ? "+" : ""}
                  {delta.pct}%
                </span>{" "}
                vs the market midpoint for {marketRange.label},{" "}
                {COMP_LEVELS.find((l) => l.value === marketRange.level)?.label.toLowerCase()}
                {offTrack === "above" && ". Above the top of the range."}
                {offTrack === "below" && ". Below the bottom of the range."}
              </>
            ) : (
              "Add a comp entry to see where you sit on this range."
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Market data from {marketRange.source}. Ranges are annual total comp.
          </p>
        </div>
      ) : !isPro ? (
        <p className="text-sm text-muted-foreground">
          The market benchmark is a Pro feature. Everything else on this page is free.
        </p>
      ) : roleTitle.trim().length > 0 && level ? (
        <p className="text-sm text-muted-foreground">
          No market data for that role and level yet. Try one of the suggested roles.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Pick a role and level to see your number against the market.
        </p>
      )}
    </div>
  );
}
