import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { BILLING_CYCLES } from "@/lib/constants/plans";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { planId, billingCycle } = await request.json();

    console.log(
      `Processing downgrade for user ${user.id} to plan ${planId}, billing ${billingCycle}`
    );

    if (!planId || !billingCycle) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS },
        { status: 400 }
      );
    }

    // Validate billing cycle
    if (!Object.values(BILLING_CYCLES).includes(billingCycle)) {
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
      console.error("Plan not found:", planError);
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
      console.error("No Stripe price ID found for plan:", newPlan);
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

      console.log(`Successfully scheduled downgrade for subscription ${updatedSubscription.id}`);
      
      // The webhook will handle updating our database when Stripe processes the change

      return NextResponse.json({ 
        success: true,
        message: `Your plan will be changed to ${newPlan.name} at the end of your current billing period.`,
        effective_date: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      });
    } catch (stripeError) {
      console.error("Stripe error during downgrade:", stripeError);
      return NextResponse.json(
        { error: "Failed to process downgrade" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing downgrade:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}