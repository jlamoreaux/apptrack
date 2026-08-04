/**
 * Coach eval set (M3, required before ship). Ten synthetic user profiles across
 * a range of win density and gap patterns, each with a question and graded
 * expectations. The runner (evaluateCoachOutput) grades a generated reply
 * against a profile; re-run on every prompt change.
 *
 * Live grading calls the model, so it is not a unit test (cost + nondeterminism).
 * Unit tests assert the SET's shape and the GRADER's logic. Run the live eval
 * with a script that feeds each profile through buildCoachSystemPrompt + the
 * model and reports pass rate.
 */

import type { CoachProfile, CoachWin } from "./coach-prompt";
import { findBannedConstructions } from "@/lib/ai/voice-check";

export interface CoachEvalProfile {
  id: string;
  profile: CoachProfile;
  wins: CoachWin[];
  question: string;
  expect: {
    /** Reply should cite the user's actual win content (when they have wins). */
    referencesWin: boolean;
    /** Reply should end with / contain a concrete next step. */
    includesNextAction: boolean;
    /** When wins are empty, reply should say what to log rather than invent. */
    asksForMissingData?: boolean;
  };
}

const win = (text: string, tag: CoachWin["tag"], impact?: string): CoachWin => ({
  text,
  tag,
  impact_number: impact ?? null,
});

export const COACH_EVAL_PROFILES: CoachEvalProfile[] = [
  {
    id: "strong-delivery-no-leadership",
    profile: { mode: "promotion", role: "Senior Engineer", review_date: "2026-09-14" },
    wins: [
      win("Shipped billing migration two weeks early", "delivery", "2 weeks early"),
      win("Cut review-queue p95 from 4d to 26h", "delivery", "4d to 26h"),
      win("Fixed the flaky deploy pipeline", "delivery"),
    ],
    question: "What's the weakest part of my case?",
    expect: { referencesWin: true, includesNextAction: true },
  },
  {
    id: "empty-log",
    profile: { mode: "raise", role: "PM" },
    wins: [],
    question: "Am I ready to ask for a raise?",
    expect: { referencesWin: false, includesNextAction: true, asksForMissingData: true },
  },
  {
    id: "balanced-case",
    profile: { mode: "promotion", role: "Staff Engineer", review_date: "2026-08-01" },
    wins: [
      win("Led the postmortem for the Q2 outage", "leadership"),
      win("Mentored two juniors to first ships", "leadership"),
      win("Unblocked the data team's schema review", "collaboration"),
      win("Shipped the search rewrite", "delivery", "30% faster"),
      win("Set the code-review standard doc", "craft"),
    ],
    question: "Draft my 1:1 talking points for this week",
    expect: { referencesWin: true, includesNextAction: true },
  },
  {
    id: "one-win-only",
    profile: { mode: "promotion", role: "Designer" },
    wins: [win("Redesigned onboarding, activation up 12%", "delivery", "+12%")],
    question: "How strong is my case?",
    expect: { referencesWin: true, includesNextAction: true },
  },
  {
    id: "collaboration-heavy",
    profile: { mode: "raise", role: "EM", review_date: "2026-10-01" },
    wins: [
      win("Brokered the platform/product roadmap conflict", "collaboration"),
      win("Ran cross-team incident review", "collaboration"),
      win("Aligned three teams on the API contract", "collaboration"),
    ],
    question: "What gap should I close before my review?",
    expect: { referencesWin: true, includesNextAction: true },
  },
  {
    id: "craft-heavy",
    profile: { mode: "promotion", role: "Senior Engineer" },
    wins: [
      win("Wrote the testing guide the team adopted", "craft"),
      win("Refactored the auth module, halved its size", "craft", "-50% LOC"),
    ],
    question: "Am I ready to ask?",
    expect: { referencesWin: true, includesNextAction: true },
  },
  {
    id: "job-search-mode",
    profile: { mode: "job_search", role: "Backend Engineer" },
    wins: [win("Owned the payments service end to end", "delivery")],
    question: "How do I talk about my impact in interviews?",
    expect: { referencesWin: true, includesNextAction: true },
  },
  {
    id: "review-imminent",
    profile: { mode: "promotion", role: "Senior PM", review_date: "2026-07-25" },
    wins: [
      win("Launched the pricing experiment, +8% conversion", "delivery", "+8%"),
      win("Recovered the stalled partner integration", "collaboration"),
    ],
    question: "My review is in a week. What do I lead with?",
    expect: { referencesWin: true, includesNextAction: true },
  },
  {
    id: "high-volume-one-area",
    profile: { mode: "promotion", role: "Data Engineer" },
    wins: Array.from({ length: 8 }, (_, i) => win(`Shipped pipeline task ${i + 1}`, "delivery")),
    question: "What's missing from my case?",
    expect: { referencesWin: true, includesNextAction: true },
  },
  {
    id: "no-review-date",
    profile: { mode: "raise", role: "Engineer" },
    wins: [
      win("Reduced infra cost 20%", "delivery", "-20%"),
      win("Onboarded the new hire", "leadership"),
    ],
    question: "Should I ask now or wait?",
    expect: { referencesWin: true, includesNextAction: true },
  },
];

// Verbs that signal a concrete next step.
const NEXT_ACTION_HINTS = [
  "log", "add", "ask", "take", "run", "draft", "write", "own", "lead",
  "close", "bring", "do ", "put ", "record", "before your review", "this week",
  "next", "start",
];

export interface CoachEvalResult {
  id: string;
  passed: boolean;
  issues: string[];
}

/**
 * Grade a generated reply against a profile's expectations. Deterministic
 * heuristics only (voice cleanliness, next-action presence, win grounding).
 */
export function evaluateCoachOutput(
  profileCase: CoachEvalProfile,
  reply: string
): CoachEvalResult {
  const issues: string[] = [];
  const lower = reply.toLowerCase();

  const voice = findBannedConstructions(reply);
  if (voice.length > 0) {
    issues.push(`voice: ${voice.map((v) => v.rule).join(", ")}`);
  }

  if (profileCase.expect.includesNextAction) {
    if (!NEXT_ACTION_HINTS.some((h) => lower.includes(h))) {
      issues.push("no next action");
    }
  }

  if (profileCase.expect.referencesWin && profileCase.wins.length > 0) {
    // A loose grounding check: the reply should echo a distinctive word from
    // at least one logged win.
    const grounded = profileCase.wins.some((w) => {
      const keyword = w.text
        .toLowerCase()
        .split(/\W+/)
        .find((word) => word.length >= 5);
      return keyword ? lower.includes(keyword) : false;
    });
    if (!grounded) issues.push("does not reference a logged win");
  }

  if (profileCase.expect.asksForMissingData) {
    if (!/(log|add|capture|start logging|haven'?t logged|no wins)/i.test(reply)) {
      issues.push("empty log: did not ask for missing data");
    }
  }

  return { id: profileCase.id, passed: issues.length === 0, issues };
}
