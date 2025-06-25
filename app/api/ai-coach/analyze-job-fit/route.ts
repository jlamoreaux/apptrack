import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check subscription status
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, plan_type")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    if (!subscription || subscription.plan_type === "free") {
      return NextResponse.json({ error: "AI Coach features require a Pro or AI Coach subscription" }, { status: 403 })
    }

    const { jobUrl, companyName, roleName } = await request.json()

    if (!jobUrl || !companyName || !roleName) {
      return NextResponse.json({ error: "Job URL, company name, and role name are required" }, { status: 400 })
    }

    // First, fetch the job description
    const fetchResponse = await fetch(`${request.nextUrl.origin}/api/ai-coach/fetch-job-description`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ url: jobUrl }),
    })

    if (!fetchResponse.ok) {
      const fetchError = await fetchResponse.json()
      return NextResponse.json({ error: fetchError.error || "Failed to fetch job description" }, { status: 400 })
    }

    const { description } = await fetchResponse.json()

    // Get user's profile/resume data if available
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    // For now, we'll create a mock analysis
    // In a real implementation, you'd call your AI service here
    const mockAnalysis = {
      overallScore: Math.floor(Math.random() * 40) + 60, // 60-100%
      scoreLabel: "",
      strengths: [
        "Strong technical background aligns with role requirements",
        "Previous experience in similar industry",
        "Educational background matches job qualifications",
      ],
      weaknesses: [
        "Limited experience with specific technology mentioned",
        "Could benefit from additional certifications",
        "Gap in leadership experience for senior role",
      ],
      recommendations: [
        "Highlight relevant projects in your application",
        "Consider obtaining certification in required technology",
        "Emphasize transferable skills from previous roles",
        "Prepare examples demonstrating problem-solving abilities",
      ],
      keyRequirements: [
        "3+ years experience",
        "JavaScript/TypeScript",
        "React/Next.js",
        "Database design",
        "Team collaboration",
      ],
    }

    // Set score label based on score
    if (mockAnalysis.overallScore >= 80) {
      mockAnalysis.scoreLabel = "Excellent Match"
    } else if (mockAnalysis.overallScore >= 70) {
      mockAnalysis.scoreLabel = "Good Match"
    } else if (mockAnalysis.overallScore >= 60) {
      mockAnalysis.scoreLabel = "Fair Match"
    } else {
      mockAnalysis.scoreLabel = "Needs Improvement"
    }

    // Track usage
    await supabase.from("ai_usage").insert({
      user_id: user.id,
      feature_type: "job_fit_analysis",
      tokens_used: 1000, // Estimate
    })

    return NextResponse.json({ analysis: mockAnalysis })
  } catch (error) {
    console.error("Job fit analysis error:", error)
    return NextResponse.json({ error: "Failed to analyze job fit" }, { status: 500 })
  }
}
