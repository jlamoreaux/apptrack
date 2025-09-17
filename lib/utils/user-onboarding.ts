import { createClient } from "@/lib/supabase/server";

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
    
    // If onboarding_completed field exists and is false, they're new
    if (profile.onboarding_completed === false) return true;
    
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
    console.error("Error checking if user is new:", error);
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
    console.error("Error marking onboarding complete:", error);
  }
}