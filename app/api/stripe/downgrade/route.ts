import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { BILLING_CYCLES } from "@/lib/constants/plans";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();

    if (!user) {
      loggerService.warn('Unauthorized downgrade attempt', {
        category: LogCategory.SECURITY,
        action: 'stripe_downgrade_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { planId, billingCycle } = await request.json();

    loggerService.info('Processing subscription downgrade', {
      category: LogCategory.PAYMENT,
      userId: user.id,
      action: 'stripe_downgrade_start',
      metadata: {
        planId,
        billingCycle
      }
    });

    if (!planId || !billingCycle) {
      loggerService.warn('Missing fields for downgrade', {
        category: LogCategory.API,
        userId: user.id,
        action: 'stripe_downgrade_missing_fields',
        duration: Date.now() - startTime,
        metadata: {
          hasPlanId: !!planId,
          hasBillingCycle: !!billingCycle
        }
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS },
        { status: 400 }
      );
    }

    // Validate billing cycle
    if (!Object.values(BILLING_CYCLES).includes(billingCycle)) {
      loggerService.warn('Invalid billing cycle for downgrade', {
        category: LogCategory.API,
        userId: user.id,
        action: 'stripe_downgrade_invalid_cycle',
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

    const supabase = await createClient();
    const subscriptionService = new SubscriptionService();

    // Get the user's current subscription
    const currentSubscription = await subscriptionService.findByUserId(user.id);
    
    if (!currentSubscription || !currentSubscription.stripe_subscription_id) {
      loggerService.warn('No active subscription for downgrade', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_downgrade_no_subscription',
        duration: Date.now() - startTime,
        metadata: {
          hasSubscription: !!currentSubscription,
          hasStripeId: !!currentSubscription?.stripe_subscription_id
        }
      });
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    // Get the new plan details
    const { data: newPlan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !newPlan) {
      loggerService.error('Plan not found for downgrade', planError || new Error('Plan not found'), {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_downgrade_plan_not_found',
        duration: Date.now() - startTime,
        metadata: {
          planId
        }
      });
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Get the correct Stripe price ID
    const priceId =
      billingCycle === BILLING_CYCLES.YEARLY
        ? newPlan.stripe_yearly_price_id
        : newPlan.stripe_monthly_price_id;

    if (!priceId) {
      loggerService.error('No Stripe price ID for downgrade plan', new Error('Missing price ID'), {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_downgrade_no_price',
        duration: Date.now() - startTime,
        metadata: {
          planName: newPlan.name,
          planId,
          billingCycle
        }
      });
      return NextResponse.json(
        { error: "Invalid plan configuration" },
        { status: 500 }
      );
    }

    try {
      // Retrieve the current subscription from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(
        currentSubscription.stripe_subscription_id
      );

      // Update the subscription to the new plan at the end of the current period
      const updatedSubscription = await stripe.subscriptions.update(
        currentSubscription.stripe_subscription_id,
        {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price: priceId,
            },
          ],
          proration_behavior: 'none', // Don't prorate for downgrades
          billing_cycle_anchor: 'unchanged', // Keep the same billing cycle
          cancel_at_period_end: false, // Make sure it doesn't cancel
          metadata: {
            ...stripeSubscription.metadata,
            planId: planId,
            billingCycle: billingCycle,
            downgraded_at: new Date().toISOString(),
          },
        }
      );

      loggerService.info('Subscription downgrade scheduled', {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_downgrade_scheduled',
        duration: Date.now() - startTime,
        metadata: {
          stripeSubscriptionId: updatedSubscription.id,
          oldPlanId: currentSubscription.plan_id,
          newPlanId: planId,
          newPlanName: newPlan.name,
          billingCycle,
          effectiveDate: new Date(stripeSubscription.current_period_end * 1000).toISOString()
        }
      });
      
      // The webhook will handle updating our database when Stripe processes the change

      return NextResponse.json({ 
        success: true,
        message: `Your plan will be changed to ${newPlan.name} at the end of your current billing period.`,
        effective_date: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      });
    } catch (stripeError) {
      loggerService.error('Stripe error during downgrade', stripeError, {
        category: LogCategory.PAYMENT,
        userId: user.id,
        action: 'stripe_downgrade_stripe_error',
        duration: Date.now() - startTime,
        metadata: {
          stripeSubscriptionId: currentSubscription.stripe_subscription_id,
          planId,
          billingCycle
        }
      });
      return NextResponse.json(
        { error: "Failed to process downgrade" },
        { status: 500 }
      );
    }
  } catch (error) {
    loggerService.error('Error processing downgrade', error, {
      category: LogCategory.PAYMENT,
      userId: user?.id,
      action: 'stripe_downgrade_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}