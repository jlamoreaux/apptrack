/**
 * Plan lookup for callers without a cookie session (the MCP server).
 *
 * PermissionMiddleware.getUserPlanInfo goes through getSubscription, which uses
 * the cookie client, so a token-authenticated caller would always read as
 * Free. This runs the same query on the service-role admin client and derives
 * Pro with the same helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_NAMES } from "@/lib/constants/plans";
import {
  ENTITLED_SUBSCRIPTION_STATUSES,
  isEntitledStatus,
} from "@/lib/constants/subscription-status";
import { isOnProOrHigher } from "@/lib/utils/plan-helpers";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { DomainResult } from "@/types";

const PLAN_LOOKUP_FAILED = "Failed to look up plan";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The embedded relation arrives as an object for a to-one join, but an
// untyped client cannot know that, so an array is accepted too.
function planNameOf(subscription: Record<string, unknown>): string {
  const joined = subscription.subscription_plans;
  const plan = Array.isArray(joined) ? joined[0] : joined;
  const name = isRecord(plan) ? plan.name : undefined;
  return typeof name === "string" && name.length > 0 ? name : PLAN_NAMES.FREE;
}

function dbFailure(userId: string, error: unknown): DomainResult<boolean> {
  loggerService.error("Failed to look up subscription plan", error, {
    category: LogCategory.DATABASE,
    userId,
    action: "plan_lookup_failed",
  });
  return { ok: false, kind: "db", message: PLAN_LOOKUP_FAILED };
}

/** True when the user holds an entitled (active or trialing) Pro-or-higher plan. */
export async function isProUser(
  admin: SupabaseClient,
  userId: string
): Promise<DomainResult<boolean>> {
  try {
    const { data, error } = await admin
      .from("user_subscriptions")
      .select("*, subscription_plans (*)")
      .eq("user_id", userId)
      .in("status", [...ENTITLED_SUBSCRIPTION_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return dbFailure(userId, error);
    if (!isRecord(data)) return { ok: true, value: false };
    const status = typeof data.status === "string" ? data.status : null;
    return { ok: true, value: isEntitledStatus(status) && isOnProOrHigher(planNameOf(data)) };
  } catch (error) {
    return dbFailure(userId, error);
  }
}
