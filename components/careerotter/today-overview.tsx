import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, MessageSquareText, DollarSign, FileText, Briefcase, ArrowRight } from "lucide-react";
import { CoverageMeter } from "@/components/careerotter/coverage-meter";
import { reviewCountdown } from "@/lib/careerotter/review-countdown";
import type { Application } from "@/types";

/**
 * "Today" — the CareerOtter career home (redesign Screen B, v1). Review
 * countdown, case coverage, a quick path to log a win, a job-search summary that
 * links out to the tracker, and quick links to the rest of the loop. The wins
 * log itself lives on /dashboard/wins.
 */
export function TodayOverview({
  wins,
  reviewDate,
  applications,
}: {
  wins: ReadonlyArray<{ tag: string | null }>;
  reviewDate: string | null;
  applications: Application[];
}) {
  const countdown = reviewCountdown(reviewDate, new Date());

  const interviewing = applications.filter(
    (a) => a.status === "Interview Scheduled" || a.status === "Interviewed"
  ).length;
  const offers = applications.filter((a) => a.status === "Offer").length;

  const quickLinks = [
    { href: "/dashboard/coach", label: "Coach", icon: MessageSquareText },
    { href: "/dashboard/comp", label: "Comp", icon: DollarSign },
    { href: "/dashboard/review-prep", label: "Review prep", icon: FileText },
  ];

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

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href="/dashboard/wins">
            <Trophy className="mr-2 h-4 w-4" />
            Log a win
          </Link>
        </Button>
        {quickLinks.map((l) => (
          <Button key={l.href} asChild variant="outline">
            <Link href={l.href}>
              <l.icon className="mr-2 h-4 w-4" />
              {l.label}
            </Link>
          </Button>
        ))}
      </div>

      {/* Job search summary — the tracker lives under Job search now. */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            Job search
          </div>
          <div className="text-sm text-muted-foreground">
            {applications.length} applications
            {interviewing > 0 && <span> · {interviewing} interviewing</span>}
            {offers > 0 && <span> · {offers} offers</span>}
          </div>
          <Link
            href="/dashboard/applications"
            className="ml-auto inline-flex items-center text-sm font-semibold text-primary hover:underline"
          >
            Open Job search
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
