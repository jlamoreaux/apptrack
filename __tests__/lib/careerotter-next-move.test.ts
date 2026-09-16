/**
 * The next-move ranking: which single action Today asks for, given a user's
 * state. Order is the whole design here, so most of these tests are about a
 * higher-priority rule correctly beating a lower one.
 */

// @jest-environment node

import {
  daysSinceLastWin,
  nextMove,
  MIN_CASE_WINS,
  RECENT_HIRE_DAYS,
  REVIEW_SOON_DAYS,
  STALE_WIN_DAYS,
  type NextMoveInput,
} from "@/lib/careerotter/next-move";
import { COVERAGE_TARGET_PER_AREA } from "@/lib/careerotter/coverage";
import { WIN_TAGS } from "@/lib/constants/careerotter";

const NOW = new Date("2026-06-15T12:00:00Z");

/** An ISO timestamp `days` before NOW. */
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

/** A YYYY-MM-DD date `days` from NOW. */
const dateIn = (days: number) =>
  new Date(NOW.getTime() + days * 86_400_000).toISOString().slice(0, 10);

const win = (tag: string | null, days = 1) => ({ tag, created_at: daysAgo(days) });

/** Enough wins in every area for full coverage, all logged yesterday. */
const fullCoverageWins = WIN_TAGS.flatMap((tag) =>
  Array.from({ length: COVERAGE_TARGET_PER_AREA }, () => win(tag))
);

function input(overrides: Partial<NextMoveInput> = {}): NextMoveInput {
  return {
    mode: "promotion",
    reviewDate: dateIn(120),
    zeroToCaseCompleted: true,
    wins: [win("delivery")],
    hasCompEntry: true,
    recentHire: null,
    activeApplications: 0,
    now: NOW,
    ...overrides,
  };
}

describe("daysSinceLastWin", () => {
  it("is null for an empty log", () => {
    expect(daysSinceLastWin([], NOW)).toBeNull();
  });

  it("uses the newest win, not the first in the array", () => {
    const wins = [{ created_at: daysAgo(30) }, { created_at: daysAgo(2) }];
    expect(daysSinceLastWin(wins, NOW)).toBe(2);
  });

  it("ignores unparseable timestamps", () => {
    const wins = [{ created_at: "not a date" }, { created_at: daysAgo(4) }];
    expect(daysSinceLastWin(wins, NOW)).toBe(4);
  });

  it("clamps a future timestamp to zero rather than going negative", () => {
    expect(daysSinceLastWin([{ created_at: daysAgo(-5) }], NOW)).toBe(0);
  });
});

describe("nextMove onboarding rules", () => {
  it("sends a brand-new user to Zero to Case", () => {
    const move = nextMove(input({ wins: [], zeroToCaseCompleted: false }));
    expect(move.id).toBe("start_case");
    expect(move.action).toEqual({
      kind: "link",
      href: "/dashboard/start",
      cta: "Start your case",
    });
  });

  it("asks for a first win once onboarding is done", () => {
    const move = nextMove(input({ wins: [], zeroToCaseCompleted: true }));
    expect(move.id).toBe("first_win");
    expect(move.action.kind).toBe("capture");
  });

  it("prefers the on-ramp over the review deadline for an empty log", () => {
    const move = nextMove(
      input({ wins: [], zeroToCaseCompleted: false, reviewDate: dateIn(3) })
    );
    expect(move.id).toBe("start_case");
  });
});

describe("nextMove after a hire", () => {
  const recentHire = { company: "Globex", role: "Staff Engineer" };

  it("asks a new hire to set up the new role when no live date is left", () => {
    const move = nextMove(input({ recentHire, reviewDate: null }));
    expect(move.id).toBe("new_role");
    expect(move.action.kind).toBe("goal");
    expect(move.detail).toContain("Globex");
    expect(move.detail).toContain("Staff Engineer");
  });

  it("supersedes the generic 'review date passed' prompt", () => {
    const move = nextMove(input({ recentHire, reviewDate: dateIn(-10) }));
    expect(move.id).toBe("new_role");
  });

  it("stays quiet once the new frame has a future date", () => {
    const move = nextMove(input({ recentHire, reviewDate: dateIn(120) }));
    expect(move.id).not.toBe("new_role");
  });
});

