/**
 * "Your next move" — the single thing Today asks the user for.
 *
 * Ranks the user's state and returns exactly one move, with the reason it is the
 * move. Pure and total: it always returns something, so Today never renders an
 * empty prompt.
 *
 * Order is deliberate. A dated deadline beats the logging habit; a dead log
 * beats a coverage gap; a coverage gap beats polish. Ties go to the cheaper
 * action.
 */

import { computeCoverage } from "./coverage";
import type { RecentHire } from "./recent-hire";
import { reviewCountdown } from "./review-countdown";
import {
  CAREER_MODE_GOAL_LABEL,
  WIN_TAG_OPTIONS,
  type CareerMode,
  type WinTag,
} from "@/lib/constants/careerotter";

/** Within this many days of the review, writing the doc outranks everything. */
export const REVIEW_SOON_DAYS = 21;

/** A log this quiet has stopped being a log. */
export const STALE_WIN_DAYS = 10;

/** Mirrors MIN_WINS in app/api/careerotter/case/route.ts — below this the case builder refuses. */
export const MIN_CASE_WINS = 3;

export type NextMoveId =
  | "start_case"
  | "first_win"
  | "new_role"
  | "draft_review_doc"
  | "review_passed"
  | "add_application"
  | "stale_log"
  | "set_review_date"
  | "close_gap"
  | "add_comp"
  | "pressure_test";

/**
 * How the move is carried out. "capture" and "goal" are handled in-page by
 * Today (focus the capture bar, open the goal editor) rather than navigating,
 * because both are ten-second actions that shouldn't cost a page load.
 */
export type NextMoveAction =
  | { kind: "link"; href: string; cta: string }
  | { kind: "capture"; cta: string }
  | { kind: "goal"; cta: string };

export interface NextMove {
  id: NextMoveId;
  title: string;
  detail: string;
  action: NextMoveAction;
}

/**
 * The only two fields of a win the ranking needs: which area it evidences and
 * when it was logged. Today fetches the full text for the handful of rows it
 * lists and this projection for the rest.
 */
export interface WinSummary {
  tag: string | null;
  created_at: string;
}

export interface NextMoveInput {
  mode: CareerMode | null;
  /** YYYY-MM-DD, as stored on career_profiles. */
  reviewDate: string | null;
  zeroToCaseCompleted: boolean;
  wins: ReadonlyArray<WinSummary>;
  hasCompEntry: boolean;
  /**
   * A job marked Hired inside the recent-hire window, if any (see
   * lib/careerotter/recent-hire.ts). Landing the job starts the case for the
   * next one, so it earns a move of its own.
   */
  recentHire: RecentHire | null;
  /** Applications that aren't archived, rejected, or closed out. */
  activeApplications: number;
  now: Date;
}

const TAG_LABEL: Record<WinTag, string> = Object.fromEntries(
  WIN_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<WinTag, string>;

/** What the tagged area is evidence *of*, for copy that explains the gap. */
const TAG_EVIDENCE: Record<WinTag, string> = {
  delivery: "something you shipped and what it moved",
  leadership: "a call you made, or someone you unblocked",
  collaboration: "work that crossed a team boundary",
  craft: "something you made better that nobody asked you to",
};

/** Whole days between two instants, rounded down. Never negative. */
function daysSince(then: Date, now: Date): number {
  const ms = now.getTime() - then.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 86_400_000);
}

/** Most recent win's age in days, or null for an empty log. */
export function daysSinceLastWin(
  wins: ReadonlyArray<{ created_at: string }>,
  now: Date
): number | null {
  let newest = -Infinity;
  for (const w of wins) {
    const t = new Date(w.created_at).getTime();
    if (Number.isFinite(t) && t > newest) newest = t;
  }
  if (newest === -Infinity) return null;
  return daysSince(new Date(newest), now);
}

