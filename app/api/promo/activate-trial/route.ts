import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";


export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { promoCode } = await request.json();
    
    const supabase = await createClient();

    // Validate promo code against database
    const { data: promoCodeData, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", promoCode.toUpperCase())
      .eq("active", true)
      .single();

    if (promoError || !promoCodeData) {
      return NextResponse.json(
        { error: "Invalid or expired promo code" },
        { status: 400 }
      );
    }

    // Check if promo code has expired
    if (promoCodeData.expires_at && new Date(promoCodeData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This promo code has expired" },
        { status: 400 }
      );
    }

    // Check usage limits
    if (promoCodeData.max_uses && promoCodeData.used_count >= promoCodeData.max_uses) {
      return NextResponse.json(
        { error: "This promo code has reached its usage limit" },
        { status: 400 }
      );
    }

    const subscriptionService = new SubscriptionService();

    // Check if user already has or had a trial
    const existingSubscription = await subscriptionService.getCurrentSubscription(user.id);
    if (existingSubscription) {
      return NextResponse.json(
        { error: "You already have an active subscription" },
        { status: 400 }
      );
    }

    // Check trial history to prevent reuse
    const { data: trialHistory } = await supabase
      .from("trial_history")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (trialHistory) {
      return NextResponse.json(
        { error: "You have already used a trial promotion" },
        { status: 400 }
      );
    }

    // Get the plan specified by the promo code
    const { data: targetPlan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("name", promoCodeData.plan_name)
      .single();

    if (!targetPlan) {
      return NextResponse.json(
        { error: "Target plan not found" },
        { status: 500 }
      );
    }

    // Calculate dates using promo code configuration
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + promoCodeData.trial_days);

    // Determine subscription status based on code type
    const isTrialCode = promoCodeData.code_type === "trial";
    const isPremiumFree = promoCodeData.code_type === "premium_free";
    
    // Create subscription (no Stripe involved for trials or premium_free)
    const subscription = await subscriptionService.create({
      user_id: user.id,
      plan_id: targetPlan.id,
      status: isTrialCode ? "trialing" : "active", // premium_free codes are active, not trialing
      billing_cycle: "monthly",
      current_period_start: startDate.toISOString(),
      current_period_end: endDate.toISOString(),
      cancel_at_period_end: true, // Auto-cancel after period ends for both types
      stripe_subscription_id: null, // No Stripe subscription
      stripe_customer_id: null,
    });

    // Record trial/premium_free usage
    await supabase.from("trial_history").insert({
      user_id: user.id,
      promo_code: promoCode.toUpperCase(),
      trial_start: startDate.toISOString(),
      trial_end: endDate.toISOString(),
      plan_id: targetPlan.id,
    });

    // Increment promo code usage count
    await supabase
      .from("promo_codes")
      .update({ used_count: promoCodeData.used_count + 1 })
      .eq("id", promoCodeData.id);

    // Schedule notifications
    await scheduleNotifications(user.id, user.email!, endDate, promoCodeData.code_type);

    // Send welcome email
    await sendWelcomeEmail(user.email!, endDate, promoCodeData.trial_days, promoCodeData.code_type, promoCodeData.plan_name);

    const messageType = isTrialCode ? "trial" : "premium access";
    return NextResponse.json({
      success: true,
      message: `Your ${promoCodeData.trial_days}-day ${promoCodeData.plan_name} ${messageType} has been activated! It will automatically end on ${endDate.toLocaleDateString()}.`,
      trialEnd: endDate.toISOString(),
      planName: promoCodeData.plan_name,
      trialDays: promoCodeData.trial_days,
    });
  } catch (error) {
    console.error("Error activating trial:", error);
    return NextResponse.json(
      { error: "Failed to activate trial" },
      { status: 500 }
    );
  }
}

async function scheduleNotifications(
  userId: string,
  email: string,
  endDate: Date,
  codeType: string
) {
  const supabase = await createClient();
  
  // Schedule 7-day warning
  const warningDate = new Date(endDate);
  warningDate.setDate(warningDate.getDate() - 7);
  
  // Schedule 1-day warning
  const finalWarningDate = new Date(endDate);
  finalWarningDate.setDate(finalWarningDate.getDate() - 1);
  
  const notificationType = codeType === 'trial' ? 'trial' : 'premium';
  
  // Store notification schedule
  await supabase.from("scheduled_notifications").insert([
    {
      user_id: userId,
      email,
      type: `${notificationType}_ending_7_days`,
      scheduled_for: warningDate.toISOString(),
      status: "pending",
    },
    {
      user_id: userId,
      email,
      type: `${notificationType}_ending_1_day`,
      scheduled_for: finalWarningDate.toISOString(),
      status: "pending",
    },
    {
      user_id: userId,
      email,
      type: `${notificationType}_ended`,
      scheduled_for: endDate.toISOString(),
      status: "pending",
    },
  ]);
}

async function sendWelcomeEmail(email: string, endDate: Date, days: number, codeType: string, planName: string) {
  const { sendEmail } = await import('@/lib/email/client');
  
  const isTrial = codeType === 'trial';
  const accessType = isTrial ? 'Trial' : 'Premium Access';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Welcome to Your ${days}-Day ${planName} ${accessType}! 🎉</h1>
      
      <p style="color: #4a4a4a; font-size: 16px; line-height: 24px;">Congratulations! You now have full access to AppTrack's ${planName} features for the next ${days} days.</p>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 0;">What's Included:</h2>
        <ul style="color: #4a4a4a; font-size: 14px; line-height: 22px;">
          <li>✨ AI Resume Analysis - Get instant feedback on your resume</li>
          <li>🎯 Job Fit Analysis - See how well you match job requirements</li>
          <li>💬 Interview Preparation - Practice with AI-generated questions</li>
          <li>📝 Cover Letter Generation - Create tailored cover letters</li>
          <li>🚀 Career Coaching - Get personalized career advice</li>
        </ul>
      </div>
      
      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="color: #856404; font-size: 14px; margin: 0;">
          <strong>Important:</strong> Your ${isTrial ? 'trial' : 'premium access'} will automatically end on <strong>${endDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</strong>. After this date, you'll return to the free tier with limited features.
        </p>
      </div>
      
      <p style="color: #4a4a4a; font-size: 14px; line-height: 22px;">
        <strong>No credit card required</strong> - This is a completely free ${isTrial ? 'trial' : 'premium access period'} with no strings attached. We'll send you reminders before your access ends.
      </p>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; line-height: 18px;">
          You're receiving this email because you activated a ${isTrial ? 'trial' : 'premium access code'} for AppTrack. If you have any questions, feel free to reply to this email.
        </p>
      </div>
    </div>
  `;
  
  await sendEmail({
    to: email,
    subject: `🎉 Welcome to Your ${days}-Day ${planName} ${accessType}!`,
    html,
  });
}