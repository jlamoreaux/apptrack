import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { BILLING_CYCLES } from "@/lib/constants/plans";
import { createClient, getUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Authenticate user first
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { planId, billingCycle } = await request.json();

    // Use authenticated user's ID, NOT from request body
    const userId = user.id;

    // Get user profile
    const supabase = await createClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
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

    // Get the correct Stripe price ID from the database
    const priceId =
      billingCycle === BILLING_CYCLES.YEARLY
        ? plan.stripe_yearly_price_id
        : plan.stripe_monthly_price_id;

    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID not found for billing cycle" },
        { status: 400 }
      );
    }

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

    // Create subscription setup intent for recurring payments
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        userId: userId,
        planId: planId,
        billingCycle: billingCycle,
      },
      usage: "off_session", // For future subscription payments
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
