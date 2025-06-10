import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { stripe } from "@/lib/stripe"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const userId = formData.get("userId") as string

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    console.log(`Starting subscription sync for user: ${userId}`)

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log(`Found user profile: ${profile.email}`)

    // Find Stripe customers by email
    const customers = await stripe.customers.list({
      email: profile.email,
      limit: 10,
    })

    console.log(`Found ${customers.data.length} Stripe customers for email: ${profile.email}`)

    if (customers.data.length === 0) {
      return NextResponse.json({ error: "No Stripe customer found for this email" }, { status: 404 })
    }

    // Get all subscriptions for all customers with this email
    let activeSubscription = null
    let customerId = null

    for (const customer of customers.data) {
      console.log(`Checking subscriptions for customer: ${customer.id}`)

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 10,
      })

      console.log(`Found ${subscriptions.data.length} active subscriptions for customer: ${customer.id}`)

      if (subscriptions.data.length > 0) {
        activeSubscription = subscriptions.data[0] // Get the first active subscription
        customerId = customer.id
        break
      }
    }

    if (!activeSubscription) {
      return NextResponse.json({ error: "No active subscription found in Stripe" }, { status: 404 })
    }

    console.log(`Found active subscription: ${activeSubscription.id}`)

    // Get the Pro plan ID from database
    const { data: proPlan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("id")
      .eq("name", "Pro")
      .single()

    if (planError || !proPlan) {
      return NextResponse.json({ error: "Pro plan not found in database" }, { status: 404 })
    }

    console.log(`Found Pro plan ID: ${proPlan.id}`)

    // Determine billing cycle
    const billingCycle = activeSubscription.items.data[0]?.price.recurring?.interval === "year" ? "yearly" : "monthly"

    // Prepare subscription data
    const subscriptionData = {
      user_id: userId,
      plan_id: proPlan.id,
      status: "active",
      billing_cycle: billingCycle,
      current_period_start: new Date(activeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(activeSubscription.current_period_end * 1000).toISOString(),
      stripe_subscription_id: activeSubscription.id,
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    }

    console.log("Subscription data to upsert:", subscriptionData)

    // Check if subscription already exists
    const { data: existingSubscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    let result
    if (existingSubscription) {
      console.log("Updating existing subscription")
      result = await supabaseAdmin.from("user_subscriptions").update(subscriptionData).eq("user_id", userId)
    } else {
      console.log("Creating new subscription")
      result = await supabaseAdmin.from("user_subscriptions").insert({
        ...subscriptionData,
        created_at: new Date().toISOString(),
      })
    }

    if (result.error) {
      console.error("Database error:", result.error)
      return NextResponse.json(
        {
          error: "Error updating subscription in database",
          details: result.error,
        },
        { status: 500 },
      )
    }

    console.log("Successfully synced subscription")

    // Redirect back to debug page
    return NextResponse.redirect(new URL("/debug/subscription", request.url))
  } catch (error) {
    console.error("Error syncing subscription:", error)
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
