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

    console.log(`Starting complete setup for user: ${userId}`)

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

    // 1. Ensure usage tracking exists
    const { data: existingUsage } = await supabaseAdmin
      .from("usage_tracking")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (!existingUsage) {
      console.log("Creating usage tracking record")
      const { data: applications } = await supabaseAdmin.from("applications").select("id").eq("user_id", userId)

      const { error: usageError } = await supabaseAdmin.from("usage_tracking").insert({
        user_id: userId,
        applications_count: applications?.length || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (usageError) {
        console.error("Error creating usage tracking:", usageError)
      }
    }

    // 2. Check for existing subscription
    const { data: existingSubscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (existingSubscription) {
      console.log("User already has a subscription")
      return NextResponse.redirect(new URL("/debug/subscription", request.url))
    }

    // 3. Find Stripe customers by email
    const customers = await stripe.customers.list({
      email: profile.email,
      limit: 10,
    })

    console.log(`Found ${customers.data.length} Stripe customers for email: ${profile.email}`)

    if (customers.data.length === 0) {
      // Create a free subscription if no Stripe customer exists
      console.log("No Stripe customer found, creating free subscription")
      await createFreeSubscription(userId)
      return NextResponse.redirect(new URL("/debug/subscription", request.url))
    }

    // 4. Get all subscriptions for all customers with this email
    let activeSubscription = null
    let customerId = null

    for (const customer of customers.data) {
      console.log(`Checking subscriptions for customer: ${customer.id}`)

      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 10,
      })

      console.log(`Found ${subscriptions.data.length} subscriptions for customer: ${customer.id}`)

      // Look for any subscription (active, trialing, etc.)
      const validSubscription = subscriptions.data.find((sub) =>
        ["active", "trialing", "past_due"].includes(sub.status),
      )

      if (validSubscription) {
        activeSubscription = validSubscription
        customerId = customer.id
        break
      }
    }

    if (!activeSubscription) {
      console.log("No active subscription found, creating free subscription")
      await createFreeSubscription(userId)
      return NextResponse.redirect(new URL("/debug/subscription", request.url))
    }

    console.log(`Found subscription: ${activeSubscription.id} with status: ${activeSubscription.status}`)

    // 5. Get the appropriate plan ID
    let planName = "Free"
    if (activeSubscription.items.data.length > 0) {
      const price = activeSubscription.items.data[0].price
      // Check if this is a paid subscription (price > 0)
      if (price.unit_amount && price.unit_amount > 0) {
        planName = "Pro"
      }
    }

    const { data: plan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("id")
      .eq("name", planName)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: `${planName} plan not found in database` }, { status: 404 })
    }

    console.log(`Using plan: ${planName} (ID: ${plan.id})`)

    // 6. Determine billing cycle
    const billingCycle = activeSubscription.items.data[0]?.price.recurring?.interval === "year" ? "yearly" : "monthly"

    // 7. Create subscription record
    const subscriptionData = {
      user_id: userId,
      plan_id: plan.id,
      status: mapStripeStatus(activeSubscription.status),
      billing_cycle: billingCycle,
      current_period_start: new Date(activeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(activeSubscription.current_period_end * 1000).toISOString(),
      stripe_subscription_id: activeSubscription.id,
      stripe_customer_id: customerId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log("Creating subscription record:", subscriptionData)

    const { error: subError } = await supabaseAdmin.from("user_subscriptions").insert(subscriptionData)

    if (subError) {
      console.error("Database error:", subError)
      return NextResponse.json(
        {
          error: "Error creating subscription in database",
          details: subError,
        },
        { status: 500 },
      )
    }

    console.log("Successfully completed setup")
    return NextResponse.redirect(new URL("/debug/subscription", request.url))
  } catch (error) {
    console.error("Error completing setup:", error)
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

async function createFreeSubscription(userId: string) {
  // Get the Free plan ID
  const { data: freePlan, error: planError } = await supabaseAdmin
    .from("subscription_plans")
    .select("id")
    .eq("name", "Free")
    .single()

  if (planError || !freePlan) {
    console.error("Free plan not found:", planError)
    return
  }

  // Create free subscription
  const { error: subError } = await supabaseAdmin.from("user_subscriptions").insert({
    user_id: userId,
    plan_id: freePlan.id,
    status: "active",
    billing_cycle: "monthly",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (subError) {
    console.error("Error creating free subscription:", subError)
  } else {
    console.log("Successfully created free subscription")
  }
}

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
      return "trialing"
  }
}
