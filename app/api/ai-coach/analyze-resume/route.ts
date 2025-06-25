import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: cookieStore }
    );

    const {
      data: { user },
      error,
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
      "ANALYZE_RESUME"
    );

    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED },
        { status: 403 }
      );
    }

    const { resumeText, jobDescription } = await request.json();

    if (!resumeText) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.MISSING_RESUME },
        { status: 400 }
      );
    }

    const aiCoach = createAICoach(user.id);
    const analysis = await aiCoach.analyzeResume(resumeText, jobDescription);

    // Create resume analysis record using service
    const aiCoachService = new AICoachService();
    await aiCoachService.createResumeAnalysis(
      user.id,
      "resume_text", // Since we're using text, not a file URL
      JSON.stringify(analysis)
    );

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error in resume analysis:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.ANALYSIS_FAILED },
      { status: 500 }
    );
  }
}
