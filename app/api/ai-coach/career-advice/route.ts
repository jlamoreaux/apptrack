import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAICoach } from "@/lib/ai-coach"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has AI Coach subscription
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select(`
        *,
        subscription_plans (name)
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    if (!subscription || subscription.subscription_plans?.name !== "AI Coach") {
      return NextResponse.json({ error: "AI Coach subscription required" }, { status: 403 })
    }

    const { question, context } = await request.json()

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 })
    }

    const aiCoach = createAICoach(user.id)
    const advice = await aiCoach.askCareerQuestion(question, context)

    return NextResponse.json({ advice })
  } catch (error) {
    console.error("Error getting career advice:", error)
    return NextResponse.json({ error: "Failed to get career advice" }, { status: 500 })
  }
}
