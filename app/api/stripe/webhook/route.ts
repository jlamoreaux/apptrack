import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

// Use admin client for webhook operations
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    console.log(`Received Stripe webhook: ${event.type} with ID ${event.id}`)

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}

// Helper function to map Stripe status to our database status
function mapStripeStatus(stripeStatus: string): "active" | "canceled" | "past_due" | "trialing" {
  switch (stripeStatus) {
    case "active":
      return "active"
    case "canceled":
      return "canceled"
    case "past_due":
      return "past_due"
    case "trialing":
      return "trialing"
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    default:
      return "trialing" // Default to trialing for any unknown or pending states
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const userId = session.metadata?.userId
    const planId = session.metadata?.planId
    const billingCycle = session.metadata?.billingCycle

    console.log(`Processing checkout completion for user ${userId}, plan ${planId}, billing ${billingCycle}`)

    if (!userId || !planId) {
      console.error("Missing metadata in checkout session:", session.id)
      return
    }

    // Get the subscription from Stripe
    if (!session.subscription) {
      console.error("No subscription ID in checkout session:", session.id)
      return
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    console.log(`Retrieved Stripe subscription: ${subscription.id} with status: ${subscription.status}`)

    // Validate timestamps before converting
    const currentPeriodStart =
      subscription.current_period_start && subscription.current_period_start > 0
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : new Date().toISOString()

    const currentPeriodEnd =
      subscription.current_period_end && subscription.current_period_end > 0
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Default to 30 days from now

    // Check if a subscription already exists for this user
    const { data: existingSubscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .single()

    const subscriptionData = {
      user_id: userId,
      plan_id: planId,
      status: mapStripeStatus(subscription.status),
      billing_cycle: billingCycle as "monthly" | "yearly",
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: session.customer as string,
      updated_at: new Date().toISOString(),
    }

    console.log(`Subscription data to save:`, subscriptionData)

    let result
    if (existingSubscription) {
      // Update existing subscription
      console.log(`Updating existing subscription for user ${userId}`)
      result = await supabaseAdmin.from("user_subscriptions").update(subscriptionData).eq("user_id", userId)
    } else {
      // Create new subscription
      console.log(`Creating new subscription for user ${userId}`)
      result = await supabaseAdmin.from("user_subscriptions").insert({
        ...subscriptionData,
        created_at: new Date().toISOString(),
      })
    }

    if (result.error) {
      console.error("Error updating subscription in database:", result.error)
    } else {
      console.log(`Successfully processed subscription for user ${userId}`)
    }
  } catch (error) {
    console.error("Error in handleCheckoutCompleted:", error)
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    // First try to get userId from metadata
    let userId = subscription.metadata?.userId

    // If not in metadata, look it up in the database
    if (!userId) {
      const { data } = await supabaseAdmin
        .from("user_subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subscription.id)
        .single()

      userId = data?.user_id
    }

    if (!userId) {
      console.error("Could not find userId for subscription:", subscription.id)
      return
    }

    console.log(`Updating subscription ${subscription.id} for user ${userId} with status: ${subscription.status}`)

    // Validate timestamps before converting
    const currentPeriodStart =
      subscription.current_period_start && subscription.current_period_start > 0
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : new Date().toISOString()

    const currentPeriodEnd =
      subscription.current_period_end && subscription.current_period_end > 0
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        status: mapStripeStatus(subscription.status),
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscription.id)

    if (error) {
      console.error("Error updating subscription:", error)
    } else {
      console.log(`Successfully updated subscription ${subscription.id}`)
    }
  } catch (error) {
    console.error("Error in handleSubscriptionUpdated:", error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    console.log(`Processing subscription deletion: ${subscription.id}`)

    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscription.id)

    if (error) {
      console.error("Error canceling subscription:", error)
    } else {
      console.log(`Successfully marked subscription ${subscription.id} as canceled`)
    }
  } catch (error) {
    console.error("Error in handleSubscriptionDeleted:", error)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    // Update subscription status to active if it was past_due
    if (invoice.subscription) {
      console.log(`Processing successful payment for subscription: ${invoice.subscription}`)

      const { error } = await supabaseAdmin
        .from("user_subscriptions")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", invoice.subscription)

      if (error) {
        console.error("Error updating subscription after payment:", error)
      } else {
        console.log(`Successfully updated subscription ${invoice.subscription} to active`)
      }
    }
  } catch (error) {
    console.error("Error in handlePaymentSucceeded:", error)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    // Update subscription status to past_due
    if (invoice.subscription) {
      console.log(`Processing failed payment for subscription: ${invoice.subscription}`)

      const { error } = await supabaseAdmin
        .from("user_subscriptions")
        .update({
          status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", invoice.subscription)

      if (error) {
        console.error("Error updating subscription after failed payment:", error)
      } else {
        console.log(`Successfully updated subscription ${invoice.subscription} to past_due`)
      }
    }
  } catch (error) {
    console.error("Error in handlePaymentFailed:", error)
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    // First try to get userId from metadata
    const userId = subscription.metadata?.userId
    const planId = subscription.metadata?.planId
    const billingCycle = subscription.metadata?.billingCycle

    console.log(
      `Processing subscription creation: ${subscription.id} for user ${userId} with status: ${subscription.status}`,
    )

    if (!userId || !planId) {
      console.error("Missing metadata in subscription:", subscription.id)
      return
    }

    // Validate timestamps before converting
    const currentPeriodStart =
      subscription.current_period_start && subscription.current_period_start > 0
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : new Date().toISOString()

    const currentPeriodEnd =
      subscription.current_period_end && subscription.current_period_end > 0
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Check if a subscription already exists for this user
    const { data: existingSubscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .single()

    const subscriptionData = {
      user_id: userId,
      plan_id: planId,
      status: mapStripeStatus(subscription.status),
      billing_cycle: billingCycle as "monthly" | "yearly",
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      updated_at: new Date().toISOString(),
    }

    console.log(`Subscription data to save:`, subscriptionData)

    let result
    if (existingSubscription) {
      // Update existing subscription
      console.log(`Updating existing subscription for user ${userId}`)
      result = await supabaseAdmin.from("user_subscriptions").update(subscriptionData).eq("user_id", userId)
    } else {
      // Create new subscription
      console.log(`Creating new subscription for user ${userId}`)
      result = await supabaseAdmin.from("user_subscriptions").insert({
        ...subscriptionData,
        created_at: new Date().toISOString(),
      })
    }

    if (result.error) {
      console.error("Error creating/updating subscription:", result.error)
    } else {
      console.log(`Successfully processed subscription creation for user ${userId}`)
    }
  } catch (error) {
    console.error("Error in handleSubscriptionCreated:", error)
  }
}
