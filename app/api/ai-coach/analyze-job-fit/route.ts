import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { API_ROUTES } from "@/lib/constants/api-routes";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Check permission using middleware
    const permissionResult = await PermissionMiddleware.checkApiPermission(
      user.id,
      "JOB_FIT_ANALYSIS"
    );

    if (!permissionResult.allowed) {
      return NextResponse.json(
        {
          error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED,
        },
        { status: 403 }
      );
    }

    const { jobUrl, companyName, roleName } = await request.json();

    if (!jobUrl || !companyName || !roleName) {
      return NextResponse.json(
        {
          error: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS,
        },
        { status: 400 }
      );
    }

    // First, fetch the job description
    const fetchResponse = await fetch(
      `${request.nextUrl.origin}${API_ROUTES.AI_COACH.FETCH_JOB_DESCRIPTION}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ url: jobUrl }),
      }
    );

    if (!fetchResponse.ok) {
      const fetchError = await fetchResponse.json();
      return NextResponse.json(
        {
          error:
            fetchError.error || ERROR_MESSAGES.FETCH_JOB_DESCRIPTION_FAILED,
        },
        { status: 400 }
      );
    }

    const { description } = await fetchResponse.json();

    // Get user's profile/resume data if available
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

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
    };

    // Set score label based on score
    if (mockAnalysis.overallScore >= 80) {
      mockAnalysis.scoreLabel = "Excellent Match";
    } else if (mockAnalysis.overallScore >= 70) {
      mockAnalysis.scoreLabel = "Good Match";
    } else if (mockAnalysis.overallScore >= 60) {
      mockAnalysis.scoreLabel = "Fair Match";
    } else {
      mockAnalysis.scoreLabel = "Needs Improvement";
    }

    // Create job fit analysis record using service
    const aiCoachService = new AICoachService();
    await aiCoachService.createJobFitAnalysis(
      user.id,
      description,
      JSON.stringify(mockAnalysis),
      mockAnalysis.overallScore
    );

    return NextResponse.json({ analysis: mockAnalysis });
  } catch (error) {
    console.error("Job fit analysis error:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.JOB_FIT_ANALYSIS_FAILED },
      { status: 500 }
    );
  }
}
