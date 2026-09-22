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
