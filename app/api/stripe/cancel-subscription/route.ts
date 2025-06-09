import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Get user's current subscription
    const { data: subscription, error } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single()

    if (error || !subscription) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 })
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json({ error: "No Stripe subscription ID found" }, { status: 400 })
    }

    // Cancel the subscription in Stripe (at period end)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Update the subscription status in our database
    const { error: updateError } = await supabaseAdmin
      .from("user_subscriptions")
      .update({ status: "canceled" })
      .eq("id", subscription.id)

    if (updateError) {
      console.error("Error updating subscription status:", updateError)
      return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Subscription canceled successfully" })
  } catch (error) {
    console.error("Error canceling subscription:", error)
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 })
  }
}
