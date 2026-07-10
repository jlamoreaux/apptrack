// Career Companion Phase 0 constants
// Single source of truth mirrored by the SQL CHECK constraints in
// schemas/migrations/031_career_waitlist.sql — keep both in sync
// (guarded by __tests__/constants/career.test.ts).

export const REVIEW_TIMING_OPTIONS = [
  { value: "lt_3_months", label: "Within 3 months" },
  { value: "3_6_months", label: "3–6 months" },
  { value: "6_12_months", label: "6–12 months" },
  { value: "no_formal_reviews", label: "No formal reviews" },
  { value: "not_sure", label: "Not sure" },
] as const;

export type ReviewTiming = (typeof REVIEW_TIMING_OPTIONS)[number]["value"];

export const CAREER_WAITLIST_SOURCES = ["email", "banner", "direct"] as const;

export type CareerWaitlistSource = (typeof CAREER_WAITLIST_SOURCES)[number];

export const CAREER_CAMPAIGN = "career_companion_validation";
