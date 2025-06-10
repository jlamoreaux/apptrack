import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const userId = formData.get("userId") as string

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    console.log(`Creating free subscription for user: ${userId}`)

    // Check if user already has a subscription
    const { data: existingSubscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .single()

    if (existingSubscription) {
      return NextResponse.json({ error: "User already has a subscription" }, { status: 400 })
    }

    // Get the Free plan ID
    const { data: freePlan, error: planError } = await supabaseAdmin
      .from("subscription_plans")
      .select("id")
      .eq("name", "Free")
      .single()

    if (planError || !freePlan) {
      return NextResponse.json({ error: "Free plan not found in database" }, { status: 404 })
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
      return NextResponse.json(
        {
          error: "Error creating free subscription",
          details: subError,
        },
        { status: 500 },
      )
    }

    // Ensure usage tracking exists
    const { data: existingUsage } = await supabaseAdmin
      .from("usage_tracking")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (!existingUsage) {
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

    console.log("Successfully created free subscription")
    return NextResponse.redirect(new URL("/debug/subscription", request.url))
  } catch (error) {
    console.error("Error creating free subscription:", error)
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
