import { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_NAMES } from "@/lib/constants/plans";

/**
 * Check if a user has a paid (non-free) subscription
 * Used to skip onboarding for users who already have a paid plan
 */
export async function hasPaidSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("subscription_plans(name)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error checking paid subscription status:", error);
    return false;
  }

  const plans = data?.subscription_plans as
    | { name: string }
    | { name: string }[]
    | null;
  const planName = Array.isArray(plans) ? plans[0]?.name : plans?.name;
  return !!(planName && planName !== PLAN_NAMES.FREE);
}
