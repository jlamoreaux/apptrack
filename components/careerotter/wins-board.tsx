"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { WinCaptureBar, type LoggedWin } from "./win-capture-bar";
import { WinTagSelect } from "./win-tag-select";
import { CoverageMeter } from "./coverage-meter";
import { reviewCountdown } from "@/lib/careerotter/review-countdown";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The wins log: review countdown, case coverage, the capture bar, and every
 * win. Each win's area is editable in place, because wins seeded at onboarding
 * arrive with none and count toward no area until someone sets one. All
 * client-side so a logged, retagged or deleted win updates the coverage meter
 * instantly without a refetch.
 */
export function WinsBoard({
  initialWins,
  reviewDate,
}: {
  initialWins: LoggedWin[];
  reviewDate: string | null;
}) {
  const [wins, setWins] = useState<LoggedWin[]>(initialWins);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const countdown = reviewCountdown(reviewDate, new Date());

  function handleLogged(win: LoggedWin) {
    setWins((prev) => [win, ...prev]);
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/wins/${id}`, { method: "DELETE" });
      if (res.ok) setWins((prev) => prev.filter((w) => w.id !== id));
      else setError("Could not delete that win. Try again.");
    } catch {
      setError("Could not delete that win. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRetag(id: string, tag: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/wins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: tag || null }),
      });
      if (res.ok) {
        const { win } = await res.json();
        setWins((prev) => prev.map((w) => (w.id === id ? { ...w, ...win } : w)));
      } else {
        setError("Could not update that win's area. Try again.");
      }
    } catch {
      setError("Could not update that win's area. Try again.");
    } finally {
      setBusyId(null);
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
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
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
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm leading-relaxed">{win.text}</p>
                      {win.impact_number && (
                        <p className="text-xs text-muted-foreground">{win.impact_number}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-full sm:w-44">
                          <WinTagSelect
                            value={win.tag ?? ""}
                            onValueChange={(tag) => handleRetag(win.id, tag)}
                            disabled={busyId === win.id}
                            placeholder="Add an area"
                            ariaLabel={`Impact area for: ${win.text}`}
                            className="min-h-[44px] w-full text-xs"
                          />
                        </div>
                        <span>{formatDate(win.created_at)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] min-w-[44px] shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Delete win"
                      disabled={busyId === win.id}
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
