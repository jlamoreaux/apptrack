import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { getUser } from "@/lib/supabase/server";

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

    // Use authenticated user's ID, NOT from request body
    const userId = user.id;

    const subscriptionService = new SubscriptionService();

    // Get user's current subscription
    const subscription = await subscriptionService.getCurrentSubscription(
      userId
    );

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No Stripe subscription ID found" },
        { status: 400 }
      );
    }

    // Cancel the subscription in Stripe (at period end)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Update the subscription status using service
    await subscriptionService.cancelSubscription(subscription.id);

    return NextResponse.json({
      success: true,
      message: "Subscription canceled successfully",
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
