import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { ResumeDAL } from "@/dal/resumes";
import { withRateLimit } from "@/lib/middleware/rate-limit.middleware";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

async function analyzeResumeHandler(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn('Unauthorized resume analysis attempt', {
        category: LogCategory.SECURITY,
        action: 'resume_analysis_unauthorized'
      });
      
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
      loggerService.info('Resume analysis cache hit', {
        category: LogCategory.AI_SERVICE,
        userId: user.id,
        action: 'resume_analysis_cache_hit',
        duration: Date.now() - startTime,
        metadata: {
          userResumeId: finalUserResumeId,
          hasJobDescription: !!jobDescription
        }
      });
      
      return NextResponse.json({ analysis: existing.analysis_result });
    }

    const aiCallStartTime = Date.now();
    const aiCoach = createAICoach(user.id);
    const analysis = await aiCoach.analyzeResume(
      finalResumeText,
      jobDescription
    );
    
    const aiCallDuration = Date.now() - aiCallStartTime;
    loggerService.logAiServiceCall(
      'ai_coach',
      'analyze_resume',
      aiCallDuration,
      undefined, // tokens would be calculated by the AI service if available
      undefined,
      {
        userId: user.id,
        metadata: {
          hasJobDescription: !!jobDescription,
          resumeLength: finalResumeText?.length || 0
        }
      }
    );

    // Create resume analysis record using service
    await aiCoachService.createResumeAnalysis(user.id, {
      user_resume_id: finalUserResumeId,
      resume_text: finalResumeText,
      job_description: jobDescription,
      job_url: jobUrl,
      analysis_result: analysis,
    });

    loggerService.info('Resume analysis completed successfully', {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: 'resume_analysis_success',
      duration: Date.now() - startTime,
      metadata: {
        userResumeId: finalUserResumeId,
        hasJobDescription: !!jobDescription,
        aiCallDuration
      }
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    loggerService.error('Error in resume analysis', error, {
      category: LogCategory.AI_SERVICE,
      userId: user?.id,
      action: 'resume_analysis_error',
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.RESUME_ANALYZER.ANALYSIS_FAILED },
      { status: 500 }
    );
  }
}

// Export with rate limiting middleware
export const POST = async (request: NextRequest) => {
  return withRateLimit(analyzeResumeHandler, {
    feature: "resume_analysis",
    request,
  });
};
