import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient, getUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { code } = await request.json();
    const upperCode = code?.toUpperCase().trim();

    if (!upperCode) {
      return NextResponse.json(
        { error: "No code provided" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify the promo code exists and is valid (check for both free_forever and trial types)
    const { data: promoCode, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", upperCode)
      .eq("active", true)
      .in("code_type", ["free_forever", "trial"])
      .single();

    if (promoError || !promoCode) {
      return NextResponse.json(
        { error: "Invalid or inactive promo code" },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This promo code has expired" },
        { status: 400 }
      );
    }

    // Check if code has reached max uses
    if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
      return NextResponse.json(
        { error: "This promo code has reached its usage limit" },
        { status: 400 }
      );
    }

    // Check if user has already used this code
    const { data: existingUsage } = await supabase
      .from("promo_code_usage")
      .select("id")
      .eq("user_id", user.id)
      .eq("code", upperCode)
      .single();

    if (existingUsage) {
      return NextResponse.json(
        { error: "You have already used this promo code" },
        { status: 400 }
      );
    }

    // Get current subscription
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("*, subscription_plans(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    // If user has an active paid subscription, cancel it
    if (subscription?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        console.log(`Cancelled Stripe subscription: ${subscription.stripe_subscription_id}`);
      } catch (error) {
        console.error("Error cancelling Stripe subscription:", error);
      }
    }

    // Determine which plan to apply based on the promo code
    let targetPlanName = promoCode.plan_name || "AI Coach"; // Default to AI Coach for free codes
    let periodEnd = null;
    let trialEnd = null;

    if (promoCode.code_type === "free_forever") {
      // For free_forever codes, set a very far future date (100 years)
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 100);
      periodEnd = endDate.toISOString();
      trialEnd = periodEnd;
      
      // Use the first applicable plan if multiple are specified
      if (promoCode.applicable_plans && Array.isArray(promoCode.applicable_plans) && promoCode.applicable_plans.length > 0) {
        // Prefer AI Coach if available, otherwise use the first plan
        targetPlanName = promoCode.applicable_plans.includes("AI Coach") 
          ? "AI Coach" 
          : promoCode.applicable_plans[0];
      }
      
      console.log(`Applying free_forever access for ${targetPlanName} plan`);
    } else if (promoCode.code_type === "trial") {
      // For regular trial codes
      if (promoCode.trial_days > 0) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + promoCode.trial_days);
        periodEnd = endDate.toISOString();
        trialEnd = periodEnd;
      } else if (promoCode.discount_duration_months && promoCode.plan_name && promoCode.plan_name !== "Free") {
        // Legacy support for discount_duration_months
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + promoCode.discount_duration_months);
        periodEnd = endDate.toISOString();
        trialEnd = periodEnd;
      }
      
      console.log(`Applying ${promoCode.trial_days || promoCode.discount_duration_months * 30} day trial for ${targetPlanName} plan until ${periodEnd}`);
    }

    // Get the target plan
    const { data: targetPlan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("name", targetPlanName)
      .single();

    if (!targetPlan) {
      return NextResponse.json(
        { error: `Plan ${targetPlanName} not found` },
        { status: 500 }
      );
    }

    // Update or create user subscription
    const subscriptionData = {
      plan_id: targetPlan.id,
      status: "active",
      stripe_subscription_id: null,
      stripe_customer_id: null,
      current_period_end: periodEnd, // This field already exists in the schema
    };

    if (subscription) {
      // Update existing subscription
      await supabase
        .from("user_subscriptions")
        .update(subscriptionData)
        .eq("id", subscription.id);
    } else {
      // Create new subscription
      await supabase
        .from("user_subscriptions")
        .insert({
          ...subscriptionData,
          user_id: user.id,
          billing_cycle: "monthly",
        });
    }

    // Store the promo code usage with trial information
    const appliedAt = new Date();
    const trialEndDate = promoCode.discount_duration_months 
      ? new Date(appliedAt.getTime() + (promoCode.discount_duration_months * 30 * 24 * 60 * 60 * 1000))
      : null;
    
    await supabase
      .from("promo_code_usage")
      .insert({
        user_id: user.id,
        code: upperCode,
        applied_at: appliedAt.toISOString(),
        type: promoCode.code_type || "free_forever",
        metadata: {
          promo_code_id: promoCode.id,
          previous_plan: subscription?.subscription_plans?.name || "Free",
          target_plan: targetPlanName,
          trial_months: promoCode.discount_duration_months || null,
          trial_end: trialEndDate?.toISOString() || null,
          discount_percent: promoCode.discount_percent || null
        }
      });

    // Increment the usage count on the promo code
    await supabase
      .from("promo_codes")
      .update({ 
        used_count: promoCode.used_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", promoCode.id);

    // Create appropriate success message
    let message = "Successfully applied promo code!";
    if (promoCode.discount_duration_months && targetPlanName !== "Free") {
      message = `You now have ${promoCode.discount_duration_months} months of free ${targetPlanName} access! No credit card required.`;
    } else if (targetPlanName === "Free") {
      message = "You now have free access forever!";
    }

    return NextResponse.json({
      success: true,
      message,
      plan: targetPlanName,
      trial_months: promoCode.discount_duration_months || null,
      trial_end: trialEndDate?.toISOString() || null
    });
  } catch (error) {
    console.error("Error applying free code:", error);
    return NextResponse.json(
      { error: "Failed to apply code" },
      { status: 500 }
    );
  }
}