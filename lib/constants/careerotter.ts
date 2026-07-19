/**
 * CareerOtter Phase 2 (M2) shared constants — single source of truth mirrored by
 * the SQL CHECK lists in schemas/migrations/032_careerotter_evidence.sql. Keep
 * these in sync; __tests__ guards against drift.
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

// The four impact areas the coverage meter balances. Order is the display order.
export const WIN_TAGS = [
  "delivery",
  "leadership",
  "collaboration",
  "craft",
] as const;
export type WinTag = (typeof WIN_TAGS)[number];

export const WIN_TAG_OPTIONS: { value: WinTag; label: string }[] = [
  { value: "delivery", label: "Delivery" },
  { value: "leadership", label: "Leadership" },
  { value: "collaboration", label: "Collaboration" },
  { value: "craft", label: "Craft" },
];

// Where a win came from (provenance). "manual" is the capture bar.
export const WIN_SOURCES = [
  "manual",
  "recap",
  "zero_to_case",
  "import",
] as const;
export type WinSource = (typeof WIN_SOURCES)[number];

// Field caps enforced by the API before insert.
export const WIN_LIMITS = {
  textMax: 2000,
  impactNumberMax: 120,
} as const;
