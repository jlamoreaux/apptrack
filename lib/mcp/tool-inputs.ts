/**
 * Input schemas and the as_of resolver shared by the MCP tools, so every tool
 * accepts dates, ids, external_ref and JSON-encoded structured arguments the
 * same way.
 */

import { z } from "zod";
import { parseLocalDate } from "@/lib/careerotter/comp-projection";
import { isCalendarDate, toIsoDate } from "@/lib/careerotter/domain-result";
import { ISO_DATE_PATTERN } from "@/lib/constants/dates";
import {
  MCP_AS_OF_DESCRIPTION,
  MCP_DATE_MIN_YEAR,
  MCP_EXTERNAL_REF_DESCRIPTION,
  mcpDateMessage,
} from "@/lib/constants/mcp-tools";
import type { McpToolContext } from "./context";

type DateInput = z.ZodEffects<z.ZodString, string, string>;

// YYYY-MM-DD strings sort in date order, so the bound is a string compare.
const MCP_DATE_MIN = `${MCP_DATE_MIN_YEAR}-01-01`;

function isMcpDate(value: string): boolean {
  return isCalendarDate(value) && value >= MCP_DATE_MIN;
}

/**
 * A real YYYY-MM-DD date in MCP_DATE_MIN_YEAR or later. The pattern is kept so
 * clients see it in the JSON schema; the refinement skips values the pattern
 * already rejected, so each bad value gets one message.
 */
export function isoDateInput(field: string): DateInput {
  const message = mcpDateMessage(field);
  return z
    .string()
    .regex(ISO_DATE_PATTERN, message)
    .refine((value) => !ISO_DATE_PATTERN.test(value) || isMcpDate(value), { message });
}

export const asOfInput = isoDateInput("as_of").optional().describe(MCP_AS_OF_DESCRIPTION);

/** A record's uuid, described by what it names. */
export function recordIdInput(noun: string): z.ZodString {
  return z.string().uuid().describe(`The ${noun}'s id.`);
}

export const externalRefInput = z.string().optional().describe(MCP_EXTERNAL_REF_DESCRIPTION);

function isJsonContainer(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

/**
 * The array or object a JSON string encodes, else the value unchanged. Invalid
 * JSON and JSON scalars are left as the original string so the schema rejects
 * it with its usual message.
 */
function decodeJsonContainer(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    const decoded: unknown = JSON.parse(value);
    return isJsonContainer(decoded) ? decoded : value;
  } catch {
    return value;
  }
}

/**
 * Accepts an array or object argument either as is or as a JSON string, since
 * some MCP clients send nested arguments stringified. The advertised JSON
 * Schema is the wrapped schema's own (the SDK converts effects by their input
 * schema), so clients are still told to send the structured value.
 */
export function jsonEncodedInput<T extends z.ZodTypeAny>(
  schema: T
): z.ZodEffects<T, z.output<T>, unknown> {
  return z.preprocess(decodeJsonContainer, schema);
}

export interface ResolvedAsOf {
  /** The YYYY-MM-DD date entries are picked by. */
  date: string;
  /** The instant vesting and countdowns are measured at; its local date is `date`. */
  instant: Date;
  /** The first projected calendar year. */
  year: number;
}

// comp-projection and reviewCountdown read local calendar fields, so "now" is
// rebuilt in local time with UTC's wall clock: its local date is then the UTC
// date as_of names, whatever zone the server runs in.
function utcWallClock(now: Date): Date {
  return new Date(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
    now.getUTCMilliseconds()
  );
}

/**
 * A pinned as_of is measured from the start of that day; without one, "now"
 * is the request time on today's UTC date, as on the comp page.
 */
export function resolveAsOf(ctx: McpToolContext, asOf?: string): ResolvedAsOf {
  const instant = asOf === undefined ? utcWallClock(ctx.now) : parseLocalDate(asOf);
  return {
    date: asOf ?? toIsoDate(ctx.now),
    instant,
    year: instant.getFullYear(),
  };
}
