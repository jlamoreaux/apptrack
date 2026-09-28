/**
 * Career profile reads for the MCP server. Scoped to the acting user_id and
 * never throws: errors are logged and returned as a generic `db` result.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CAREER_MODES, type CareerMode } from "@/lib/constants/careerotter";
import {
  dbFailure,
  guarded,
  isNullableString,
  isPlainObject,
  ok,
  type FailureContext,
} from "@/lib/careerotter/domain-result";
import type { DomainResult } from "@/types";

/** The goal-frame columns an agent may read; excludes the generated starter case. */
export const CAREER_PROFILE_CONTEXT_SELECT =
  "mode, role, level, time_in_role, target, review_date";

export interface CareerProfileContext {
  mode: CareerMode;
  role: string | null;
  level: string | null;
  time_in_role: string | null;
  target: string | null;
  /** YYYY-MM-DD, as stored. */
  review_date: string | null;
}

const CAREER_PROFILE_TABLE = "career_profiles";
const LOAD_FAILED_MESSAGE = "Failed to load career profile";
const MALFORMED_ROW_MESSAGE = "Malformed career_profiles row";

function isCareerMode(value: unknown): value is CareerMode {
  return CAREER_MODES.some((mode) => mode === value);
}

function isCareerProfileContext(row: unknown): row is CareerProfileContext {
  return (
    isPlainObject(row) &&
    isCareerMode(row.mode) &&
    isNullableString(row.role) &&
    isNullableString(row.level) &&
    isNullableString(row.time_in_role) &&
    isNullableString(row.target) &&
    isNullableString(row.review_date)
  );
}

async function queryCareerProfile(
  admin: SupabaseClient,
  context: FailureContext
): Promise<DomainResult<CareerProfileContext | null>> {
  const { data, error } = await admin
    .from(CAREER_PROFILE_TABLE)
    .select(CAREER_PROFILE_CONTEXT_SELECT)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) return dbFailure(context, error);
  if (data === null) return ok(null);
  if (!isCareerProfileContext(data)) {
    return dbFailure(context, new Error(MALFORMED_ROW_MESSAGE));
  }
  return ok(data);
}

/** The user's goal frame, or null when they have not onboarded yet. */
export async function getCareerProfileContext(
  admin: SupabaseClient,
  userId: string
): Promise<DomainResult<CareerProfileContext | null>> {
  const context: FailureContext = {
    userId,
    action: "career_profile_load_failed",
    logMessage: LOAD_FAILED_MESSAGE,
    publicMessage: LOAD_FAILED_MESSAGE,
  };
  return guarded(context, () => queryCareerProfile(admin, context));
}
