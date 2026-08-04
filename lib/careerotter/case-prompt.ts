/**
 * Promo case builder prompt (M4). Assembles the user's logged wins into a
 * structured case document against a generic promo/raise rubric. The document
 * reads like the user's own case: first person, zero otter personality (D: the
 * character coaches, the deliverable is the user's). Voice guardrails still
 * apply (no AI tells), but the register is the user's, not the mascot's.
 */

import { VOICE_GUARDRAILS } from "@/lib/ai/voice-guardrails";
import { WIN_TAG_OPTIONS, type WinTag } from "@/lib/constants/careerotter";

export const CASE_PROMPT_VERSION = "1.0.0";

// Kept local so the case builder doesn't depend on the coach module (they ship
// on independent branches). Shapes match the wins/career_profiles selections.
export interface CaseProfile {
  mode?: string | null;
  role?: string | null;
  level?: string | null;
  target?: string | null;
  review_date?: string | null;
}

export interface CaseWin {
  text: string;
  impact_number?: string | null;
  tag?: string | null;
  created_at?: string;
}

const TAG_LABEL: Record<WinTag, string> = Object.fromEntries(
  WIN_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<WinTag, string>;

// Generic promo-case rubric v1. Custom rubric upload is a fast follow (PRD M4).
export const CASE_RUBRIC_V1 = [
  "Summary: one paragraph stating the case for the raise or promotion.",
  "Evidence by theme: group the wins by impact area (delivery, leadership, collaboration, craft). Lead each with the strongest, quantified where possible (situation, action, measurable result).",
  "Impact: pull the hardest numbers into a short highlights list.",
  "Gaps: name honestly what the case is still light on. One or two lines.",
  "The ask: a direct, specific ask (the promotion/raise and why now).",
];

export function buildCasePrompt(
  profile: CaseProfile | null,
  wins: CaseWin[]
): string {
  const goal =
    profile?.mode === "job_search"
      ? "a stronger candidacy for their next role"
      : profile?.mode === "raise"
        ? "a raise"
        : "a promotion";

  const context: string[] = [`They are building the case for ${goal}.`];
  if (profile?.role) context.push(`Role: ${profile.role}${profile.level ? `, ${profile.level}` : ""}.`);
  if (profile?.target) context.push(`Target: ${profile.target}.`);
  if (profile?.review_date) context.push(`Review date: ${profile.review_date}.`);

  const winLines = wins
    .map((w, i) => {
      const tag = w.tag ? ` [${TAG_LABEL[w.tag as WinTag] ?? w.tag}]` : "";
      const impact = w.impact_number ? ` (${w.impact_number})` : "";
      return `${i + 1}. ${w.text}${impact}${tag}`;
    })
    .join("\n");

  return `${VOICE_GUARDRAILS}

Write a promotion/raise case document FROM THE USER, in their first-person voice. No mascot personality, no otter references, no coaching asides. This is the document they hand a manager or paste into a review. Use only the wins below as evidence; do not invent facts or numbers. Where a win lacks a number, keep it qualitative rather than fabricating one.

Structure it as markdown with these sections, in order:
${CASE_RUBRIC_V1.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Their context:
${context.join("\n")}

Their logged wins (the only evidence):
${winLines || "None logged."}`;
}
