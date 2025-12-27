import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { getUser } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // CRITICAL: Authenticate user first
    const user = await getUser();
    if (!user) {
      loggerService.warn('Unauthorized subscription cancellation attempt', {
        category: LogCategory.SECURITY,
        action: 'stripe_cancel_subscription_unauthorized',
        duration: Date.now() - startTime
      });
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
      loggerService.info('No active subscription to cancel', {
        category: LogCategory.PAYMENT,
        userId,
        action: 'stripe_cancel_no_subscription',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    if (!subscription.stripe_subscription_id) {
      loggerService.warn('Subscription has no Stripe ID', {
        category: LogCategory.PAYMENT,
        userId,
        action: 'stripe_cancel_no_stripe_id',
        duration: Date.now() - startTime,
        metadata: {
          subscriptionId: subscription.id,
          planName: subscription.plan?.name
        }
      });
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

    loggerService.info('Subscription cancelled successfully', {
      category: LogCategory.PAYMENT,
      userId,
      action: 'stripe_cancel_subscription_success',
      duration: Date.now() - startTime,
      metadata: {
        stripeSubscriptionId: subscription.stripe_subscription_id,
        subscriptionId: subscription.id,
        planName: subscription.plan?.name,
        currentPeriodEnd: subscription.current_period_end
      }
    });
    
    return NextResponse.json({
      success: true,
      message: "Subscription canceled successfully",
    });
  } catch (error) {
    loggerService.error('Error canceling subscription', error, {
      category: LogCategory.PAYMENT,
      userId: user?.id,
      action: 'stripe_cancel_subscription_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
