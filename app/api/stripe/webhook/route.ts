import { type NextRequest, NextResponse, after } from "next/server";
import { stripe } from "@/lib/stripe";
import { SubscriptionService } from "@/services/subscriptions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { transitionAudience } from "@/lib/email/drip-scheduler";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { sendTrialEndingEmail } from "@/lib/email/transactional";
import type { SubscriptionStatus } from "@/lib/constants/subscription-status";

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
          serviceClient,
          event.data.previous_attributes as Record<string, unknown> | undefined
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

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(
          event.data.object as Stripe.Subscription,
          subscriptionService,
          serviceClient
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

// Helper function to map Stripe status to our database status.
// Exported for unit testing (see __tests__/api/stripe-status-map.test.ts).
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    // Non-entitled Stripe states map to "canceled" so they never grant the plan.
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    case "paused":
      return "canceled";
    default:
      // Fail closed: an unknown/future Stripe status must not silently grant
      // entitlements. Real trials always arrive as the explicit "trialing"
      // case above, and a paid signup briefly in "incomplete" transitions to
      // "active" via a later subscription.updated webhook that overwrites this.
      return "canceled";
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
      loggerService.error('Plan not found for planId', planError as Error, {
        category: LogCategory.PAYMENT,
        action: 'checkout_plan_lookup_error',
        metadata: { planId },
      });
      return;
    }

    const planName = plan.name;
    loggerService.debug('Mapped planId to plan name', {
      category: LogCategory.PAYMENT,
      action: 'checkout_plan_mapped',
      metadata: { planId, planName },
    });

    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    loggerService.debug('Retrieved Stripe subscription', {
      category: LogCategory.PAYMENT,
      action: 'checkout_subscription_retrieved',
      metadata: { subscriptionId: subscription.id, status: subscription.status },
    });

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

    loggerService.info('Subscription created from checkout', {
      category: LogCategory.PAYMENT,
      action: 'checkout_subscription_created',
      userId,
      metadata: {
        planId,
        planName,
        billingCycle,
        stripeCustomerId: String(session.customer),
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        periodStart: currentPeriodStart,
        periodEnd: currentPeriodEnd,
      },
    });

    after(() => captureServerEvent(userId, 'upgrade_completed', {
      plan: planName,
      billing_cycle: billingCycle,
      amount: session.amount_total,
      offer_variant: subscription.metadata?.offer_variant || subscription.metadata?.utm_content || null,
      utm_source: subscription.metadata?.utm_source ?? null,
      utm_medium: subscription.metadata?.utm_medium ?? null,
      utm_campaign: subscription.metadata?.utm_campaign ?? null,
      utm_content: subscription.metadata?.utm_content ?? null,
      has_trial: subscription.status === "trialing",
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    }));

    // Transition user audience (non-blocking)
    if (session.customer_email || session.customer_details?.email) {
      const customerEmail = session.customer_email || session.customer_details?.email;

      if (subscription.status === "trialing") {
        // Move to trial-users — will transition to paid-users on trial_converted
        transitionAudience(customerEmail!, 'free-users', 'trial-users', {
          userId,
          metadata: {
            source: 'stripe-checkout-trial',
            planName,
            subscriptionId: subscription.id,
          },
        }).catch((err) => {
          loggerService.error('Failed to transition to trial-users audience', err, {
            category: LogCategory.PAYMENT,
            action: 'drip_audience_transition_error',
            userId,
          });
        });
      } else {
        // Active subscription — move to paid-users
        transitionAudience(customerEmail!, 'trial-users', 'paid-users', {
          userId,
          metadata: {
            source: 'stripe-checkout',
            planName,
            subscriptionId: subscription.id,
          },
        }).catch((err) => {
          transitionAudience(customerEmail!, 'free-users', 'paid-users', {
            userId,
            metadata: {
              source: 'stripe-checkout',
              planName,
              subscriptionId: subscription.id,
            },
          }).catch((fallbackErr) => {
            loggerService.error('Failed to transition to paid-users audience', fallbackErr, {
              category: LogCategory.PAYMENT,
              action: 'drip_audience_transition_error',
              userId,
            });
          });
        });
      }
    }
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
  serviceClient: SupabaseClient,
  previousAttributes?: Record<string, unknown>
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
      loggerService.error('Could not find userId for subscription update', new Error('Missing userId'), {
        category: LogCategory.PAYMENT,
        action: 'subscription_update_missing_user',
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }
    loggerService.info('Updating subscription', {
      category: LogCategory.PAYMENT,
      action: 'subscription_update_start',
      userId,
      metadata: { subscriptionId: subscription.id, status: subscription.status },
    });
    
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

    // Detect trial → paid conversion
    if (
      previousAttributes?.status === "trialing" &&
      subscription.status === "active"
    ) {
      after(() => captureServerEvent(userId, "trial_converted", {
        offer_variant: subscription.metadata?.offer_variant ?? null,
        utm_source: subscription.metadata?.utm_source ?? null,
        utm_medium: subscription.metadata?.utm_medium ?? null,
        utm_campaign: subscription.metadata?.utm_campaign ?? null,
        utm_content: subscription.metadata?.utm_content ?? null,
        subscription_id: subscription.id,
      }));

      // Now move from trial-users to paid-users
      const customer = await stripe.customers.retrieve(subscription.customer as string);
      const email = 'deleted' in customer ? null : customer.email;
      if (email) {
        transitionAudience(email, 'trial-users', 'paid-users', {
          userId,
          metadata: {
            source: 'trial-converted',
            subscriptionId: subscription.id,
          },
        }).catch((err) => {
          loggerService.error('Failed to transition trial-converted user to paid-users', err, {
            category: LogCategory.PAYMENT,
            action: 'drip_audience_transition_error',
            userId,
          });
        });
      }
    }
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
      loggerService.error('Could not find userId for subscription deletion', new Error('Missing userId'), {
        category: LogCategory.PAYMENT,
        action: 'subscription_delete_missing_user',
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }
    loggerService.info('Deleting subscription', {
      category: LogCategory.PAYMENT,
      action: 'subscription_delete_start',
      userId,
      metadata: { subscriptionId: subscription.id },
    });
    await subscriptionService.updateFromStripeWebhook(subscription.id, {
      status: "canceled",
      cancel_at_period_end: true,
    });
    loggerService.info('Subscription marked as canceled', {
      category: LogCategory.PAYMENT,
      action: 'subscription_canceled',
      userId,
      metadata: { subscriptionId: subscription.id },
    });
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

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.apptrack.ing";

const TRIAL_PLAN_NAME_FALLBACK = "your AppTrack plan";

/**
 * Build human-readable charge cadence wording from a Stripe recurring price.
 * The email renders "per <cadence>", so the multi-count branch must not include
 * "every" (would read "per every 3 months").
 * Examples: "month", "year", "3 months", "2 weeks".
 */
function formatCadence(
  interval: Stripe.Price.Recurring.Interval,
  intervalCount: number
): string {
  if (intervalCount > 1) {
    return `${intervalCount} ${interval}s`;
  }
  return interval;
}

/**
 * Format a charge amount (minor units) into a localized currency string.
 * Returns `undefined` if the currency code is malformed: `Intl.NumberFormat`
 * throws on a bad currency, and since this runs inside the handler's main try
 * that would rethrow → infinite Stripe retries. Falling back to `undefined`
 * lets the email use the generic "your plan will renew" copy instead.
 */
function formatChargeAmount(
  unitAmountMinor: number,
  currency: string
): string | undefined {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(unitAmountMinor / 100);
  } catch {
    return undefined;
  }
}

/** Format a trial-end Date for display with a pinned locale. */
function formatTrialEndDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

/**
 * Look up the plan display name by Stripe price id, returning a neutral
 * fallback if not found or on error. Never throws — a missing plan name must
 * not block a compliance-required pre-charge notice.
 */
async function resolvePlanName(
  serviceClient: SupabaseClient,
  priceId: string | undefined
): Promise<string> {
  if (!priceId) {
    return TRIAL_PLAN_NAME_FALLBACK;
  }
  try {
    const { data: plan } = await serviceClient
      .from("subscription_plans")
      .select("name")
      .or(
        `stripe_monthly_price_id.eq.${priceId},stripe_yearly_price_id.eq.${priceId}`
      )
      .maybeSingle();
    return plan?.name || TRIAL_PLAN_NAME_FALLBACK;
  } catch {
    return TRIAL_PLAN_NAME_FALLBACK;
  }
}

/**
 * Handle Stripe's `customer.subscription.trial_will_end` event (~3 days before
 * a paid trial charges) by sending the customer a pre-charge notice.
 *
 * Exported for unit testing (see __tests__/api/stripe-trial-will-end.test.ts).
 *
 * Skip-vs-rethrow policy: "skip" outcomes (no userId, already notified, won't
 * charge, no email, no trial_end) are normal non-error states — they `return`
 * inside the try and the catch is never reached, so the webhook returns 2xx and
 * Stripe stops. Genuine failures (a `findByStripeSubscriptionId` throw, a send
 * failure, or any unexpected throw) propagate to the catch, are logged, and are
 * RETHROWN so the route returns non-2xx and Stripe retries — favoring delivery
 * of a compliance notice. `trial_ending_notified_at` is stamped only after a
 * successful send, so retries never double-notify.
 */
export async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  subscriptionService: SubscriptionService,
  serviceClient: SupabaseClient
) {
  try {
    // Resolve userId from metadata, falling back to the local row. We fetch the
    // local row regardless because it also carries the idempotency timestamp.
    const local = await subscriptionService.findByStripeSubscriptionId(
      subscription.id
    );
    const userId = String(subscription.metadata?.userId || local?.user_id || "");
    if (!userId) {
      loggerService.warn("Skipping trial_will_end: unresolved userId", {
        category: LogCategory.PAYMENT,
        action: "trial_will_end_missing_user",
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }

    // Require the local row: it's the idempotency anchor. Without it we can't
    // record that the notice was sent (updateFromStripeWebhook no-ops when no
    // row matches), so sending would risk duplicates on Stripe redelivery. A
    // real Stripe trial always has a local row by the time trial_will_end fires
    // (created on customer.subscription.created).
    if (!local) {
      loggerService.warn("Skipping trial_will_end: no local row", {
        category: LogCategory.PAYMENT,
        userId,
        action: "trial_will_end_no_local_row",
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }

    // Idempotency: never double-notify if we already sent this notice.
    if (local?.trial_ending_notified_at) {
      loggerService.info("Skipping trial_will_end: already notified", {
        category: LogCategory.PAYMENT,
        userId,
        action: "trial_will_end_already_notified",
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }

    // Scope guard: only notify trials that will actually charge.
    if (subscription.status !== "trialing" || subscription.cancel_at_period_end) {
      loggerService.info("Skipping trial_will_end: not a charging trial", {
        category: LogCategory.PAYMENT,
        userId,
        action: "trial_will_end_not_charging",
        metadata: {
          subscriptionId: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
      return;
    }

    // The customer retrieve is required: for Checkout trials the card lives on
    // the customer, not the (un-expanded) subscription payload.
    const customer = await stripe.customers.retrieve(
      subscription.customer as string
    );
    if ("deleted" in customer) {
      loggerService.info("Skipping trial_will_end: customer deleted", {
        category: LogCategory.PAYMENT,
        userId,
        action: "trial_will_end_customer_deleted",
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }

    const hasPaymentMethod = Boolean(
      subscription.default_payment_method ||
        customer.invoice_settings?.default_payment_method ||
        customer.default_source
    );
    if (!hasPaymentMethod) {
      loggerService.info("Skipping trial_will_end: no payment method on file", {
        category: LogCategory.PAYMENT,
        userId,
        action: "trial_will_end_no_payment_method",
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }

    const email = customer.email;
    if (!email) {
      loggerService.info("Skipping trial_will_end: customer has no email", {
        category: LogCategory.PAYMENT,
        userId,
        action: "trial_will_end_no_email",
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }

    if (!subscription.trial_end) {
      loggerService.info("Skipping trial_will_end: no trial_end", {
        category: LogCategory.PAYMENT,
        userId,
        action: "trial_will_end_no_trial_end",
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }

    // Don't email "your trial ends on <past date>" for a late/retried event.
    if (subscription.trial_end * 1000 <= Date.now()) {
      loggerService.info("Skipping trial_will_end: trial_end in the past", {
        category: LogCategory.PAYMENT,
        userId,
        action: "trial_will_end_stale",
        metadata: {
          subscriptionId: subscription.id,
          trialEnd: subscription.trial_end,
        },
      });
      return;
    }

    const trialEndDate = formatTrialEndDate(
      new Date(subscription.trial_end * 1000)
    );

    const price = subscription.items.data[0]?.price;
    const unitAmount = price?.unit_amount ?? null;
    const currency = price?.currency || "usd";
    const interval = price?.recurring?.interval;
    const intervalCount = price?.recurring?.interval_count || 1;

    const amountFormatted =
      unitAmount != null ? formatChargeAmount(unitAmount, currency) : undefined;
    const cadence = interval
      ? formatCadence(interval, intervalCount)
      : "billing period";

    const planName = await resolvePlanName(serviceClient, price?.id);

    const manageUrl = `${APP_URL}/dashboard/settings`;

    const result = await sendTrialEndingEmail({
      email,
      firstName: customer.name?.split(" ")[0] || undefined,
      planName,
      amountFormatted,
      cadence,
      trialEndDate,
      manageUrl,
    });

    if (!result.success) {
      // Throw so the outer catch rethrows → webhook returns non-2xx → Stripe
      // retries. The row is left unstamped, so the retry will re-attempt.
      throw new Error("sendTrialEndingEmail failed");
    }

    await subscriptionService.updateFromStripeWebhook(subscription.id, {
      trial_ending_notified_at: new Date().toISOString(),
    });

    after(() =>
      captureServerEvent(userId, "trial_ending_notified", {
        subscription_id: subscription.id,
        amount_cents: unitAmount ?? null,
        currency,
        interval,
        trial_end: subscription.trial_end,
      })
    );

    loggerService.info("Sent trial-ending notice", {
      category: LogCategory.PAYMENT,
      userId,
      action: "trial_will_end_notified",
      metadata: { subscriptionId: subscription.id },
    });
  } catch (error) {
    loggerService.error("Error in handleTrialWillEnd", error as Error, {
      category: LogCategory.PAYMENT,
      action: "trial_will_end_error",
      metadata: { subscriptionId: subscription.id },
    });
    // Rethrow so a genuine failure surfaces as non-2xx and Stripe retries.
    throw error;
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
      loggerService.error('Could not find userId for subscription creation', new Error('Missing userId'), {
        category: LogCategory.PAYMENT,
        action: 'subscription_create_missing_user',
        metadata: { subscriptionId: subscription.id },
      });
      return;
    }
    loggerService.info('Creating subscription', {
      category: LogCategory.PAYMENT,
      action: 'subscription_create_start',
      userId,
      metadata: { subscriptionId: subscription.id, status: subscription.status },
    });
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
