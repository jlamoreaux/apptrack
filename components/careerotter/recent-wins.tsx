"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { WIN_TAG_OPTIONS, type WinTag } from "@/lib/constants/careerotter";
import type { LoggedWin } from "./win-capture-bar";

const TAG_LABEL: Record<WinTag, string> = Object.fromEntries(
  WIN_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<WinTag, string>;

const MAX_SHOWN = 5;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * What you've been working on lately. Today's job is to make the user's own
 * recent work the thing they see first — a coverage percentage is a summary of
 * this list, not a substitute for it.
 */
export function RecentWins({ wins }: { wins: LoggedWin[] }) {
  if (wins.length === 0) return null;

  const shown = wins.slice(0, MAX_SHOWN);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Recently</h3>
          <Link
            href="/dashboard/wins"
            className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
          >
            All {wins.length} wins
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        <ul className="divide-y">
          {shown.map((win) => (
            <li key={win.id} className="flex gap-3 py-2 first:pt-0 last:pb-0">
              <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                {formatDate(win.created_at)}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm leading-snug">{win.text}</p>
                {(win.impact_number || win.tag) && (
                  <p className="text-xs text-muted-foreground">
                    {win.impact_number}
                    {win.impact_number && win.tag ? " · " : ""}
                    {win.tag ? TAG_LABEL[win.tag] : ""}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
