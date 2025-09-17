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

    const supabase = await createClient();
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

    // Calculate trial dates using promo code configuration
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + promoCodeData.trial_days);

    // Create trial subscription (no Stripe involved)
    const subscription = await subscriptionService.create({
      user_id: user.id,
      plan_id: targetPlan.id,
      status: "trialing",
      billing_cycle: "monthly",
      current_period_start: trialStart.toISOString(),
      current_period_end: trialEnd.toISOString(),
      cancel_at_period_end: true, // Auto-cancel after trial
      stripe_subscription_id: null, // No Stripe subscription
      stripe_customer_id: null,
    });

    // Record trial usage
    await supabase.from("trial_history").insert({
      user_id: user.id,
      promo_code: promoCode.toUpperCase(),
      trial_start: trialStart.toISOString(),
      trial_end: trialEnd.toISOString(),
      plan_id: targetPlan.id,
    });

    // Increment promo code usage count
    await supabase
      .from("promo_codes")
      .update({ used_count: promoCodeData.used_count + 1 })
      .eq("id", promoCodeData.id);

    // Schedule notifications
    await scheduleTrialNotifications(user.id, user.email!, trialEnd);

    // Send welcome email
    await sendTrialWelcomeEmail(user.email!, trialEnd);

    return NextResponse.json({
      success: true,
      message: `Your ${promoCodeData.trial_days}-day ${promoCodeData.plan_name} trial has been activated! It will automatically end on ${trialEnd.toLocaleDateString()}.`,
      trialEnd: trialEnd.toISOString(),
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

async function scheduleTrialNotifications(
  userId: string,
  email: string,
  trialEnd: Date
) {
  const supabase = await createClient();
  
  // Schedule 7-day warning
  const warningDate = new Date(trialEnd);
  warningDate.setDate(warningDate.getDate() - 7);
  
  // Schedule 1-day warning
  const finalWarningDate = new Date(trialEnd);
  finalWarningDate.setDate(finalWarningDate.getDate() - 1);
  
  // Store notification schedule
  await supabase.from("scheduled_notifications").insert([
    {
      user_id: userId,
      email,
      type: "trial_ending_7_days",
      scheduled_for: warningDate.toISOString(),
      status: "pending",
    },
    {
      user_id: userId,
      email,
      type: "trial_ending_1_day",
      scheduled_for: finalWarningDate.toISOString(),
      status: "pending",
    },
    {
      user_id: userId,
      email,
      type: "trial_ended",
      scheduled_for: trialEnd.toISOString(),
      status: "pending",
    },
  ]);
}

async function sendTrialWelcomeEmail(email: string, trialEnd: Date) {
  const { sendEmail } = await import('@/lib/email/client');
  
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Welcome to Your 90-Day AI Coach Trial! 🎉</h1>
      
      <p style="color: #4a4a4a; font-size: 16px; line-height: 24px;">Congratulations! You now have full access to AppTrack's AI Coach features for the next 90 days.</p>
      
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
          <strong>Important:</strong> Your trial will automatically end on <strong>${trialEnd.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</strong>. After this date, you'll return to the free tier with limited features.
        </p>
      </div>
      
      <p style="color: #4a4a4a; font-size: 14px; line-height: 22px;">
        <strong>No credit card required</strong> - This is a completely free trial with no strings attached. We'll send you reminders before your trial ends.
      </p>
      
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 12px; line-height: 18px;">
          You're receiving this email because you activated a trial for AppTrack. If you have any questions, feel free to reply to this email.
        </p>
      </div>
    </div>
  `;
  
  await sendEmail({
    to: email,
    subject: '🎉 Welcome to Your 90-Day AI Coach Trial!',
    html,
  });
}