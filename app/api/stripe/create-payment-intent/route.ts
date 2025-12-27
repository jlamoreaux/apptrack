import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { BILLING_CYCLES } from "@/lib/constants/plans";
import { createClient, getUser } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // CRITICAL: Authenticate user first
    const user = await getUser();
    if (!user) {
      loggerService.warn('Unauthorized payment intent creation', {
        category: LogCategory.SECURITY,
        action: 'stripe_payment_intent_unauthorized',
        duration: Date.now() - startTime
      });
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
      loggerService.warn('Profile not found for payment intent', {
        category: LogCategory.PAYMENT,
        userId,
        action: 'stripe_payment_intent_profile_not_found',
        duration: Date.now() - startTime,
        metadata: {
          error: profileError?.message
        }
      });
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      loggerService.warn('Plan not found for payment intent', {
        category: LogCategory.PAYMENT,
        userId,
        action: 'stripe_payment_intent_plan_not_found',
        duration: Date.now() - startTime,
        metadata: {
          planId,
          error: planError?.message
        }
      });
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Validate billing cycle
    if (!Object.values(BILLING_CYCLES).includes(billingCycle)) {
      loggerService.warn('Invalid billing cycle for payment intent', {
        category: LogCategory.API,
        userId,
        action: 'stripe_payment_intent_invalid_cycle',
        duration: Date.now() - startTime,
        metadata: {
          providedCycle: billingCycle
        }
      });
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
      loggerService.error('No Stripe price ID for billing cycle', new Error('Missing price ID'), {
        category: LogCategory.PAYMENT,
        userId,
        action: 'stripe_payment_intent_no_price',
        duration: Date.now() - startTime,
        metadata: {
          planName: plan.name,
          planId,
          billingCycle
        }
      });
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
      
      loggerService.info('Created new Stripe customer for payment intent', {
        category: LogCategory.PAYMENT,
        userId,
        action: 'stripe_payment_intent_customer_created',
        metadata: {
          stripeCustomerId: customerId
        }
      });
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

    loggerService.info('Payment setup intent created', {
      category: LogCategory.PAYMENT,
      userId,
      action: 'stripe_payment_intent_created',
      duration: Date.now() - startTime,
      metadata: {
        setupIntentId: setupIntent.id,
        customerId,
        planId,
        planName: plan.name,
        billingCycle,
        priceAmount
      }
    });
    
    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    loggerService.error('Error creating payment intent', error, {
      category: LogCategory.PAYMENT,
      userId: user?.id,
      action: 'stripe_payment_intent_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
