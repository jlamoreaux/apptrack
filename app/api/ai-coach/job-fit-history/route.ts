import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn('Unauthorized job fit history access', {
        category: LogCategory.SECURITY,
        action: 'job_fit_history_unauthorized'
      });
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
      loggerService.logSecurityEvent(
        'ai_feature_access_denied',
        'medium',
        {
          feature: 'job_fit_history',
          reason: permissionResult.reason || 'subscription_required',
          userId: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        {
          error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED,
        },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const applicationId = searchParams.get("applicationId");

    const aiCoachService = new AICoachService();
    
    // Get job fit analyses for the user, optionally filtered by application
    let analyses = await aiCoachService.getJobFitAnalyses(user.id, applicationId);
    
    // Limit results
    analyses = analyses.slice(0, limit);
    
    // Parse analysis results and add metadata with error handling
    const enrichedAnalyses = analyses.map(analysis => {
      try {
        return {
          id: analysis.id,
          created_at: analysis.created_at,
          fit_score: analysis.fit_score,
          analysis_result: typeof analysis.analysis_result === 'string' 
            ? JSON.parse(analysis.analysis_result) 
            : analysis.analysis_result,
          job_description_preview: analysis.job_description?.substring(0, 200) + "..." || "No description available",
        };
      } catch (parseError) {
        loggerService.warn('Failed to parse job fit analysis result', {
          category: LogCategory.API,
          userId: user.id,
          action: 'job_fit_history_parse_error',
          metadata: {
            analysisId: analysis.id,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          }
        });
        // Return analysis with error placeholder
        return {
          id: analysis.id,
          created_at: analysis.created_at,
          fit_score: analysis.fit_score,
          analysis_result: { error: "Failed to parse analysis data" },
          job_description_preview: analysis.job_description?.substring(0, 200) + "..." || "No description available",
        };
      }
    });

    loggerService.info('Job fit history retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'job_fit_history_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        count: analyses.length,
        limit,
        applicationId
      }
    });

    return NextResponse.json({ 
      analyses: enrichedAnalyses,
      total: analyses.length 
    });
  } catch (error) {
    loggerService.error('Error fetching job fit analyses', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'job_fit_history_get_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { 
        error: ERROR_MESSAGES.JOB_FIT_ANALYSIS_FAILED || "Failed to fetch job fit analyses",
        code: "FETCH_ERROR"
      },
      { status: 500 }
    );
  }
}