/**
 * Helpers shared by the CareerOtter domain services (wins, comp, plan): result
 * constructors, the never-throw wrapper, row/field guards, and the
 * external_ref duplicate lookup.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { EXTERNAL_REF_MAX } from "@/lib/constants/careerotter";
import { ISO_DATE_LENGTH, ISO_DATE_MIN, ISO_DATE_PATTERN } from "@/lib/constants/dates";
import { UNIQUE_VIOLATION_CODE } from "@/lib/constants/postgres";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { DomainResult } from "@/types";

/** What to log, and what to tell the caller, when a service call fails. */
export interface FailureContext {
  userId: string;
  action: string;
  logMessage: string;
  publicMessage: string;
}

export const EXTERNAL_REF_MESSAGE = `external_ref must be a string of 1 to ${EXTERNAL_REF_MAX} characters`;

// C0 controls, DEL and C1 controls.
const C0_CONTROL_MAX = 0x1f;
const DEL_CODE_POINT = 0x7f;
const C1_CONTROL_MAX = 0x9f;
const NUL_CHARACTER = "\u0000";

// ── result constructors ────────────────────────────────────────────────────

export function ok<T>(value: T): DomainResult<T> {
  return { ok: true, value };
}

export function invalid<T>(message: string): DomainResult<T> {
  return { ok: false, kind: "validation", message };
}

export function notFound<T>(message: string): DomainResult<T> {
  return { ok: false, kind: "not_found", message };
}

export function conflict<T>(message: string): DomainResult<T> {
  return { ok: false, kind: "conflict", message };
}

export function overQuota<T>(message: string): DomainResult<T> {
  return { ok: false, kind: "quota", message };
}

/** Logs the error with context and returns the generic public message. */
export function dbFailure<T>(context: FailureContext, error: unknown): DomainResult<T> {
  loggerService.error(context.logMessage, error, {
    category: LogCategory.DATABASE,
    userId: context.userId,
    action: context.action,
  });
  return { ok: false, kind: "db", message: context.publicMessage };
}

/** Runs a service body, turning any thrown exception into a `db` failure. */
export async function guarded<T>(
  context: FailureContext,
  run: () => Promise<DomainResult<T>>
): Promise<DomainResult<T>> {
  try {
    return await run();
  } catch (error) {
    return dbFailure(context, error);
  }
}

/**
 * Schedules an analytics call for after the response. Analytics must never
 * change the outcome of a write that already committed, so a failure to
 * schedule is logged as a warning and otherwise ignored.
 */
export function trackAfterResponse(
  context: Pick<FailureContext, "userId" | "action">,
  send: () => Promise<void>
): void {
  try {
    after(send);
  } catch (error) {
    loggerService.warn("Failed to schedule analytics event", {
      category: LogCategory.BUSINESS,
      userId: context.userId,
      action: context.action,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}

// ── guards ─────────────────────────────────────────────────────────────────

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * True only for a YYYY-MM-DD string naming a real calendar date from year
 * 0001 on. The pattern alone accepts impossible dates like 2026-02-29, which
 * would then fail at insert time as a 500 instead of a validation 400.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  if (value < ISO_DATE_MIN) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && toIsoDate(parsed) === value;
}

/** Postgres text columns cannot store U+0000. */
export function hasNulCharacter(value: string): boolean {
  return value.includes(NUL_CHARACTER);
}

export function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= C0_CONTROL_MAX) return true;
    if (code >= DEL_CODE_POINT && code <= C1_CONTROL_MAX) return true;
  }
  return false;
}

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

/** Truncates by code point, so a surrogate pair is never split. */
export function truncateCodePoints(value: string, max: number): string {
  return Array.from(value).slice(0, max).join("");
}

/** A trimmed external_ref of 1..EXTERNAL_REF_MAX code points with no control characters. */
export function parseExternalRef(raw: unknown): DomainResult<string> {
  if (typeof raw !== "string") return invalid(EXTERNAL_REF_MESSAGE);
  const ref = raw.trim();
  const length = codePointLength(ref);
  if (length === 0 || length > EXTERNAL_REF_MAX || hasControlCharacter(ref)) {
    return invalid(EXTERNAL_REF_MESSAGE);
  }
  return ok(ref);
}

/** True for a unique violation raised by the named constraint. */
export function isUniqueViolationOn(error: unknown, constraintName: string): boolean {
  if (!isPlainObject(error) || error.code !== UNIQUE_VIOLATION_CODE) return false;
  return [error.message, error.details].some(
    (text) => typeof text === "string" && text.includes(constraintName)
  );
}

// ── external_ref lookup ────────────────────────────────────────────────────

export interface ExternalRefLookup {
  table: string;
  select: string;
  userId: string;
  externalRef: string;
}

/** The user's row with this external_ref as returned by the driver, or null. */
export async function findRowByExternalRef(
  admin: SupabaseClient,
  { table, select, userId, externalRef }: ExternalRefLookup,
  context: FailureContext
): Promise<DomainResult<unknown>> {
  const { data, error } = await admin
    .from(table)
    .select(select)
    .eq("user_id", userId)
    .eq("external_ref", externalRef)
    .maybeSingle();
  if (error) return dbFailure(context, error);
  return ok(data);
}
