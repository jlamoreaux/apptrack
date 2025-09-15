import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { ResumeDAL } from "@/dal/resumes";
import { InterviewPrepTransformerService } from "@/lib/services/interview-prep-transformer";
import type { InterviewPreparationResult } from "@/types/ai-analysis";
import { AIDataFetcherService } from "@/lib/services/ai-data-fetcher.service";

// API Request/Response interfaces
interface InterviewPrepRequest {
  jobDescription?: string;
  jobUrl?: string;
  interviewContext?: string;
  userResumeId?: string;
  resumeText?: string;
  structured?: boolean;
  applicationId?: string;
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
      applicationId,
    } = body;

    // 3a. Fetch data from application if provided
    let finalJobDescription = jobDescription;
    let finalInterviewContext = interviewContext;
    
    if (applicationId) {
      const context = await AIDataFetcherService.getAIContext(user.id, applicationId);
      
      // Use saved job description if not provided
      if (!finalJobDescription && context.jobDescription) {
        finalJobDescription = context.jobDescription;
      }
      
      // Use application data for context if not provided
      if (!finalInterviewContext && context.applicationData) {
        const { company, role } = context.applicationData;
        finalInterviewContext = `Interview for ${role} position at ${company}`;
      }
    }

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
    const effectiveJobDescription = finalJobDescription || undefined;
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
      interview_context: finalInterviewContext,
    });

    if (existing) {
      // Log existing content for debugging
      console.log('=== EXISTING CACHED CONTENT ===');
      console.log('Existing content type:', typeof existing.prep_content);
      console.log('Existing content length:', typeof existing.prep_content === 'string' ? existing.prep_content.length : 'N/A');
      console.log('Full existing content:', existing.prep_content);
      console.log('=== END EXISTING CONTENT ===');

      // Transform existing content using service (always request structured format)
      const transformResult = await transformer.transform({
        content: existing.prep_content as DatabasePrepContent,
        structured: true, // Always convert to structured format
        jobDescription: effectiveJobDescription || effectiveJobUrl || '',
        isExistingContent: true
      });

      // Ensure we got structured content, throw error if we got a string fallback
      if (typeof transformResult.content === 'string') {
        console.error('Failed to convert existing interview prep to structured format');
        return NextResponse.json(
          { 
            error: "Failed to process existing interview preparation. Please regenerate.",
            fallbackContent: transformResult.content
          },
          { status: 500 }
        );
      }

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
      interviewContext: finalInterviewContext,
      resumeText: finalResumeText,
    });

    // Log the raw AI response for debugging
    console.log('=== RAW AI RESPONSE ===');
    console.log('Response type:', typeof preparation);
    console.log('Response length:', typeof preparation === 'string' ? preparation.length : 'N/A');
    console.log('Full AI response:', preparation);
    console.log('=== END RAW AI RESPONSE ===');

    // 8. Save to database
    await aiCoachService.createInterviewPrep({
      user_id: user.id,
      user_resume_id: finalUserResumeId,
      resume_text: finalResumeText,
      job_description: effectiveJobDescription,
      job_url: effectiveJobUrl,
      interview_context: finalInterviewContext,
      prep_content: preparation,
    });

    // 8a. Save job description for future use if we have an applicationId
    if (applicationId && effectiveJobDescription) {
      await AIDataFetcherService.saveJobDescription(user.id, applicationId, effectiveJobDescription);
    }

    // 9. Transform new content using service (always request structured format)
    const transformResult = await transformer.transform({
      content: preparation,
      structured: true, // Always convert to structured format
      jobDescription: effectiveJobDescription || effectiveJobUrl || '',
      isExistingContent: false
    });

    // Ensure we got structured content, throw error if we got a string fallback
    if (typeof transformResult.content === 'string') {
      console.error('Failed to convert interview prep to structured format');
      return NextResponse.json(
        { 
          error: "Failed to generate structured interview preparation. Please try again.",
          fallbackContent: transformResult.content
        },
        { status: 500 }
      );
    }

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

