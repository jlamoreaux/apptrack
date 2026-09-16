"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { trackRecapOpened } from "@/lib/analytics/careerotter-events";
import { weekStartOf } from "@/lib/careerotter/week-start";

export interface WeeklyRecap {
  week_start: string;
  generated_text: string | null;
  wins_included: number;
}

function formatWeek(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The weekly recap, in the product. The Friday cron has been generating these
 * into weekly_recaps all along and no screen ever read them — so the one artifact
 * the user could paste straight into a 1:1 was invisible.
 *
 * With no recap yet, this states what's coming rather than showing an empty card,
 * which is also the only honest thing to say before Friday.
 */
export function WeeklyRecapCard({
  recap,
  winsThisWeek,
  now = new Date(),
}: {
  recap: WeeklyRecap | null;
  winsThisWeek: number;
  now?: Date;
}) {
  const [copied, setCopied] = useState(false);
  const trackedWeek = useRef<string | null>(null);

  const text = recap?.generated_text?.trim() || "";

  // Once per recap week per browser session. Firing on every mount would make
  // recap_opened a count of dashboard loads, which is worse than not measuring
  // it: the event is meant to tell us whether the Friday recap brings people
  // back. sessionStorage throws in private-mode Safari and storage-disabled
  // webviews, so a failure just means we fire once per mount instead.
  useEffect(() => {
    if (!recap || !text) return;
    const week = recap.week_start;
    if (trackedWeek.current === week) return;
    trackedWeek.current = week;

    const key = `recap-opened:${week}`;
    try {
      if (sessionStorage.getItem(key) === "true") return;
      sessionStorage.setItem(key, "true");
    } catch {
      // No session storage — fall through and track this view.
    }
    trackRecapOpened({ week_start: week });
  }, [recap, text]);

  if (!recap || !text) {
    // Nothing generated and nothing logged this week: the next-move card is
    // already asking for a win. A second empty prompt would just be nagging.
    if (winsThisWeek === 0) return null;
    return (
      <Card>
        <CardContent className="space-y-1 p-5">
          <h3 className="text-sm font-semibold">This week</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {winsThisWeek} {winsThisWeek === 1 ? "win" : "wins"} logged since
            Monday. Friday&apos;s recap turns them into a few sentences you can
            paste straight into a 1:1.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isCurrentWeek = recap.week_start === weekStartOf(now);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some embedded webviews; the text is selectable.
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {isCurrentWeek ? "This week" : `Week of ${formatWeek(recap.week_start)}`}
          </h3>
          <span className="text-xs text-muted-foreground">
            From {recap.wins_included}{" "}
            {recap.wins_included === 1 ? "win" : "wins"}
          </span>
        </div>

        <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>

        <Button
          variant="outline"
          onClick={copy}
          className="min-h-[44px]"
          aria-label="Copy this recap"
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy for your 1:1
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
