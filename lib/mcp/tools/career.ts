/**
 * MCP tool over the user's goal frame: what they are working toward and how
 * long until the review (or target) date.
 */

import { z } from "zod";
import {
  CAREER_MODES,
  CAREER_MODE_COUNTDOWN_NOUN,
  CAREER_MODE_GOAL_LABEL,
  type CareerMode,
} from "@/lib/constants/careerotter";
import {
  getCareerProfileContext,
  type CareerProfileContext,
} from "@/lib/careerotter/career-profile-service";
import { reviewCountdown } from "@/lib/careerotter/review-countdown";
import { ok } from "@/lib/careerotter/domain-result";
import { READ_ANNOTATIONS } from "@/lib/mcp/annotations";
import {
  defineTool,
  type DefinedTool,
  type ToolInput,
  type ToolSuccess,
} from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import { asOfInput, resolveAsOf, type ResolvedAsOf } from "@/lib/mcp/tool-inputs";
import type { DomainResult } from "@/types";

const NO_PROFILE_SUMMARY = "No career profile set up yet.";

const careerContextInput = { as_of: asOfInput };

const careerContextOutput = z.object({
  has_profile: z.boolean(),
  as_of: z.string(),
  mode: z.enum(CAREER_MODES).nullable(),
  role: z.string().nullable(),
  level: z.string().nullable(),
  time_in_role: z.string().nullable(),
  target: z.string().nullable(),
  review_date: z.string().nullable(),
  review_countdown: z
    .object({
      weeks: z.number().int(),
      days: z.number().int(),
      is_past: z.boolean(),
      label: z.string(),
    })
    .nullable(),
});
type CareerContextOutput = z.infer<typeof careerContextOutput>;
type CountdownOutput = CareerContextOutput["review_countdown"];

// reviewCountdown reads the local calendar date of the instant, which
// resolveAsOf pins to the as_of day.
function countdownFor(
  reviewDate: string | null,
  asOf: ResolvedAsOf,
  mode: CareerMode
): CountdownOutput {
  const countdown = reviewCountdown(reviewDate, asOf.instant, {
    noun: CAREER_MODE_COUNTDOWN_NOUN[mode],
  });
  if (countdown === null) return null;
  const { weeks, days, isPast, label } = countdown;
  return { weeks, days, is_past: isPast, label };
}

function emptyContext(asOf: string): CareerContextOutput {
  return {
    has_profile: false,
    as_of: asOf,
    mode: null,
    role: null,
    level: null,
    time_in_role: null,
    target: null,
    review_date: null,
    review_countdown: null,
  };
}

function profileContext(profile: CareerProfileContext, asOf: ResolvedAsOf): CareerContextOutput {
  return {
    has_profile: true,
    as_of: asOf.date,
    ...profile,
    review_countdown: countdownFor(profile.review_date, asOf, profile.mode),
  };
}

function contextSummary(structured: CareerContextOutput, mode: CareerMode): string {
  const countdown = structured.review_countdown;
  return countdown ? `${countdown.label}.` : `Goal: ${CAREER_MODE_GOAL_LABEL[mode]}.`;
}

async function runGetCareerContext(
  ctx: McpToolContext,
  input: ToolInput<typeof careerContextInput>
): Promise<DomainResult<ToolSuccess<CareerContextOutput>>> {
  const asOf = resolveAsOf(ctx, input.as_of);
  const profile = await getCareerProfileContext(ctx.admin, ctx.userId);
  if (!profile.ok) return profile;
  if (profile.value === null) {
    return ok({ structured: emptyContext(asOf.date), summary: NO_PROFILE_SUMMARY });
  }
  const structured = profileContext(profile.value, asOf);
  return ok({ structured, summary: contextSummary(structured, profile.value.mode) });
}

const getCareerContextTool = defineTool({
  name: "get_career_context",
  title: "Get career context",
  description: [
    `Get the user's goal: mode (one of ${CAREER_MODES.join(", ")}), role, level, time in role, target, and review_date with a countdown from as_of.`,
    "has_profile is false, with every field null, when the user has not set a goal yet.",
  ].join(" "),
  scope: "career:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: careerContextInput,
  outputSchema: careerContextOutput,
  run: runGetCareerContext,
});

/** The career tools, in list order. */
export const CAREER_TOOLS: readonly DefinedTool[] = [getCareerContextTool];
