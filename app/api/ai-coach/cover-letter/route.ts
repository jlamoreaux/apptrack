import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { withRateLimit } from "@/lib/middleware/rate-limit.middleware";
import { AIDataFetcherService } from "@/lib/services/ai-data-fetcher.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

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

    // Check permission using middleware
    const permissionResult = await PermissionMiddleware.checkApiPermission(
      user.id,
      "COVER_LETTER"
    );

    if (!permissionResult.allowed) {
      loggerService.logSecurityEvent(
        'ai_feature_access_denied',
        'medium',
        {
          feature: 'cover_letter',
          reason: permissionResult.reason || 'subscription_required',
          userId: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        { error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED },
        { status: 403 }
      );
    }

    const { 
      jobDescription, 
      userBackground, 
      companyName,
      roleName,
      applicationId,
      tone,
      additionalInfo 
    } = await request.json();

    // Fetch saved data if applicationId provided
    let finalJobDescription = jobDescription;
    let finalUserBackground = userBackground;
    let finalCompanyName = companyName;
    let finalRoleName = roleName;

    if (applicationId) {
      const context = await AIDataFetcherService.getAIContext(user.id, applicationId);
      
      // Use saved job description if not provided
      if (!finalJobDescription && context.jobDescription) {
        finalJobDescription = context.jobDescription;
      }
      
      // Use saved resume if background not provided
      if (!finalUserBackground && context.resumeText) {
        finalUserBackground = context.resumeText;
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

    // If still no resume, try to fetch user's current resume
    if (!finalUserBackground) {
      const resume = await AIDataFetcherService.getUserResume(user.id);
      finalUserBackground = resume.text;
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

    loggerService.logAIServiceCall(
      'cover_letter',
      user.id,
      {
        prompt: `Generate cover letter for ${finalCompanyName}`,
        model: 'gpt-4', // Update based on actual model used
        promptTokens: (finalJobDescription.length + finalUserBackground.length) / 4, // Approximate
        completionTokens: coverLetter.length / 4, // Approximate
        totalTokens: (finalJobDescription.length + finalUserBackground.length + coverLetter.length) / 4,
        responseTime: aiGenerationDuration,
        statusCode: 200
      }
    );

    // Store the cover letter in database with additional metadata
    try {
      const supabase = await createClient();
      const { data: savedCoverLetter, error } = await supabase
        .from("cover_letters")
        .insert({
          user_id: user.id,
          application_id: applicationId || null,
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
        tone: tone || 'professional'
      }
    });

    return NextResponse.json({ coverLetter });
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
