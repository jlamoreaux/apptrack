"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, Pencil } from "lucide-react";
import { CoverageMeter } from "@/components/careerotter/coverage-meter";
import { GoalEditor, type CareerGoal } from "@/components/careerotter/goal-editor";
import { NextMoveCard } from "@/components/careerotter/next-move-card";
import { RecentWins } from "@/components/careerotter/recent-wins";
import {
  WeeklyRecapCard,
  type WeeklyRecap,
} from "@/components/careerotter/weekly-recap-card";
import { WinCaptureBar, type LoggedWin } from "@/components/careerotter/win-capture-bar";
import { nextMove } from "@/lib/careerotter/next-move";
import { reviewCountdown } from "@/lib/careerotter/review-countdown";
import { weekStartMs } from "@/lib/careerotter/week-start";
import type { JobSearchSummary } from "@/lib/careerotter/job-search-summary";

/**
 * "Today" — the career home.
 *
 * It used to be a read-only report: a countdown, a coverage bar, and four
 * buttons that repeated the nav. Worse, it was a strict subset of
 * /dashboard/wins, so there was nothing here you couldn't do better one click
 * away. It now leads with one computed next move, puts the capture bar in
 * reach, and shows the user their own recent work — the weekly recap, which the
 * Friday cron has always generated and no screen ever displayed, included.
 *
 * Client-side so logging a win updates the coverage meter, the recent list, and
 * the next move at once, without a round trip.
 */
export function TodayOverview({
  goal: initialGoal,
  zeroToCaseCompleted,
  initialWins,
  recap,
  hasCompEntry,
  recentHire,
  jobSearch,
}: {
  goal: CareerGoal;
  zeroToCaseCompleted: boolean;
  initialWins: LoggedWin[];
  recap: WeeklyRecap | null;
  hasCompEntry: boolean;
  recentHire: { company: string; role: string } | null;
  jobSearch: JobSearchSummary;
}) {
  const [goal, setGoal] = useState(initialGoal);
  const [wins, setWins] = useState(initialWins);
  const [goalOpen, setGoalOpen] = useState(false);
  const captureInput = useRef<HTMLInputElement>(null);

  // ?setup=role opens the goal editor straight away. The hire modal on an
  // application links here, so "I got the job" lands on setting up the new one.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("setup") === "role") setGoalOpen(true);
  }, [searchParams]);

  // One timestamp for the whole render: the countdown and the staleness check
  // must not disagree by a few milliseconds mid-pass.
  const [now] = useState(() => new Date());

  const countdown = reviewCountdown(goal.review_date, now);
  const isJobSearch = goal.mode === "job_search";

  const move = useMemo(
    () =>
      nextMove({
        mode: goal.mode,
        reviewDate: goal.review_date,
        zeroToCaseCompleted,
        wins,
        hasCompEntry,
        recentHire,
        activeApplications: jobSearch.active,
        now,
      }),
    [
      goal.mode,
      goal.review_date,
      zeroToCaseCompleted,
      wins,
      hasCompEntry,
      recentHire,
      jobSearch.active,
      now,
    ]
  );

  const winsThisWeek = useMemo(() => {
    const monday = weekStartMs(now);
    return wins.filter((w) => new Date(w.created_at).getTime() >= monday).length;
  }, [wins, now]);

  function focusCapture() {
    captureInput.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    captureInput.current?.focus({ preventScroll: true });
  }

  // "Senior Software Engineer → Staff Engineer · Review in 7 weeks", using
  // whichever parts are actually set.
  const roleLine = [goal.level, goal.role].filter(Boolean).join(" ");
  const ambition = goal.target
    ? roleLine
      ? `${roleLine} → ${goal.target}`
      : `Aiming for ${goal.target}`
    : roleLine;
  const goalParts = [ambition || null, countdown?.label ?? null].filter(
    Boolean
  ) as string[];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Today</h1>
          <GoalEditor
            goal={goal}
            onSaved={setGoal}
            open={goalOpen}
            onOpenChange={setGoalOpen}
            trigger={
              <Button variant="ghost" size="sm" className="min-h-[44px]">
                <Pencil className="mr-2 h-4 w-4" />
                {goalParts.length > 0 ? "Edit goal" : "Set your goal"}
              </Button>
            }
          />
        </div>
        <p className="text-sm text-muted-foreground sm:text-base">
          {goalParts.length > 0
            ? goalParts.join(" · ")
            : `No goal set yet. Name what you're working toward and everything here aims at it.`}
        </p>
      </header>

      <NextMoveCard move={move} onCapture={focusCapture} onEditGoal={() => setGoalOpen(true)} />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Log a win</h3>
        <WinCaptureBar
          inputRef={captureInput}
          onLogged={(win) => setWins((prev) => [win, ...prev])}
        />
      </div>

      <WeeklyRecapCard recap={recap} winsThisWeek={winsThisWeek} now={now} />

      <RecentWins wins={wins} />

      <CoverageMeter wins={wins} />

      {(jobSearch.total > 0 || isJobSearch) && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Job search
            </div>
            <div className="text-sm text-muted-foreground">
              {jobSearch.total === 0 ? (
                "Nothing tracked yet"
              ) : (
                <>
                  {jobSearch.total} application{jobSearch.total === 1 ? "" : "s"}
                  {jobSearch.interviewing > 0 && <span> · {jobSearch.interviewing} interviewing</span>}
                  {jobSearch.offers > 0 && <span> · {jobSearch.offers} offers</span>}
                </>
              )}
            </div>
            <Link
              href={jobSearch.total === 0 ? "/dashboard/add" : "/dashboard/applications"}
              className="ml-auto inline-flex items-center text-sm font-semibold text-primary hover:underline"
            >
              {jobSearch.total === 0 ? "Add an application" : "Open Job search"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
