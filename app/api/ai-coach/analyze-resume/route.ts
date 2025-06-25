import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { ResumeDAL } from "@/dal/resumes";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    const { resumeText, jobDescription, jobUrl, userResumeId } =
      await request.json();

    let finalResumeText = resumeText;
    let finalUserResumeId = userResumeId;
    if (!finalResumeText) {
      // Fetch the current resume for the user if not provided
      const resumeDAL = new ResumeDAL();
      const currentResume = await resumeDAL.findCurrentByUserId(user.id);
      if (currentResume) {
        finalResumeText = currentResume.extracted_text;
        finalUserResumeId = currentResume.id;
      }
    }
    if (!finalResumeText && !jobUrl) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.MISSING_RESUME },
        { status: 400 }
      );
    }

    const aiCoachService = new AICoachService();
    // Check for existing analysis (cache)
    const existing = await aiCoachService.findExistingResumeAnalysis({
      user_id: user.id,
      user_resume_id: finalUserResumeId,
      resume_text: finalResumeText,
      job_description: jobDescription,
      job_url: jobUrl,
    });
    if (existing) {
      return NextResponse.json({ analysis: existing.analysis_result });
    }

    const aiCoach = createAICoach(user.id);
    const analysis = await aiCoach.analyzeResume(
      finalResumeText,
      jobDescription
    );

    // Create resume analysis record using service
    await aiCoachService.createResumeAnalysis(user.id, {
      user_resume_id: finalUserResumeId,
      resume_text: finalResumeText,
      job_description: jobDescription,
      job_url: jobUrl,
      analysis_result: analysis,
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error in resume analysis:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.ANALYSIS_FAILED },
      { status: 500 }
    );
  }
}
