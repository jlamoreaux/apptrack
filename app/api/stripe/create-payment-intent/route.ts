import { type NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_CONFIG } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { BILLING_CYCLES } from "@/lib/constants/plans";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { planId, billingCycle, userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS },
        { status: 400 }
      );
    }

    // Get user profile
    const supabase = await createClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Validate billing cycle
    if (!Object.values(BILLING_CYCLES).includes(billingCycle)) {
      return NextResponse.json(
        { error: "Invalid billing cycle" },
        { status: 400 }
      );
    }

    // Determine price based on billing cycle
    const priceAmount =
      billingCycle === BILLING_CYCLES.YEARLY
        ? plan.price_yearly
        : plan.price_monthly;
    const priceId =
      billingCycle === BILLING_CYCLES.YEARLY
        ? STRIPE_CONFIG.plans.pro_yearly.priceId
        : STRIPE_CONFIG.plans.pro_monthly.priceId;

    // Create or get Stripe customer
    let customerId: string;

    // Check if user already has a Stripe customer ID
    const subscriptionService = new SubscriptionService();
    const currentSubscription =
      await subscriptionService.getCurrentSubscription(userId);
    if (currentSubscription?.stripe_customer_id) {
      customerId = currentSubscription.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.full_name || profile.email,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        userId: userId,
        planId: planId,
        billingCycle: billingCycle,
      },
    });

    const paymentIntent = subscription.latest_invoice?.payment_intent;

    if (!paymentIntent || typeof paymentIntent === "string") {
      return NextResponse.json(
        { error: "Failed to create payment intent" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
