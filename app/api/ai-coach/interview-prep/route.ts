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
      "INTERVIEW_PREP"
    );

    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED },
        { status: 403 }
      );
    }

    const { jobDescription, jobUrl, userBackground, userResumeId, resumeText } =
      await request.json();

    // Get resume context (id and text)
    let finalResumeText = resumeText;
    let finalUserResumeId = userResumeId;
    if (!finalResumeText) {
      const resumeDAL = new ResumeDAL();
      const currentResume = await resumeDAL.findCurrentByUserId(user.id);
      if (currentResume) {
        finalResumeText = currentResume.extracted_text;
        finalUserResumeId = currentResume.id;
      }
    }
    if (!finalResumeText) {
      return NextResponse.json(
        { error: "No resume found. Please upload your resume first." },
        { status: 400 }
      );
    }

    const effectiveJobDescription = jobDescription || undefined;
    const effectiveJobUrl = jobUrl || undefined;
    if (!effectiveJobDescription && !effectiveJobUrl) {
      return NextResponse.json(
        {
          error: ERROR_MESSAGES.AI_COACH.INTERVIEW_PREP.MISSING_JOB_DESCRIPTION,
        },
        { status: 400 }
      );
    }

    // Deduplication: check for existing interview prep
    const aiCoachService = new AICoachService();
    const existing = await aiCoachService.findExistingInterviewPrep({
      user_id: user.id,
      user_resume_id: finalUserResumeId,
      resume_text: finalResumeText,
      job_description: effectiveJobDescription,
      job_url: effectiveJobUrl,
      user_background: userBackground,
    });
    if (existing) {
      return NextResponse.json({ preparation: existing.prep_content });
    }

    const aiCoach = createAICoach(user.id);
    const prepJobDesc = effectiveJobDescription || effectiveJobUrl;
    const preparation = await aiCoach.prepareForInterview({
      jobDescription: prepJobDesc!,
      userBackground,
      resumeText: finalResumeText,
    });

    // Save new interview prep
    await aiCoachService.createInterviewPrep({
      user_id: user.id,
      user_resume_id: finalUserResumeId,
      resume_text: finalResumeText,
      job_description: effectiveJobDescription,
      job_url: effectiveJobUrl,
      user_background: userBackground,
      prep_content: preparation,
    });

    return NextResponse.json({ preparation });
  } catch (error) {
    console.error("Error in interview preparation:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.INTERVIEW_PREP.GENERATION_FAILED },
      { status: 500 }
    );
  }
}
