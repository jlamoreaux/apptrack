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
import {
  dbFailure,
  guarded,
  isPlainObject,
  ok,
  type FailureContext,
} from "@/lib/careerotter/domain-result";
import type { DomainResult } from "@/types";

const SUBSCRIPTIONS_TABLE = "user_subscriptions";

// The embedded relation arrives as an object for a to-one join, but an
// untyped client cannot know that, so an array is accepted too.
function planNameOf(subscription: Record<string, unknown>): string {
  const joined = subscription.subscription_plans;
  const plan = Array.isArray(joined) ? joined[0] : joined;
  const name = isPlainObject(plan) ? plan.name : undefined;
  return typeof name === "string" && name.length > 0 ? name : PLAN_NAMES.FREE;
}

function isProSubscription(subscription: unknown): boolean {
  if (!isPlainObject(subscription)) return false;
  const status = typeof subscription.status === "string" ? subscription.status : null;
  return isEntitledStatus(status) && isOnProOrHigher(planNameOf(subscription));
}

async function queryIsPro(
  admin: SupabaseClient,
  context: FailureContext
): Promise<DomainResult<boolean>> {
  const { data, error } = await admin
    .from(SUBSCRIPTIONS_TABLE)
    .select("*, subscription_plans (*)")
    .eq("user_id", context.userId)
    .in("status", [...ENTITLED_SUBSCRIPTION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return dbFailure(context, error);
  return ok(isProSubscription(data));
}

/** True when the user holds an entitled (active or trialing) Pro-or-higher plan. */
export async function isProUser(
  admin: SupabaseClient,
  userId: string
): Promise<DomainResult<boolean>> {
  const context: FailureContext = {
    userId,
    action: "plan_lookup_failed",
    logMessage: "Failed to look up subscription plan",
    publicMessage: "Failed to look up plan",
  };
  return guarded(context, () => queryIsPro(admin, context));
}
