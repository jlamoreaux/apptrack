"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { WinCaptureBar, type LoggedWin } from "./win-capture-bar";
import { CoverageMeter } from "./coverage-meter";
import { WIN_TAG_OPTIONS, type WinTag } from "@/lib/constants/careerotter";
import { reviewCountdown } from "@/lib/careerotter/review-countdown";

const TAG_LABEL: Record<WinTag, string> = Object.fromEntries(
  WIN_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<WinTag, string>;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The "Today" evidence surface: review countdown, case coverage, the capture
 * bar, and the wins log. All client-side so a logged or deleted win updates the
 * coverage meter instantly without a refetch.
 */
export function WinsBoard({
  initialWins,
  reviewDate,
}: {
  initialWins: LoggedWin[];
  reviewDate: string | null;
}) {
  const [wins, setWins] = useState<LoggedWin[]>(initialWins);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const countdown = reviewCountdown(reviewDate, new Date());

  function handleLogged(win: LoggedWin) {
    setWins((prev) => [win, ...prev]);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/wins/${id}`, { method: "DELETE" });
      if (res.ok) setWins((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {countdown && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <span className="text-2xl font-bold tabular-nums">
            {countdown.isPast ? "—" : countdown.weeks || countdown.days}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {countdown.isPast ? "" : countdown.weeks ? "wk" : "days"}
            </span>
          </span>
          <span className="text-sm text-muted-foreground">{countdown.label}</span>
        </div>
      )}

      <CoverageMeter wins={wins} />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Log a win</h3>
        <WinCaptureBar onLogged={handleLogged} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          Your wins{" "}
          <span className="font-normal text-muted-foreground">
            ({wins.length})
          </span>
        </h3>
        {wins.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing logged yet. What did you ship this week?
          </p>
        ) : (
          <ul className="space-y-2">
            {wins.map((win) => (
              <li key={win.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm leading-relaxed">{win.text}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {win.tag && (
                          <span className="rounded-full border px-2 py-0.5">
                            {TAG_LABEL[win.tag]}
                          </span>
                        )}
                        <span>{formatDate(win.created_at)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Delete win"
                      disabled={deletingId === win.id}
                      onClick={() => handleDelete(win.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
