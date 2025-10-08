import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      loggerService.error('Webhook signature verification failed', err as Error, {
        category: LogCategory.SECURITY,
        action: 'stripe_webhook_invalid_signature',
        metadata: {
          hasSignature: !!signature
        }
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    loggerService.info('Received Stripe webhook', {
      category: LogCategory.PAYMENT,
      action: 'stripe_webhook_received',
      metadata: {
        eventType: event.type,
        eventId: event.id
      }
    });

    // Create service role client for webhook operations
    // This will throw if SUPABASE_SERVICE_ROLE_KEY is not set
    const serviceClient = createServiceRoleClient();
    const subscriptionService = new SubscriptionService(serviceClient);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          subscriptionService,
          serviceClient
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          subscriptionService,
          serviceClient
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
        loggerService.debug('Unhandled webhook event type', {
          category: LogCategory.PAYMENT,
          action: 'stripe_webhook_unhandled',
          metadata: {
            eventType: event.type
          }
        });
    }

    loggerService.info('Stripe webhook processed successfully', {
      category: LogCategory.PAYMENT,
      action: 'stripe_webhook_success',
      duration: Date.now() - startTime,
      metadata: {
        eventType: event.type,
        eventId: event.id
      }
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    loggerService.error('Webhook processing error', error as Error, {
      category: LogCategory.PAYMENT,
      action: 'stripe_webhook_error',
      duration: Date.now() - startTime
    });
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
  subscriptionService: SubscriptionService,
  serviceClient: SupabaseClient
) {
  const startTime = Date.now();
  
  try {
    const userId = String(session.metadata?.userId || "");
    const planId = session.metadata?.planId;
    const billingCycle = session.metadata?.billingCycle;

    loggerService.info('Processing checkout completion', {
      category: LogCategory.PAYMENT,
      userId,
      action: 'checkout_completed_processing',
      metadata: {
        sessionId: session.id,
        planId,
        billingCycle,
        amount: session.amount_total,
        currency: session.currency
      }
    });

    if (!userId || !planId) {
      loggerService.error('Missing metadata in checkout session', new Error('Missing metadata'), {
        category: LogCategory.PAYMENT,
        action: 'checkout_completed_invalid_metadata',
        metadata: {
          sessionId: session.id,
          hasUserId: !!userId,
          hasPlanId: !!planId
        }
      });
      return;
    }

    if (!session.subscription) {
      loggerService.error('No subscription ID in checkout session', new Error('No subscription'), {
        category: LogCategory.PAYMENT,
        userId,
        action: 'checkout_completed_no_subscription',
        metadata: {
          sessionId: session.id
        }
      });
      return;
    }

    // Get the plan name from the database using planId
    const { data: plan, error: planError } = await serviceClient
      .from("subscription_plans")
      .select("name")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error(`Plan not found for planId: ${planId}`, planError);
      return;
    }

    const planName = plan.name;
    console.log(`Mapped planId ${planId} to plan name: ${planName}`);

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

    await subscriptionService.createSubscriptionFromStripe(
      userId,
      String(session.customer || ""),
      subscription.id,
      planId,
      mapStripeStatus(subscription.status),
      currentPeriodStart,
      currentPeriodEnd,
      billingCycle as "monthly" | "yearly"
    );

    console.log(
      `Successfully processed subscription for user ${userId} with plan: ${planName}`
    );
    console.log(`Stripe customer ID: ${session.customer}`);
    console.log(`Stripe subscription ID: ${subscription.id}`);
    console.log(`Plan ID: ${planId}`);
    console.log(`Billing cycle: ${billingCycle}`);
    console.log(`Status: ${subscription.status}`);
    console.log(`Period start: ${currentPeriodStart}`);
    console.log(`Period end: ${currentPeriodEnd}`);
  } catch (error) {
    loggerService.error('Error in handleCheckoutCompleted', error as Error, {
      category: LogCategory.PAYMENT,
      userId: session.metadata?.userId,
      action: 'checkout_completed_error',
      duration: Date.now() - startTime,
      metadata: {
        sessionId: session.id,
        planId: session.metadata?.planId
      }
    });
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  subscriptionService: SubscriptionService,
  serviceClient: SupabaseClient
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
    
    // Get the current price ID from the subscription
    const currentPriceId = subscription.items.data[0]?.price?.id;
    let newPlanId: string | undefined;
    
    if (currentPriceId) {
      // Look up the plan based on the Stripe price ID
      const { data: plan } = await serviceClient
        .from("subscription_plans")
        .select("id")
        .or(`stripe_monthly_price_id.eq.${currentPriceId},stripe_yearly_price_id.eq.${currentPriceId}`)
        .single();
      
      if (plan) {
        newPlanId = plan.id;
        loggerService.info('Detected plan change', {
          category: LogCategory.PAYMENT,
          userId,
          action: 'subscription_plan_changed',
          metadata: {
            subscriptionId: subscription.id,
            newPlanId,
            priceId: currentPriceId
          }
        });
      }
    }
    
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
    const updateData: any = {
      status: mapStripeStatus(subscription.status),
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    };
    
    // Include plan_id if it changed
    if (newPlanId) {
      updateData.plan_id = newPlanId;
    }
    
    await subscriptionService.updateFromStripeWebhook(subscription.id, updateData);
    
    loggerService.info('Successfully updated subscription from webhook', {
      category: LogCategory.PAYMENT,
      userId,
      action: 'subscription_updated_success',
      metadata: {
        subscriptionId: subscription.id,
        status: subscription.status,
        planChanged: !!newPlanId,
        newPlanId
      }
    });
  } catch (error) {
    loggerService.error('Error in handleSubscriptionUpdated', error as Error, {
      category: LogCategory.PAYMENT,
      action: 'subscription_updated_error',
      metadata: {
        subscriptionId: subscription.id,
        customerId: subscription.customer
      }
    });
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
    loggerService.error('Error in handleSubscriptionDeleted', error as Error, {
      category: LogCategory.PAYMENT,
      action: 'subscription_deleted_error',
      metadata: {
        subscriptionId: subscription.id
      }
    });
  }
}

async function handlePaymentSucceeded(
  invoice: Stripe.Invoice,
  subscriptionService: SubscriptionService
) {
  try {
    // Track successful payment
    loggerService.logPaymentEvent(
      'payment_succeeded',
      invoice.amount_paid / 100, // Convert from cents
      invoice.currency,
      undefined,
      {
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription as string
        }
      }
    );
  } catch (error) {
    loggerService.error('Error in handlePaymentSucceeded', error as Error, {
      category: LogCategory.PAYMENT,
      action: 'payment_succeeded_error',
      metadata: {
        invoiceId: invoice.id
      }
    });
  }
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  subscriptionService: SubscriptionService
) {
  try {
    // Track failed payment
    loggerService.logPaymentEvent(
      'payment_failed',
      invoice.amount_due / 100, // Convert from cents
      invoice.currency,
      new Error(invoice.last_finalization_error?.message || 'Payment failed'),
      {
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription as string,
          attemptCount: invoice.attempt_count
        }
      }
    );
  } catch (error) {
    loggerService.error('Error in handlePaymentFailed', error as Error, {
      category: LogCategory.PAYMENT,
      action: 'payment_failed_error',
      metadata: {
        invoiceId: invoice.id
      }
    });
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
    
    loggerService.info('Successfully created subscription from webhook', {
      category: LogCategory.PAYMENT,
      userId,
      action: 'subscription_created_success',
      metadata: {
        subscriptionId: subscription.id,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        planId
      }
    });
  } catch (error) {
    loggerService.error('Error in handleSubscriptionCreated', error as Error, {
      category: LogCategory.PAYMENT,
      action: 'subscription_created_error',
      metadata: {
        subscriptionId: subscription.id
      }
    });
  }
}
