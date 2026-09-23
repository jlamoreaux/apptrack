/**
 * MCP tool over the user's goal frame: what they are working toward and how
 * long until the review (or target) date.
 */

import { z } from "zod";
import {
  CAREER_MODES,
  CAREER_MODE_COUNTDOWN_NOUN,
  type CareerMode,
} from "@/lib/constants/careerotter";
import { MIDDAY_HOUR } from "@/lib/constants/dates";
import {
  getCareerProfileContext,
  type CareerProfileContext,
} from "@/lib/careerotter/career-profile-service";
import { reviewCountdown } from "@/lib/careerotter/review-countdown";
import { invalid, isCalendarDate, ok, toIsoDate } from "@/lib/careerotter/domain-result";
import {
  defineTool,
  type DefinedTool,
  type ToolInput,
  type ToolSuccess,
} from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import type { DomainResult } from "@/types";

const AS_OF_MESSAGE = "as_of must be a date in YYYY-MM-DD format";

const careerContextInput = {
  as_of: z
    .string()
    .optional()
    .describe("The date to count down from, in YYYY-MM-DD format. Defaults to today (UTC)."),
};

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

function resolveAsOf(ctx: McpToolContext, asOf: string | undefined): DomainResult<string> {
  if (asOf === undefined) return ok(toIsoDate(ctx.now));
  return isCalendarDate(asOf) ? ok(asOf) : invalid(AS_OF_MESSAGE);
}

// reviewCountdown reads the local calendar fields of `now`, so the Date is
// built in local time to carry exactly the as_of day whatever the server zone.
function localDateOf(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, MIDDAY_HOUR);
}

function countdownFor(
  reviewDate: string | null,
  asOf: string,
  mode: CareerMode
): CountdownOutput {
  const countdown = reviewCountdown(reviewDate, localDateOf(asOf), {
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

function profileContext(profile: CareerProfileContext, asOf: string): CareerContextOutput {
  return {
    has_profile: true,
    as_of: asOf,
    ...profile,
    review_countdown: countdownFor(profile.review_date, asOf, profile.mode),
  };
}

async function runGetCareerContext(
  ctx: McpToolContext,
  input: ToolInput<typeof careerContextInput>
): Promise<DomainResult<ToolSuccess<CareerContextOutput>>> {
  const asOf = resolveAsOf(ctx, input.as_of);
  if (!asOf.ok) return asOf;
  const profile = await getCareerProfileContext(ctx.admin, ctx.userId);
  if (!profile.ok) return profile;
  if (profile.value === null) {
    return ok({ structured: emptyContext(asOf.value), summary: "No career profile set up yet" });
  }
  const structured = profileContext(profile.value, asOf.value);
  return ok({
    structured,
    summary: structured.review_countdown?.label ?? `Goal: ${profile.value.mode}`,
  });
}

const getCareerContextTool = defineTool({
  name: "get_career_context",
  title: "Get career context",
  description:
    "The user's goal: mode (promotion, raise or job_search), role, level, time in role, target, and review_date with a countdown from as_of. has_profile is false, with every field null, when the user has not set a goal yet.",
  scope: "career:read",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: careerContextInput,
  outputSchema: careerContextOutput,
  run: runGetCareerContext,
});

/** The career tools, in list order. */
export const CAREER_TOOLS: readonly DefinedTool[] = [getCareerContextTool];
