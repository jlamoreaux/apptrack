import { createClient } from "@/lib/supabase/server";
import { PLAN_NAMES } from "@/lib/constants/plans";

export async function isNewUser(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, created_at")
      .eq("id", userId)
      .single();

    if (!profile) return true;

    // If onboarding already completed, not new
    if (profile.onboarding_completed === true) return false;

    // Check if user has a paid subscription - if so, skip onboarding
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("subscription_plans(name)")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();

    const subscriptionPlans = subscription?.subscription_plans as { name: string } | { name: string }[] | null;
    const planName = Array.isArray(subscriptionPlans) ? subscriptionPlans[0]?.name : subscriptionPlans?.name;
    if (planName && planName !== PLAN_NAMES.FREE) {
      return false; // Has paid subscription, not new
    }

    // Check if they have any applications (existing user)
    const { count } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // If they have applications, they're not new
    if (count && count > 0) return false;

    // Check if account was created in the last 5 minutes
    const createdAt = new Date(profile.created_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return createdAt > fiveMinutesAgo;
  } catch (error) {
    return false; // Default to not interrupting flow
  }
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  try {
    const supabase = await createClient();
    
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId);
  } catch (error) {
  }
}