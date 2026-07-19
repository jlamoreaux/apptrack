/**
 * Coach v1 prompt construction (M3). The coach is grounded EXCLUSIVELY in the
 * user's logged wins, goal, and review date. If an answer isn't derivable from
 * their data plus general negotiation/promo knowledge, it says what's missing
 * and how to log it — never generic career advice (that's the "wrapper" failure
 * the RFC warns about). Voice guardrails are embedded verbatim.
 */

import { VOICE_GUARDRAILS } from "@/lib/ai/voice-guardrails";
import { WIN_TAGS, WIN_TAG_OPTIONS, type WinTag } from "@/lib/constants/careerotter";

export const COACH_PROMPT_VERSION = "1.0.0";

// Three seeded conversation starters (RFC / PRD M3).
export const COACH_STARTERS = [
  "What's the weakest part of my case?",
  "Draft my 1:1 talking points for this week",
  "Am I ready to ask?",
] as const;

export interface CoachProfile {
  mode?: string | null;
  role?: string | null;
  level?: string | null;
  target?: string | null;
  review_date?: string | null;
}

export interface CoachWin {
  text: string;
  impact_number?: string | null;
  tag?: string | null;
  created_at?: string;
}

const TAG_LABEL: Record<WinTag, string> = Object.fromEntries(
  WIN_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<WinTag, string>;

/**
 * Build the coach system prompt from the user's data. Wins are listed as the
 * evidence the coach may reference; the grounding rule is explicit.
 */
export function buildCoachSystemPrompt(
  profile: CoachProfile | null,
  wins: CoachWin[]
): string {
  const goal =
    profile?.mode === "job_search"
      ? "landing a better role"
      : profile?.mode === "raise"
        ? "a raise"
        : "a promotion";

  const context: string[] = [`Their goal: ${goal}.`];
  if (profile?.role) context.push(`Role: ${profile.role}${profile.level ? `, ${profile.level}` : ""}.`);
  if (profile?.target) context.push(`Target: ${profile.target}.`);
  if (profile?.review_date) context.push(`Next review: ${profile.review_date}.`);

  // Emptiest impact area (fewest wins, first tag on a tie) — the gap the coach
  // should point at. Computed inline to keep this prompt module dependency-light.
  const tagCounts = new Map<WinTag, number>(WIN_TAGS.map((t) => [t, 0]));
  for (const w of wins) {
    if (w.tag && tagCounts.has(w.tag as WinTag)) {
      tagCounts.set(w.tag as WinTag, (tagCounts.get(w.tag as WinTag) ?? 0) + 1);
    }
  }
  const emptiest = WIN_TAGS.reduce((min, t) =>
    (tagCounts.get(t) ?? 0) < (tagCounts.get(min) ?? 0) ? t : min
  );
  if (wins.length > 0 && (tagCounts.get(emptiest) ?? 0) === 0) {
    context.push(`Emptiest area (no evidence yet): ${TAG_LABEL[emptiest]}.`);
  }

  const winLines =
    wins.length === 0
      ? "The user has logged no wins yet."
      : wins
          .map((w, i) => {
            const tag = w.tag ? ` [${TAG_LABEL[w.tag as WinTag] ?? w.tag}]` : "";
            const impact = w.impact_number ? ` (${w.impact_number})` : "";
            return `${i + 1}. ${w.text}${impact}${tag}`;
          })
          .join("\n");

  return `${VOICE_GUARDRAILS}

You are coaching this user toward their goal. You may only reason from the evidence below plus general, well-established negotiation and promotion knowledge. Do not invent wins, numbers, or facts about them. If a good answer needs information they haven't logged, say exactly what's missing and how to log it (one line in the capture bar), then answer with what you do have.

Every hard truth ships with the next action. Reference their actual wins by their content when you use them.

Their context:
${context.join("\n")}

Their logged wins (the only evidence you may cite):
${winLines}`;
}
