import { createClient } from "@/lib/supabase/server";
import { hasPaidSubscription, paidSubscriptionStatus } from "@/lib/utils/subscription-helpers";

// Onboarding is offered only to accounts created this recently.
const NEW_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

function isWithinNewAccountWindow(createdAt: string): boolean {
  return new Date(createdAt).getTime() > Date.now() - NEW_ACCOUNT_WINDOW_MS;
}

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
    if (await hasPaidSubscription(supabase, userId)) {
      return false;
    }

    // Check if they have any applications (existing user)
    const { count } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // If they have applications, they're not new
    if (count && count > 0) return false;

    return isWithinNewAccountWindow(profile.created_at);
  } catch (error) {
    console.error("Error checking if user is new:", error);
    return false; // Default to not interrupting flow
  }
}

/**
 * The strict form of isNewUser for the OAuth consent page, which would
 * otherwise bounce the user to onboarding and back: true only when the
 * profile row exists, onboarding isn't completed, the account is inside the
 * new-account window, and there's no paid plan and no application. A missing
 * row or any failed query means false, so the user sees consent.
 */
export async function needsOnboardingBeforeConsent(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("onboarding_completed, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error || !profile) return false;
    if (profile.onboarding_completed === true) return false;
    if (typeof profile.created_at !== "string" || !isWithinNewAccountWindow(profile.created_at)) {
      return false;
    }
    if ((await paidSubscriptionStatus(supabase, userId)) !== "unpaid") return false;

    const { count, error: applicationsError } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    return !applicationsError && count === 0;
  } catch (error) {
    console.error("Error checking onboarding before consent:", error);
    return false;
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
    console.error("Failed to mark onboarding complete for user:", userId, error);
  }
}
