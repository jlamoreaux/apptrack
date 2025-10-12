import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
        // Check if user has completed onboarding and has Stripe customer ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed, stripe_customer_id")
          .eq("id", user.id)
          .single();
        
        // Create Stripe customer if not exists (for users confirming email)
        if (!profile?.stripe_customer_id) {
          try {
            const customerResponse = await fetch(new URL("/api/stripe/create-customer", requestUrl.origin).toString(), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // Pass the auth cookie for the internal request
                "Cookie": request.headers.get("cookie") || ""
              },
            });
            
            if (!customerResponse.ok) {
              console.error("Stripe customer creation returned non-OK status:", customerResponse.status);
            }
          } catch (err) {
            console.error("Failed to create Stripe customer during email confirmation:", err);
            // Don't block the user flow, continue with redirect
          }
        }
        
        // If email confirmation (signup flow) and onboarding not completed
        if (type === "signup" || !profile?.onboarding_completed) {
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