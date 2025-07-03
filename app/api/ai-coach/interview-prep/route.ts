import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { ResumeDAL } from "@/dal/resumes";
import { InterviewPrepTransformerService } from "@/lib/services/interview-prep-transformer";
import type { InterviewPreparationResult } from "@/types/ai-analysis";

// API Request/Response interfaces
interface InterviewPrepRequest {
  jobDescription?: string;
  jobUrl?: string;
  interviewContext?: string;
  userResumeId?: string;
  resumeText?: string;
  structured?: boolean;
}

interface InterviewPrepResponse {
  preparation: string | InterviewPreparationResult;
  cached?: boolean;
  transformationTime?: number;
}

interface InterviewPrepErrorResponse {
  error: string;
}

// Internal types for better type safety
type DatabasePrepContent = string | InterviewPreparationResult | null;

interface ParsedInterviewContext {
  company: string;
  role: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<InterviewPrepResponse | InterviewPrepErrorResponse>> {
  const transformer = new InterviewPrepTransformerService();
  
  try {
    // 1. Authentication
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // 2. Authorization
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

    // 3. Parse and validate request
    const body: InterviewPrepRequest = await request.json();
    const {
      jobDescription,
      jobUrl,
      interviewContext,
      userResumeId,
      resumeText,
      structured = false,
    } = body;

    // 4. Resolve resume data
    const { finalResumeText, finalUserResumeId } = await resolveResumeData(
      user.id,
      resumeText,
      userResumeId
    );

    if (!finalResumeText) {
      return NextResponse.json(
        { error: "No resume found. Please upload your resume first." },
        { status: 400 }
      );
    }

    // 5. Validate job description/URL
    const effectiveJobDescription = jobDescription || undefined;
    const effectiveJobUrl = jobUrl || undefined;
    
    if (!effectiveJobDescription && !effectiveJobUrl) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.AI_COACH.INTERVIEW_PREP.MISSING_JOB_DESCRIPTION },
        { status: 400 }
      );
    }

    // 6. Check for existing content
    const aiCoachService = new AICoachService();
    const existing = await aiCoachService.findExistingInterviewPrep({
      user_id: user.id,
      user_resume_id: finalUserResumeId,
      resume_text: finalResumeText,
      job_description: effectiveJobDescription,
      job_url: effectiveJobUrl,
      interview_context: interviewContext,
    });

    if (existing) {
      // Transform existing content using service
      const transformResult = await transformer.transform({
        content: existing.prep_content as DatabasePrepContent,
        structured,
        jobDescription: effectiveJobDescription || effectiveJobUrl || '',
        isExistingContent: true
      });

      return NextResponse.json({ 
        preparation: transformResult.content,
        cached: transformResult.fromCache 
      });
    }

    // 7. Generate new content
    const aiCoach = createAICoach(user.id);
    const prepJobDesc = effectiveJobDescription || effectiveJobUrl;
    const preparation = await aiCoach.prepareForInterview({
      jobDescription: prepJobDesc!,
      interviewContext,
      resumeText: finalResumeText,
    });

    // 8. Save to database
    await aiCoachService.createInterviewPrep({
      user_id: user.id,
      user_resume_id: finalUserResumeId,
      resume_text: finalResumeText,
      job_description: effectiveJobDescription,
      job_url: effectiveJobUrl,
      interview_context: interviewContext,
      prep_content: preparation,
    });

    // 9. Transform new content using service
    const transformResult = await transformer.transform({
      content: preparation,
      structured,
      jobDescription: effectiveJobDescription || effectiveJobUrl || '',
      isExistingContent: false
    });

    return NextResponse.json({ 
      preparation: transformResult.content,
      cached: transformResult.fromCache,
      transformationTime: transformResult.transformationTime 
    });

  } catch (error) {
    console.error("Error in interview preparation:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.INTERVIEW_PREP.GENERATION_FAILED },
      { status: 500 }
    );
  }
}

/**
 * Resolve resume data from request or database
 */
async function resolveResumeData(
  userId: string,
  resumeText?: string,
  userResumeId?: string
): Promise<{ finalResumeText: string | null; finalUserResumeId: string | null }> {
  let finalResumeText = resumeText || null;
  let finalUserResumeId = userResumeId || null;

  if (!finalResumeText) {
    const resumeDAL = new ResumeDAL();
    const currentResume = await resumeDAL.findCurrentByUserId(userId);
    if (currentResume) {
      finalResumeText = currentResume.extracted_text;
      finalUserResumeId = currentResume.id;
    }
  }

  return { finalResumeText, finalUserResumeId };
}

