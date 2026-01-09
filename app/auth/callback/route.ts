import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server";
import { hasPaidSubscription } from "@/lib/utils/subscription-helpers";
import { handleOnSignup } from "@/lib/services/on-signup.service";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Successfully confirmed email and logged in
      // Check if this is a new user who needs onboarding
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check profile and paid subscription status in parallel
        const [{ data: profile }, userHasPaidSubscription] = await Promise.all([
          supabase
            .from("profiles")
            .select("onboarding_completed, stripe_customer_id")
            .eq("id", user.id)
            .single(),
          hasPaidSubscription(supabase, user.id),
        ]);
        
        // Run post-signup setup (Stripe customer, Resend audience) - non-blocking
        // Call the service directly with the user object to avoid cookie-based auth issues
        // The handleOnSignup function is idempotent, safe to call even if partially set up
        handleOnSignup(user).catch(err => {
          console.error("Failed to complete post-signup setup:", err);
          // Don't block the user flow, continue with redirect
        });

        // If user is unlocking pre-registration results, prioritize that redirect
        // They can complete onboarding after seeing their results
        if (next?.startsWith("/try/unlock")) {
          return NextResponse.redirect(new URL(next, requestUrl.origin));
        }

        // If email confirmation (signup flow) and onboarding not completed
        // Skip onboarding for users with paid subscriptions
        if ((type === "signup" || !profile?.onboarding_completed) && !userHasPaidSubscription) {
          // Check if user has a traffic source trial in their metadata
          if (user.user_metadata?.traffic_source_trial?.type === "ai_coach_trial") {
            return NextResponse.redirect(new URL("/onboarding/welcome?auto_select=ai_coach", requestUrl.origin));
          }
          return NextResponse.redirect(new URL("/onboarding/welcome", requestUrl.origin));
        }

        // Otherwise go to dashboard or specified next page
        return NextResponse.redirect(new URL(next ?? "/dashboard", requestUrl.origin));
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(
    new URL("/auth/error?message=Could not authenticate user", requestUrl.origin)
  );
}