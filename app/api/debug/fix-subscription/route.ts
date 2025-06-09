import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { stripe } from "@/lib/stripe"

// Use admin client for webhook operations
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const userId = formData.get("userId") as string

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get user profile to verify
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has a subscription in Stripe
    // First, find customer ID if it exists
    const { data: existingSubscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle()

    let stripeSubscription

    if (existingSubscription?.stripe_subscription_id) {
      // Try to get subscription from Stripe
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(existingSubscription.stripe_subscription_id)
        console.log("Found existing Stripe subscription:", stripeSubscription.id)
      } catch (error) {
        console.error("Error retrieving Stripe subscription:", error)
      }
    }

    if (!stripeSubscription && existingSubscription?.stripe_customer_id) {
      // Try to find subscriptions by customer
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: existingSubscription.stripe_customer_id,
          limit: 1,
        })

        if (subscriptions.data.length > 0) {
          stripeSubscription = subscriptions.data[0]
          console.log("Found subscription by customer:", stripeSubscription.id)
        }
      } catch (error) {
        console.error("Error listing customer subscriptions:", error)
      }
    }

    if (!stripeSubscription) {
      return NextResponse.json(
        {
          error: "No Stripe subscription found",
          subscription: existingSubscription,
        },
        { status: 404 },
      )
    }

    // Get the Pro plan ID
    const { data: proPlan } = await supabaseAdmin.from("subscription_plans").select("id").eq("name", "Pro").single()

    if (!proPlan) {
      return NextResponse.json({ error: "Pro plan not found" }, { status: 404 })
    }

    // Update or create subscription record
    const subscriptionData = {
      user_id: userId,
      plan_id: proPlan.id,
      status: stripeSubscription.status === "active" ? "active" : "pending",
      billing_cycle: stripeSubscription.items.data[0]?.plan.interval === "year" ? "yearly" : "monthly",
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      stripe_subscription_id: stripeSubscription.id,
      stripe_customer_id: stripeSubscription.customer as string,
      updated_at: new Date().toISOString(),
    }

    let result
    if (existingSubscription) {
      // Update existing subscription
      result = await supabaseAdmin.from("user_subscriptions").update(subscriptionData).eq("user_id", userId)
    } else {
      // Create new subscription
      result = await supabaseAdmin.from("user_subscriptions").insert({
        ...subscriptionData,
        created_at: new Date().toISOString(),
      })
    }

    if (result.error) {
      return NextResponse.json(
        {
          error: "Error updating subscription",
          details: result.error,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "Subscription fixed successfully",
      subscription: subscriptionData,
    })
  } catch (error) {
    console.error("Error fixing subscription:", error)
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
