import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
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
      .select(
        `
        *,
        subscription_plans (name)
      `,
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    if (!subscription || subscription.subscription_plans?.name !== "AI Coach") {
      return NextResponse.json({ error: "AI Coach subscription required" }, { status: 403 })
    }

    const { jobDescription, userBackground, companyName } = await request.json()

    if (!jobDescription || !userBackground || !companyName) {
      return NextResponse.json(
        { error: "Job description, user background, and company name are required" },
        { status: 400 },
      )
    }

    const aiCoach = createAICoach(user.id)
    const coverLetter = await aiCoach.generateCoverLetter(jobDescription, userBackground, companyName)

    return NextResponse.json({ coverLetter })
  } catch (error) {
    console.error("Error generating cover letter:", error)
    return NextResponse.json({ error: "Failed to generate cover letter" }, { status: 500 })
  }
}