describe("nextMove deadline rules", () => {
  it("asks for the review doc inside the window with enough wins", () => {
    const wins = Array.from({ length: MIN_CASE_WINS }, () => win("delivery"));
    const move = nextMove(input({ reviewDate: dateIn(REVIEW_SOON_DAYS - 1), wins }));
    expect(move.id).toBe("draft_review_doc");
    expect(move.action).toEqual({
      kind: "link",
      href: "/dashboard/review-prep",
      cta: "Draft it",
    });
  });

  it("does not ask for a doc there is not enough evidence to write", () => {
    const wins = Array.from({ length: MIN_CASE_WINS - 1 }, () => win("delivery"));
    const move = nextMove(input({ reviewDate: dateIn(2), wins }));
    expect(move.id).not.toBe("draft_review_doc");
  });

  it("asks for a new date once the old one passes", () => {
    const move = nextMove(input({ reviewDate: dateIn(-1) }));
    expect(move.id).toBe("review_passed");
    expect(move.action.kind).toBe("goal");
  });

  it("asks for a date when there is none", () => {
    const move = nextMove(input({ reviewDate: null }));
    expect(move.id).toBe("set_review_date");
    expect(move.title).toContain("review date");
  });

  it("calls it a target date in job-search mode", () => {
    const move = nextMove(
      input({ mode: "job_search", reviewDate: null, activeApplications: 2 })
    );
    expect(move.id).toBe("set_review_date");
    expect(move.title).toContain("target date");
  });
});

describe("nextMove habit and coverage rules", () => {
  it("flags a log that has gone quiet, and says how quiet", () => {
    const move = nextMove(input({ wins: [win("delivery", STALE_WIN_DAYS + 4)] }));
    expect(move.id).toBe("stale_log");
    expect(move.detail).toContain(`${STALE_WIN_DAYS + 4} days`);
    expect(move.action.kind).toBe("capture");
  });

  it("leaves a log alone one day short of stale", () => {
    const move = nextMove(input({ wins: [win("delivery", STALE_WIN_DAYS - 1)] }));
    expect(move.id).not.toBe("stale_log");
  });

  it("names the thinnest impact area", () => {
    const wins = [
      ...Array.from({ length: COVERAGE_TARGET_PER_AREA }, () => win("delivery")),
      win("leadership"),
      win("collaboration"),
    ];
    const move = nextMove(input({ wins }));
    expect(move.id).toBe("close_gap");
    expect(move.title).toBe("Log a craft win");
  });

  it("asks for comp once every area is covered", () => {
    const move = nextMove(input({ wins: fullCoverageWins, hasCompEntry: false }));
    expect(move.id).toBe("add_comp");
    expect(move.action).toEqual({
      kind: "link",
      href: "/dashboard/comp",
      cta: "Add your comp",
    });
  });

  it("falls through to the coach when there is nothing missing", () => {
    const move = nextMove(input({ wins: fullCoverageWins, hasCompEntry: true }));
    expect(move.id).toBe("pressure_test");
    expect(move.action).toEqual({
      kind: "link",
      href: "/dashboard/coach",
      cta: "Ask the coach",
    });
  });
});

describe("nextMove job-search rules", () => {
  it("asks a job seeker with an empty pipeline for an application", () => {
    const move = nextMove(input({ mode: "job_search", activeApplications: 0 }));
    expect(move.id).toBe("add_application");
    expect(move.action).toEqual({
      kind: "link",
      href: "/dashboard/add",
      cta: "Add an application",
    });
  });

  it("does not ask users in other modes to add applications", () => {
    const move = nextMove(input({ mode: "promotion", activeApplications: 0 }));
    expect(move.id).not.toBe("add_application");
  });

  it("stops asking once the pipeline has something in it", () => {
    const move = nextMove(input({ mode: "job_search", activeApplications: 1 }));
    expect(move.id).not.toBe("add_application");
  });
});

describe("nextMove is total", () => {
  it("returns a move for every combination of the boolean-ish inputs", () => {
    for (const mode of ["promotion", "raise", "job_search"] as const) {
      for (const reviewDate of [null, dateIn(-5), dateIn(5), dateIn(200)]) {
        for (const wins of [[], [win("delivery")], fullCoverageWins]) {
          for (const zeroToCaseCompleted of [true, false]) {
            for (const hasCompEntry of [true, false]) {
              for (const recentHire of [
                null,
                { company: "Acme", role: "Engineer" },
              ]) {
                const move = nextMove(
                  input({
                    mode,
                    reviewDate,
                    wins,
                    zeroToCaseCompleted,
                    hasCompEntry,
                    recentHire,
                  })
                );
                expect(move.title.length).toBeGreaterThan(0);
                expect(move.detail.length).toBeGreaterThan(0);
                expect(move.action.cta.length).toBeGreaterThan(0);
              }
            }
          }
        }
      }
    }
  });

  it("exposes a recent-hire window the dashboard can filter on", () => {
    expect(RECENT_HIRE_DAYS).toBeGreaterThan(0);
  });
});
