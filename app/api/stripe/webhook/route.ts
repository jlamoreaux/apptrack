import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import type Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log(`Received Stripe webhook: ${event.type} with ID ${event.id}`);

    const subscriptionService = new SubscriptionService();

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          subscriptionService
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          subscriptionService
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          subscriptionService
        );
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(
          event.data.object as Stripe.Invoice,
          subscriptionService
        );
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(
          event.data.object as Stripe.Invoice,
          subscriptionService
        );
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
          subscriptionService
        );
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}

// Helper function to map Stripe status to our database status
function mapStripeStatus(
  stripeStatus: string
): "active" | "canceled" | "past_due" | "trialing" {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "canceled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "trialing":
      return "trialing";
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    default:
      return "trialing"; // Default to trialing for any unknown or pending states
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  subscriptionService: SubscriptionService
) {
  try {
    const userId = String(session.metadata?.userId || "");
    const planId = session.metadata?.planId;
    const billingCycle = session.metadata?.billingCycle;

    console.log(
      `Processing checkout completion for user ${userId}, plan ${planId}, billing ${billingCycle}`
    );

    if (!userId || !planId) {
      console.error("Missing metadata in checkout session:", session.id);
      return;
    }

    if (!session.subscription) {
      console.error("No subscription ID in checkout session:", session.id);
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    console.log(
      `Retrieved Stripe subscription: ${subscription.id} with status: ${subscription.status}`
    );

    const currentPeriodStart =
      subscription.billing_cycle_anchor && subscription.billing_cycle_anchor > 0
        ? new Date(subscription.billing_cycle_anchor * 1000).toISOString()
        : new Date().toISOString();

    // Calculate current period end based on billing cycle anchor and subscription items
    let currentPeriodEnd = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    if (
      subscription.billing_cycle_anchor &&
      subscription.billing_cycle_anchor > 0
    ) {
      // Get the first subscription item to determine the interval
      const firstItem = subscription.items.data[0];
      if (firstItem?.price?.recurring?.interval) {
        const interval = firstItem.price.recurring.interval;
        const intervalCount = firstItem.price.recurring.interval_count || 1;

        // Calculate the end date based on the billing cycle anchor and interval
        const startDate = new Date(subscription.billing_cycle_anchor * 1000);
        let endDate = new Date(startDate);

        switch (interval) {
          case "day":
            endDate.setDate(startDate.getDate() + intervalCount);
            break;
          case "week":
            endDate.setDate(startDate.getDate() + intervalCount * 7);
            break;
          case "month":
            endDate.setMonth(startDate.getMonth() + intervalCount);
            break;
          case "year":
            endDate.setFullYear(startDate.getFullYear() + intervalCount);
            break;
        }

        currentPeriodEnd = endDate.toISOString();
      }
    }

    await subscriptionService.create({
      user_id: userId,
      stripe_customer_id: String(session.customer || ""),
      stripe_subscription_id: subscription.id,
      plan_name: planId,
      status: mapStripeStatus(subscription.status),
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: false,
    });

    console.log(`Successfully processed subscription for user ${userId}`);
  } catch (error) {
    console.error("Error in handleCheckoutCompleted:", error);
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  subscriptionService: SubscriptionService
) {
  try {
    let userId = subscription.metadata?.userId;
    if (!userId) {
      const found = await subscriptionService.findByStripeSubscriptionId(
        subscription.id
      );
      userId = found?.user_id || "";
    }
    userId = String(userId || "");
    if (!userId) {
      console.error("Could not find userId for subscription:", subscription.id);
      return;
    }
    console.log(
      `Updating subscription ${subscription.id} for user ${userId} with status: ${subscription.status}`
    );
    const currentPeriodStart =
      subscription.billing_cycle_anchor && subscription.billing_cycle_anchor > 0
        ? new Date(subscription.billing_cycle_anchor * 1000).toISOString()
        : new Date().toISOString();

    // Calculate current period end based on billing cycle anchor and subscription items
    let currentPeriodEnd = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    if (
      subscription.billing_cycle_anchor &&
      subscription.billing_cycle_anchor > 0
    ) {
      // Get the first subscription item to determine the interval
      const firstItem = subscription.items.data[0];
      if (firstItem?.price?.recurring?.interval) {
        const interval = firstItem.price.recurring.interval;
        const intervalCount = firstItem.price.recurring.interval_count || 1;

        // Calculate the end date based on the billing cycle anchor and interval
        const startDate = new Date(subscription.billing_cycle_anchor * 1000);
        let endDate = new Date(startDate);

        switch (interval) {
          case "day":
            endDate.setDate(startDate.getDate() + intervalCount);
            break;
          case "week":
            endDate.setDate(startDate.getDate() + intervalCount * 7);
            break;
          case "month":
            endDate.setMonth(startDate.getMonth() + intervalCount);
            break;
          case "year":
            endDate.setFullYear(startDate.getFullYear() + intervalCount);
            break;
        }

        currentPeriodEnd = endDate.toISOString();
      }
    }
    await subscriptionService.updateFromStripeWebhook(subscription.id, {
      status: mapStripeStatus(subscription.status),
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    });
    console.log(`Successfully updated subscription for user ${userId}`);
  } catch (error) {
    console.error("Error in handleSubscriptionUpdated:", error);
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  subscriptionService: SubscriptionService
) {
  try {
    let userId = subscription.metadata?.userId;
    if (!userId) {
      const found = await subscriptionService.findByStripeSubscriptionId(
        subscription.id
      );
      userId = found?.user_id || "";
    }
    userId = String(userId || "");
    if (!userId) {
      console.error("Could not find userId for subscription:", subscription.id);
      return;
    }
    console.log(`Deleting subscription ${subscription.id} for user ${userId}`);
    await subscriptionService.updateFromStripeWebhook(subscription.id, {
      status: "canceled",
      cancel_at_period_end: true,
    });
    console.log(
      `Successfully marked subscription as canceled for user ${userId}`
    );
  } catch (error) {
    console.error("Error in handleSubscriptionDeleted:", error);
  }
}

async function handlePaymentSucceeded(
  invoice: Stripe.Invoice,
  subscriptionService: SubscriptionService
) {
  try {
    // You can add logic here if you want to track successful payments
    console.log(`Payment succeeded for invoice ${invoice.id}`);
  } catch (error) {
    console.error("Error in handlePaymentSucceeded:", error);
  }
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  subscriptionService: SubscriptionService
) {
  try {
    // You can add logic here if you want to track failed payments
    console.log(`Payment failed for invoice ${invoice.id}`);
  } catch (error) {
    console.error("Error in handlePaymentFailed:", error);
  }
}

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  subscriptionService: SubscriptionService
) {
  try {
    let userId = subscription.metadata?.userId;
    if (!userId) {
      const found = await subscriptionService.findByStripeSubscriptionId(
        subscription.id
      );
      userId = found?.user_id || "";
    }
    userId = String(userId || "");
    if (!userId) {
      console.error("Could not find userId for subscription:", subscription.id);
      return;
    }
    console.log(
      `Creating subscription ${subscription.id} for user ${userId} with status: ${subscription.status}`
    );
    const currentPeriodStart =
      subscription.billing_cycle_anchor && subscription.billing_cycle_anchor > 0
        ? new Date(subscription.billing_cycle_anchor * 1000).toISOString()
        : new Date().toISOString();

    // Calculate current period end based on billing cycle anchor and subscription items
    let currentPeriodEnd = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    if (
      subscription.billing_cycle_anchor &&
      subscription.billing_cycle_anchor > 0
    ) {
      // Get the first subscription item to determine the interval
      const firstItem = subscription.items.data[0];
      if (firstItem?.price?.recurring?.interval) {
        const interval = firstItem.price.recurring.interval;
        const intervalCount = firstItem.price.recurring.interval_count || 1;

        // Calculate the end date based on the billing cycle anchor and interval
        const startDate = new Date(subscription.billing_cycle_anchor * 1000);
        let endDate = new Date(startDate);

        switch (interval) {
          case "day":
            endDate.setDate(startDate.getDate() + intervalCount);
            break;
          case "week":
            endDate.setDate(startDate.getDate() + intervalCount * 7);
            break;
          case "month":
            endDate.setMonth(startDate.getMonth() + intervalCount);
            break;
          case "year":
            endDate.setFullYear(startDate.getFullYear() + intervalCount);
            break;
        }

        currentPeriodEnd = endDate.toISOString();
      }
    }
    await subscriptionService.updateFromStripeWebhook(subscription.id, {
      status: mapStripeStatus(subscription.status),
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    });
    console.log(`Successfully created subscription for user ${userId}`);
  } catch (error) {
    console.error("Error in handleSubscriptionCreated:", error);
  }
}
