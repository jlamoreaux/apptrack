/**
 * Helpers shared by the CareerOtter domain services (wins, comp, plan): result
 * constructors, the never-throw wrapper, row/field guards, and the
 * external_ref duplicate lookup.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { EXTERNAL_REF_MAX } from "@/lib/constants/careerotter";
import { UNIQUE_VIOLATION_CODE } from "@/lib/constants/postgres";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import {
  codePointLength,
  hasControlCharacter,
  isPlainObject,
} from "@/lib/careerotter/field-guards";
import type { DomainResult } from "@/types";

// The pure field guards live in field-guards.ts so client code can use them
// without pulling in next/server; the services keep importing them from here.
export {
  codePointLength,
  hasControlCharacter,
  hasNulCharacter,
  isCalendarDate,
  isNullableString,
  isPlainObject,
  toIsoDate,
  truncateCodePoints,
} from "@/lib/careerotter/field-guards";

/** What to log, and what to tell the caller, when a service call fails. */
export interface FailureContext {
  userId: string;
  action: string;
  logMessage: string;
  publicMessage: string;
}

export const EXTERNAL_REF_MESSAGE = `external_ref must be a string of 1 to ${EXTERNAL_REF_MAX} characters`;

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
