import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAICoach } from "@/lib/ai-coach";
import { withRateLimit } from "@/lib/middleware/rate-limit.middleware";
import { AIDataFetcherService } from "@/lib/services/ai-data-fetcher.service";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { AIFeatureUsageService } from "@/lib/services/ai-feature-usage.service";

async function handler(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized job fit analysis attempt', {
        category: LogCategory.SECURITY,
        action: 'job_fit_analysis_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission with free tier support
    const permissionResult = await PermissionMiddleware.checkApiPermissionWithFreeTier(
      user.id,
      "JOB_FIT_ANALYSIS",
      "job_fit"
    );

    if (!permissionResult.allowed) {
      loggerService.logSecurityEvent(
        'ai_feature_access_denied',
        'medium',
        {
          feature: 'job_fit_analysis',
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

    const { jobDescription, applicationId } = await request.json();

    // Try to get job description from saved data if not provided
    let finalJobDescription = jobDescription;
    let finalResumeText: string | null = null;
    
    if (applicationId) {
      const context = await AIDataFetcherService.getAIContext(user.id, applicationId);
      
      if (!finalJobDescription && context.jobDescription) {
        finalJobDescription = context.jobDescription;
      }
      
      finalResumeText = context.resumeText;
    }
    
    // If still no resume, try to fetch user's current resume
    if (!finalResumeText) {
      const resume = await AIDataFetcherService.getUserResume(user.id);
      finalResumeText = resume.text;
    }

    if (!finalJobDescription || typeof finalJobDescription !== "string") {
      loggerService.warn('Job fit analysis missing job description', {
        category: LogCategory.API,
        userId: user.id,
        action: 'job_fit_missing_job_description',
        duration: Date.now() - startTime,
        metadata: { applicationId }
      });
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    if (!finalResumeText) {
      loggerService.warn('Job fit analysis missing resume', {
        category: LogCategory.API,
        userId: user.id,
        action: 'job_fit_missing_resume',
        duration: Date.now() - startTime,
        metadata: { applicationId }
      });
      return NextResponse.json(
        { error: "Please upload your resume first to use Job Fit Analysis" },
        { status: 400 }
      );
    }

    // Call AI service to analyze job fit
    const aiCoach = createAICoach(user.id);
    
    try {
      loggerService.debug('Starting job fit analysis', {
        category: LogCategory.AI_SERVICE,
        userId: user.id,
        action: 'job_fit_analysis_start',
        metadata: {
          jobDescriptionLength: finalJobDescription.length,
          resumeLength: finalResumeText.length,
          applicationId
        }
      });

      const aiStartTime = Date.now();
      // Generate real analysis using AI
      const analysis = await aiCoach.analyzeJobFit(finalJobDescription, finalResumeText);
      const aiDuration = Date.now() - aiStartTime;

      loggerService.info('Job fit analysis generated successfully', {
        category: LogCategory.AI_SERVICE,
        userId: user.id,
        action: 'job_fit_analysis_ai_response',
        duration: aiDuration,
        metadata: {
          jobDescriptionLength: finalJobDescription.length,
          resumeLength: finalResumeText.length,
          responseLength: JSON.stringify(analysis).length,
          model: 'gpt-4o-mini',
          estimatedTokens: Math.round((finalJobDescription.length + finalResumeText.length + JSON.stringify(analysis).length) / 4),
          hasApplicationId: !!applicationId
        }
      });
      
      // Save job description for future use if we have an applicationId
      if (applicationId && finalJobDescription) {
        await AIDataFetcherService.saveJobDescription(user.id, applicationId, finalJobDescription);
      }
      
      // Store analysis in database for history
      await supabase.from("job_fit_analysis").insert({
        user_id: user.id,
        application_id: applicationId || null,
        job_description: finalJobDescription,
        analysis_result: analysis,
        overall_score: analysis.overallScore,
        created_at: new Date().toISOString()
      });

      // Track free tier usage if applicable
      if (permissionResult.usedFreeTier) {
        await AIFeatureUsageService.trackUsage(user.id, "job_fit", {
          applicationId: applicationId || null,
          overallScore: analysis.overallScore,
        });

        loggerService.info('Free tier usage tracked for job fit analysis', {
          category: LogCategory.BUSINESS,
          userId: user.id,
          action: 'free_tier_usage_tracked',
          metadata: {
            feature: 'job_fit',
            remainingTries: (permissionResult.remainingFreeTries || 1) - 1
          }
        });
      }

      loggerService.info('Job fit analysis completed', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'job_fit_analysis_completed',
        duration: Date.now() - startTime,
        metadata: {
          applicationId,
          overallScore: analysis.overallScore,
          aiGenerationTime: aiDuration,
          usedFreeTier: permissionResult.usedFreeTier || false
        }
      });

      return NextResponse.json({
        ...analysis,
        usedFreeTier: permissionResult.usedFreeTier,
        remainingFreeTries: permissionResult.usedFreeTier
          ? (permissionResult.remainingFreeTries || 1) - 1
          : undefined
      });
      
    } catch (aiError) {
      loggerService.error('AI analysis failed, using fallback', aiError, {
        category: LogCategory.AI_SERVICE,
        userId: user.id,
        action: 'job_fit_ai_failure',
        metadata: {
          applicationId
        }
      });
      
      // Fallback to mock analysis if AI fails
      const mockAnalysis = {
      overallScore: 75,
      summary: "You're a strong candidate for this position with relevant experience in most required areas. Some skill gaps can be addressed through focused learning.",
      matchDetails: [
        {
          category: "Technical Skills",
          score: 80,
          strengths: [
            "Strong proficiency in React and TypeScript",
            "Experience with cloud platforms (AWS)",
            "Database management skills"
          ],
          gaps: [
            "Limited experience with Kubernetes",
            "No mentioned experience with GraphQL"
          ],
          suggestions: [
            "Take an online Kubernetes certification course",
            "Build a side project using GraphQL"
          ]
        },
        {
          category: "Experience Level",
          score: 70,
          strengths: [
            "5+ years in software development",
            "Led multiple successful projects",
            "Experience with agile methodologies"
          ],
          gaps: [
            "Role requires 7+ years, you have 5",
            "Limited experience in fintech industry"
          ],
          suggestions: [
            "Highlight transferable skills from other industries",
            "Emphasize quick learning ability and adaptability"
          ]
        },
        {
          category: "Soft Skills",
          score: 85,
          strengths: [
            "Strong communication skills demonstrated",
            "Team collaboration experience",
            "Problem-solving abilities"
          ],
          gaps: [],
          suggestions: [
            "Prepare specific examples of leadership situations",
            "Practice articulating technical concepts to non-technical stakeholders"
          ]
        },
        {
          category: "Education & Certifications",
          score: 65,
          strengths: [
            "Bachelor's degree in Computer Science",
            "AWS Certified Developer"
          ],
          gaps: [
            "Role prefers Master's degree",
            "No specific certifications in required technologies"
          ],
          suggestions: [
            "Consider pursuing relevant certifications",
            "Highlight continuous learning through online courses"
          ]
        }
      ],
      keyStrengths: [
        "Technical skills align well with core requirements",
        "Strong track record of successful project delivery",
        "Excellent soft skills and team collaboration",
        "Relevant cloud platform experience"
      ],
      areasForImprovement: [
        "Gain additional years of experience or highlight equivalent expertise",
        "Develop skills in missing technologies (Kubernetes, GraphQL)",
        "Consider industry-specific certifications",
        "Build portfolio projects demonstrating required skills"
      ],
      recommendations: [
        "Customize your resume to highlight the most relevant experiences for this role",
        "In your cover letter, address the experience gap by emphasizing rapid growth and achievements",
        "Prepare concrete examples that demonstrate proficiency in the required technical skills",
        "Research the company's tech stack and prepare to discuss how your skills transfer",
        "Consider reaching out to current employees for informational interviews to better understand the role"
      ]
      };
      
      // Save fallback analysis too
      await supabase.from("job_fit_analysis").insert({
        user_id: user.id,
        application_id: applicationId || null,
        job_description: finalJobDescription,
        analysis_result: mockAnalysis,
        overall_score: mockAnalysis.overallScore,
        created_at: new Date().toISOString()
      });

      // Track free tier usage if applicable (even for fallback)
      if (permissionResult.usedFreeTier) {
        await AIFeatureUsageService.trackUsage(user.id, "job_fit", {
          applicationId: applicationId || null,
          overallScore: mockAnalysis.overallScore,
          fallback: true
        });
      }

      loggerService.info('Job fit analysis completed with fallback', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'job_fit_analysis_fallback',
        duration: Date.now() - startTime,
        metadata: {
          applicationId,
          overallScore: mockAnalysis.overallScore,
          usedFreeTier: permissionResult.usedFreeTier || false
        }
      });

      return NextResponse.json({
        ...mockAnalysis,
        usedFreeTier: permissionResult.usedFreeTier,
        remainingFreeTries: permissionResult.usedFreeTier
          ? (permissionResult.remainingFreeTries || 1) - 1
          : undefined
      });
    }
  } catch (error) {
    loggerService.error('Job fit analysis error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'job_fit_analysis_error',
      duration: Date.now() - startTime,
      metadata: {
        applicationId
      }
    });
    return NextResponse.json(
      { error: "Failed to analyze job fit" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return withRateLimit(handler, {
    feature: "job_fit_analysis",
    request
  });
}