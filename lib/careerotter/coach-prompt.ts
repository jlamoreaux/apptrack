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

/**
 * Guided coaching goals. Each goal is a focused activity: the kickoff is sent
 * as the user's opening message, and the guidance is appended to the system
 * prompt so the coach runs a structured flow instead of a one-off answer.
 * Every flow stays grounded in logged wins — that grounding is the product's
 * differentiator, so guidance must reference the user's actual evidence.
 */
export interface CoachGoal {
  id: string;
  stage: string;
  label: string;
  description: string;
  kickoff: string;
  guidance: string;
}

export const COACH_GOALS: readonly CoachGoal[] = [
  {
    id: "find-gaps",
    stage: "Build your case",
    label: "Find my gaps",
    description: "Audit your case coverage and name what evidence is missing",
    kickoff: "Audit my case. Where are the gaps?",
    guidance:
      "Run a case audit: assess their evidence per impact area, name the weakest areas with counts, and end with the two most valuable wins they could log this week to close the biggest gap.",
  },
  {
    id: "review-bullets",
    stage: "Build your case",
    label: "Turn wins into review bullets",
    description: "Rewrite your logged wins as self-review achievement bullets",
    kickoff: "Turn my logged wins into self-review bullets.",
    guidance:
      "Rewrite their logged wins as tight accomplishment bullets (impact first, numbers where logged, no invented metrics). Group by impact area. Flag any win too vague to use and say what detail would fix it.",
  },
  {
    id: "one-on-one",
    stage: "Say it out loud",
    label: "Draft 1:1 talking points",
    description: "Prepare this week's manager 1:1 around your recent wins",
    kickoff: "Draft my 1:1 talking points for this week",
    guidance:
      "Draft three to five 1:1 talking points from their most recent wins, each one sentence plus a suggested ask or visibility move. Keep it scannable.",
  },
  {
    id: "review-conversation",
    stage: "Say it out loud",
    label: "Prep my review conversation",
    description: "Rehearse the review discussion and likely manager pushback",
    kickoff: "Help me prep for my review conversation.",
    guidance:
      "Run a review rehearsal: propose an opening statement built from their strongest evidence, then raise the two most likely manager pushbacks given their gaps, and coach a grounded response to each. Offer to role-play one exchange at a time.",
  },
  {
    id: "plan-ask",
    stage: "Get paid",
    label: "Plan the comp ask",
    description: "Decide the number, the timing, and the script",
    kickoff: "Help me plan my comp ask.",
    guidance:
      "Build the ask plan: readiness check against their evidence and review date, then timing, then a short script that cites their strongest logged wins. If they have not logged comp or a target, say what to add and where.",
  },
  {
    id: "practice-negotiation",
    stage: "Get paid",
    label: "Practice the negotiation",
    description: "Role-play objections to your ask and sharpen responses",
    kickoff: "Role-play my comp negotiation. Push back on me.",
    guidance:
      "Role-play the negotiation: play the manager, raise one realistic objection at a time (budget, timing, level), and after each user response give one line of feedback grounded in their evidence before the next objection. Stay in the exercise until they ask to stop, then summarize what to tighten.",
  },
  {
    id: "storybank",
    stage: "Interviews",
    label: "Build my storybank",
    description: "Turn logged wins into structured interview stories",
    kickoff: "Turn my wins into interview stories.",
    guidance:
      "Convert their strongest wins into situation-action-result interview stories, two to four sentences each, and name the behavioral question each story best answers. Flag wins missing the detail a story needs.",
  },
  {
    id: "interview-prep",
    stage: "Interviews",
    label: "Prep for an interview",
    description: "Practice likely questions using your own evidence",
    kickoff: "Help me prep for an upcoming interview.",
    guidance:
      "Ask which role and round first if not stated. Then run focused prep: likely questions for that round, which of their logged wins answers each, and one practice question at a time with feedback grounded in their evidence.",
  },
] as const;

export function getCoachGoal(id: unknown): CoachGoal | null {
  if (typeof id !== "string") return null;
  return COACH_GOALS.find((g) => g.id === id) ?? null;
}

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
  wins: CoachWin[],
  activity?: CoachGoal | null
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

  const goalBlock = activity
    ? `\n\nThe user chose the guided activity "${activity.label}". ${activity.guidance}`
    : "";

  return `${VOICE_GUARDRAILS}

You are coaching this user toward their goal. You may only reason from the evidence below plus general, well-established negotiation and promotion knowledge. Do not invent wins, numbers, or facts about them. If a good answer needs information they haven't logged, say exactly what's missing and how to log it (one line in the capture bar), then answer with what you do have.

Every hard truth ships with the next action. Reference their actual wins by their content when you use them.

Their context:
${context.join("\n")}

Their logged wins (the only evidence you may cite):
${winLines}${goalBlock}`;
}
