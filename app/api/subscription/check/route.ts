import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Check for active subscription
    const { data: subscription, error } = await supabaseAdmin
      .from("user_subscriptions")
      .select(`
        *,
        subscription_plans (*)
      `)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle()

    if (error) {
      console.error("Error checking subscription:", error)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    // Check if subscription is for Pro plan
    const isPro = subscription?.subscription_plans?.name === "Pro"

    return NextResponse.json({
      isActive: !!subscription && isPro,
      subscription: subscription || null,
    })
  } catch (error) {
    console.error("Unexpected error checking subscription:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
