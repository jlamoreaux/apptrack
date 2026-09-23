import { MONTHS_PER_YEAR } from "@/lib/constants/dates";

/**
 * CareerOtter Phase 2 (M2) shared constants — single source of truth mirrored by
 * the SQL CHECK lists in schemas/migrations/032_careerotter_evidence.sql and
 * 044_mcp_agent_access.sql (wins.source, comp_entries.source, external_ref and
 * evidence_url lengths). Keep these in sync; __tests__ guards against drift.
 */

// The onboarding fork (RFC §2): one question routes the experience. Same data
// model underneath, different UI emphasis.
export const CAREER_MODES = ["promotion", "raise", "job_search"] as const;
export type CareerMode = (typeof CAREER_MODES)[number];

export const CAREER_MODE_OPTIONS: { value: CareerMode; label: string }[] = [
  { value: "promotion", label: "A promotion" },
  { value: "raise", label: "A raise" },
  { value: "job_search", label: "A new job" },
];

// The goal named in prose ("the case for a promotion"). Mirrors the phrasing the
// coach and case prompts use, so in-app copy and generated documents agree.
export const CAREER_MODE_GOAL_LABEL: Record<CareerMode, string> = {
  promotion: "a promotion",
  raise: "a raise",
  job_search: "a better role",
};

// The noun a date countdown leads with: job search works toward a target date,
// not a performance review.
export const CAREER_MODE_COUNTDOWN_NOUN: Record<CareerMode, string> = {
  promotion: "Review",
  raise: "Review",
  job_search: "Target",
};

// Fields on career_profiles the user can edit after onboarding (the goal
// editor). `mode` is included: people change what they're aiming at.
export const CAREER_PROFILE_LIMITS = {
  roleMax: 120,
  levelMax: 60,
  targetMax: 300,
} as const;

// The four impact areas the coverage meter balances. Order is the display order.
export const WIN_TAGS = [
  "delivery",
  "leadership",
  "collaboration",
  "craft",
] as const;
export type WinTag = (typeof WIN_TAGS)[number];

// `hint` is what a win in that area is evidence of, in the user's terms. It is
// shown beside the area wherever the user picks one, and reused by Today's
// "close the gap" copy, so the two never describe an area differently.
export const WIN_TAG_OPTIONS: { value: WinTag; label: string; hint: string }[] = [
  { value: "delivery", label: "Delivery", hint: "Something you shipped and what it moved" },
  { value: "leadership", label: "Leadership", hint: "A call you made, or someone you unblocked" },
  { value: "collaboration", label: "Collaboration", hint: "Work that crossed a team boundary" },
  { value: "craft", label: "Craft", hint: "Something you made better that nobody asked you to" },
];

// Where a win came from (provenance). "manual" is the capture bar; "agent" is
// a write through the MCP server, which may only edit or delete its own rows.
export const WIN_SOURCES = [
  "manual",
  "recap",
  "zero_to_case",
  "import",
  "agent",
] as const;
export type WinSource = (typeof WIN_SOURCES)[number];

// Where a comp entry came from, with the same agent-owns-its-rows rule as wins.
export const COMP_SOURCES = ["manual", "agent"] as const;
export type CompSource = (typeof COMP_SOURCES)[number];

// Length caps shared by wins and comp_entries, mirrored by CHECKs in 044.
export const EXTERNAL_REF_MAX = 200;
export const EVIDENCE_URL_MAX = 2048;

// How many wins Today's "Recently" list shows. One value for the fetch limit,
// the optimistic prepend and the render cap, so they cannot drift apart.
export const RECENT_WINS_SHOWN = 5;

// Field caps enforced by the API before insert.
export const WIN_LIMITS = {
  textMax: 2000,
  impactNumberMax: 120,
} as const;

// The provenance values the server assigns itself: the web UI writes "manual",
// the MCP server writes "agent". Both appear in WIN_SOURCES and COMP_SOURCES.
export const MANUAL_SOURCE = "manual" as const satisfies WinSource & CompSource;
export const AGENT_SOURCE = "agent" as const satisfies WinSource & CompSource;

// vest_years is numeric(4,2): two decimal places.
const VEST_YEARS_SCALE = 2;
const VEST_YEARS_FACTOR = 10 ** VEST_YEARS_SCALE;
// Projections round a vest to whole months, so a shorter vest would model a
// grant that never vests.
const VEST_MIN_MONTHS = 1;
export const VEST_YEARS_MIN_LABEL = "one month";

// Field caps for comp entries, mirroring the column types in 033/035/040.
// The *Scale values are the column's decimal places, used to format the caps
// in validation messages.
export const COMP_LIMITS = {
  // numeric(12,2)
  amountMax: 9_999_999_999.99,
  amountScale: 2,
  // numeric(14,4)
  sharesMax: 9_999_999_999.9999,
  sharesScale: 4,
  noteMax: 500,
  tickerMax: 10,
  // The smallest numeric(4,2) value that is at least VEST_MIN_MONTHS: 1/12
  // rounded up to 0.09, which projections round to one month.
  vestYearsMin:
    Math.ceil((VEST_MIN_MONTHS / MONTHS_PER_YEAR) * VEST_YEARS_FACTOR) / VEST_YEARS_FACTOR,
  vestYearsMax: 10,
  vestCliffMonthsMax: 60,
} as const;
