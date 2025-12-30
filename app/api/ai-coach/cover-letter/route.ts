import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { withRateLimit } from "@/lib/middleware/rate-limit.middleware";
import { AIDataFetcherService } from "@/lib/services/ai-data-fetcher.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { AIFeatureUsageService } from "@/lib/services/ai-feature-usage.service";
import { ResumeResolutionService } from "@/lib/services/resume-resolution.service";

async function coverLetterHandler(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn('Unauthorized cover letter request', {
        category: LogCategory.SECURITY,
        action: 'cover_letter_unauthorized'
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Check permission with free tier support
    const permissionResult = await PermissionMiddleware.checkApiPermissionWithFreeTier(
      user.id,
      "COVER_LETTER",
      "cover_letter"
    );

    if (!permissionResult.allowed) {
      loggerService.logSecurityEvent(
        'ai_feature_access_denied',
        'medium',
        {
          feature: 'cover_letter',
          reason: permissionResult.reason || 'subscription_required',
          userId: user.id,
          freeTierExhausted: permissionResult.reason === 'free_tier_exhausted'
        },
        { userId: user.id }
      );
      return NextResponse.json(
        {
          error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED,
          reason: permissionResult.reason,
          requiresUpgrade: true
        },
        { status: 403 }
      );
    }

    const {
      jobDescription,
      userBackground,
      companyName,
      roleName,
      applicationId,
      resumeId,
      tone,
      additionalInfo
    } = await request.json();

    // Fetch saved data if applicationId provided
    let finalJobDescription = jobDescription;
    let finalUserBackground = userBackground;
    let finalCompanyName = companyName;
    let finalRoleName = roleName;
    let userResumeId: string | null = null;

    if (applicationId) {
      const context = await AIDataFetcherService.getAIContext(user.id, applicationId);

      // Use saved job description if not provided
      if (!finalJobDescription && context.jobDescription) {
        finalJobDescription = context.jobDescription;
      }

      // Use application data if not provided
      if (context.applicationData) {
        if (!finalCompanyName) {
          finalCompanyName = context.applicationData.company;
        }
        if (!finalRoleName) {
          finalRoleName = context.applicationData.role;
        }
      }
    }

    // Resolve resume using centralized service
    if (!finalUserBackground) {
      try {
        const resumeResult = await ResumeResolutionService.resolveResume(user.id, {
          resumeText: userBackground,
          resumeId,
          applicationId
        });

        finalUserBackground = resumeResult.text;
        userResumeId = resumeResult.id;
      } catch (error) {
        loggerService.warn('Cover letter missing resume', {
          category: LogCategory.API,
          userId: user.id,
          action: 'cover_letter_missing_resume',
          duration: Date.now() - startTime,
          metadata: {
            applicationId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
        return NextResponse.json(
          { error: "No resume found. Please upload your resume first." },
          { status: 400 }
        );
      }
    }

    if (!finalJobDescription || !finalUserBackground || !finalCompanyName) {
      loggerService.warn('Cover letter request missing required info', {
        category: LogCategory.API,
        userId: user.id,
        action: 'cover_letter_missing_info',
        duration: Date.now() - startTime,
        metadata: {
          hasJobDescription: !!finalJobDescription,
          hasUserBackground: !!finalUserBackground,
          hasCompanyName: !!finalCompanyName,
          applicationId
        }
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.AI_COACH.COVER_LETTER.MISSING_INFO },
        { status: 400 }
      );
    }

    loggerService.debug('Generating cover letter', {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: 'cover_letter_generation_start',
      metadata: {
        companyName: finalCompanyName,
        roleName: finalRoleName,
        hasApplicationId: !!applicationId,
        jobDescriptionLength: finalJobDescription.length,
        resumeLength: finalUserBackground.length
      }
    });

    const aiGenerationStartTime = Date.now();
    const aiCoach = createAICoach(user.id);
    const coverLetter = await aiCoach.generateCoverLetter(
      finalJobDescription,
      finalUserBackground,
      finalCompanyName
    );
    const aiGenerationDuration = Date.now() - aiGenerationStartTime;

    loggerService.info('Cover letter generated successfully', {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: 'cover_letter_ai_response',
      duration: aiGenerationDuration,
      metadata: {
        companyName: finalCompanyName,
        jobDescriptionLength: finalJobDescription.length,
        userBackgroundLength: finalUserBackground.length,
        coverLetterLength: coverLetter.length,
        model: 'gpt-4o-mini',
        estimatedTokens: Math.round((finalJobDescription.length + finalUserBackground.length + coverLetter.length) / 4),
        hasApplicationId: !!applicationId
      }
    });

    // Store the cover letter in database with additional metadata
    try {
      const supabase = await createClient();
      const { data: savedCoverLetter, error } = await supabase
        .from("cover_letters")
        .insert({
          user_id: user.id,
          application_id: applicationId || null,
          user_resume_id: userResumeId,
          company_name: finalCompanyName,
          role_name: finalRoleName || null,
          job_description: finalJobDescription,
          cover_letter: coverLetter,
          tone: tone || 'professional',
          additional_info: additionalInfo || null,
        })
        .select()
        .single();

      if (error) {
        loggerService.error('Error saving cover letter to database', error, {
          category: LogCategory.DATABASE,
          userId: user.id,
          action: 'cover_letter_save_error',
          metadata: {
            applicationId,
            companyName: finalCompanyName
          }
        });
        // Don't fail the request if saving fails, still return the generated letter
      }
      
      // Save job description for future use if we have an applicationId
      if (applicationId && finalJobDescription) {
        await AIDataFetcherService.saveJobDescription(user.id, applicationId, finalJobDescription);
      }
    } catch (saveError) {
      loggerService.error('Failed to save cover letter', saveError, {
        category: LogCategory.API,
        userId: user.id,
        action: 'cover_letter_save_exception',
        metadata: {
          applicationId,
          companyName: finalCompanyName
        }
      });
      // Continue anyway - the letter was generated successfully
    }

    // Track free tier usage if applicable
    if (permissionResult.usedFreeTier) {
      await AIFeatureUsageService.trackUsage(user.id, "cover_letter", {
        applicationId: applicationId || null,
        companyName: finalCompanyName,
        roleName: finalRoleName || null,
      });

      loggerService.info('Free tier usage tracked for cover letter', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'free_tier_usage_tracked',
        metadata: {
          feature: 'cover_letter',
          remainingTries: (permissionResult.remainingFreeTries || 1) - 1
        }
      });
    }

    loggerService.info('Cover letter generated successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'cover_letter_generated',
      duration: Date.now() - startTime,
      metadata: {
        companyName: finalCompanyName,
        roleName: finalRoleName,
        applicationId,
        coverLetterLength: coverLetter.length,
        tone: tone || 'professional',
        usedFreeTier: permissionResult.usedFreeTier || false
      }
    });

    return NextResponse.json({
      coverLetter,
      usedFreeTier: permissionResult.usedFreeTier,
      remainingFreeTries: permissionResult.usedFreeTier
        ? (permissionResult.remainingFreeTries || 1) - 1
        : undefined
    });
  } catch (error) {
    loggerService.error('Error generating cover letter', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'cover_letter_error',
      duration: Date.now() - startTime,
      metadata: {
        companyName,
        applicationId
      }
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.COVER_LETTER.GENERATION_FAILED },
      { status: 500 }
    );
  }
}

// Export with rate limiting middleware
export const POST = async (request: NextRequest) => {
  return withRateLimit(coverLetterHandler, {
    feature: 'cover_letter',
    request,
  });
};
