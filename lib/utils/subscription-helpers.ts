import { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_NAMES } from "@/lib/constants/plans";

/** Whether the user's latest active or trialing plan is a paid one; "unknown" when the lookup fails. */
export type PaidSubscriptionStatus = "paid" | "unpaid" | "unknown";

export async function paidSubscriptionStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<PaidSubscriptionStatus> {
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("subscription_plans(name)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error checking paid subscription status:", error);
    return "unknown";
  }

  const planName = (data?.subscription_plans as { name: string } | null)?.name;
  return planName && planName !== PLAN_NAMES.FREE ? "paid" : "unpaid";
}

/**
 * Check if a user has a paid (non-free) subscription
 * Used to skip onboarding for users who already have a paid plan
 */
export async function hasPaidSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  return (await paidSubscriptionStatus(supabase, userId)) === "paid";
}