export function nextMove(input: NextMoveInput): NextMove {
  const { wins, now, mode } = input;
  const isJobSearch = mode === "job_search";
  const countdown = reviewCountdown(input.reviewDate, now, {
    noun: isJobSearch ? "Target" : "Review",
  });
  const dateNoun = isJobSearch ? "target date" : "review date";
  // The mode comes from a CHECK-constrained column, but fall back rather than
  // interpolate "undefined" into user-facing copy if that ever changes.
  const goalLabel =
    (mode && CAREER_MODE_GOAL_LABEL[mode]) || CAREER_MODE_GOAL_LABEL.promotion;

  // 1. An empty log and no starter case: three questions beat a blank page.
  if (wins.length === 0 && !input.zeroToCaseCompleted) {
    return {
      id: "start_case",
      title: "Start your case",
      detail:
        "Three questions, about two minutes. You leave with a real first draft instead of an empty log.",
      action: { kind: "link", href: "/dashboard/start", cta: "Start your case" },
    };
  }

  // 2. Onboarded, but nothing logged since. The habit is the whole product.
  if (wins.length === 0) {
    return {
      id: "first_win",
      title: "Log your first win",
      detail:
        "One line about something you shipped. Raw notes are fine — you're writing it for the version of you sitting in a review.",
      action: { kind: "capture", cta: "Log a win" },
    };
  }

  // 3. Just started somewhere new. The old countdown is meaningless and the new
  // clock is already running — a first review is the cheapest one to walk into
  // prepared. Only fires while there's no live date, so it can't nag someone
  // who has already reset their frame.
  if (input.recentHire && (!countdown || countdown.isPast)) {
    return {
      id: "new_role",
      title: "Set up your new role",
      detail: `You marked ${input.recentHire.role} at ${input.recentHire.company} as hired. Put in your new title and your first review date — starting the log on day one is how you walk into that review with a case instead of a memory.`,
      action: { kind: "goal", cta: "Set up your new role" },
    };
  }

  // 4. A dated deadline outranks everything else, once there's enough to write from.
  if (
    countdown &&
    !countdown.isPast &&
    countdown.days <= REVIEW_SOON_DAYS &&
    wins.length >= MIN_CASE_WINS
  ) {
    return {
      id: "draft_review_doc",
      title: "Draft your review doc",
      detail: `${countdown.label}. You have ${wins.length} wins logged — enough to write from. Draft it now so you're editing next week, not starting.`,
      action: { kind: "link", href: "/dashboard/review-prep", cta: "Draft it" },
    };
  }

  // 5. The date went by. Whether it happened or slipped, the frame needs a new one.
  if (countdown?.isPast) {
    return {
      id: "review_passed",
      title: `Set your next ${dateNoun}`,
      detail: `Your ${dateNoun} has passed. Put the next one in — coverage and the countdown only mean something against a date.`,
      action: { kind: "goal", cta: `Set a ${dateNoun}` },
    };
  }

  // 6. Job hunting with nothing in the pipeline is a bigger hole than a quiet log.
  if (isJobSearch && input.activeApplications === 0) {
    return {
      id: "add_application",
      title: "Add an application",
      detail:
        "Nothing active in your pipeline. Tracking is free and unlimited, and every application you log is something the coach can work with.",
      action: { kind: "link", href: "/dashboard/add", cta: "Add an application" },
    };
  }

  // 7. The log has gone quiet. This is the failure mode that kills the case.
  const stale = daysSinceLastWin(wins, now);
  if (stale !== null && stale >= STALE_WIN_DAYS) {
    return {
      id: "stale_log",
      title: "Catch up your log",
      detail: `Nothing logged in ${stale} days. That's ${stale} days of work you'll be trying to remember later. One line each is enough.`,
      action: { kind: "capture", cta: "Log a win" },
    };
  }

  // 8. No deadline at all — coverage is a number without a date to aim it at.
  if (!countdown) {
    return {
      id: "set_review_date",
      title: `Set your ${dateNoun}`,
      detail: `You're logging, which is the hard part. Add the date you're working toward and everything here starts counting down to it.`,
      action: { kind: "goal", cta: `Set a ${dateNoun}` },
    };
  }

  // 9. The gap a manager will find in the case.
  const coverage = computeCoverage(wins);
  if (coverage.biggestGap) {
    const gap = coverage.biggestGap;
    return {
      id: "close_gap",
      title: `Log a ${TAG_LABEL[gap].toLowerCase()} win`,
      detail: `Your case is ${coverage.overallPct}% built and thinnest on ${TAG_LABEL[gap].toLowerCase()}. Log ${TAG_EVIDENCE[gap]} — that's the gap someone will push on.`,
      action: { kind: "capture", cta: `Log ${TAG_LABEL[gap].toLowerCase()}` },
    };
  }

  // 10. Evidence in every area, but no number behind the ask.
  if (!input.hasCompEntry) {
    return {
      id: "add_comp",
      title: "Add your comp",
      detail: `Your case covers every area. ${
        isJobSearch ? "An offer" : "The ask"
      } needs a number behind it — add what you're paid now and see where it sits against the market.`,
      action: { kind: "link", href: "/dashboard/comp", cta: "Add your comp" },
    };
  }

  // 11. Everything's in place. Go break it before your manager does.
  return {
    id: "pressure_test",
    title: "Pressure-test your case",
    detail: `${countdown.label}, ${coverage.overallPct}% coverage, comp on file. Ask the coach where the case for ${goalLabel} is weakest and fix that.`,
    action: { kind: "link", href: "/dashboard/coach", cta: "Ask the coach" },
  };
}
