import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export async function GET(request: NextRequest) {
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
      "JOB_FIT_ANALYSIS"
    );

    if (!permissionResult.allowed) {
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
        console.error("Failed to parse analysis result:", parseError instanceof Error ? parseError.message : String(parseError));
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

    return NextResponse.json({ 
      analyses: enrichedAnalyses,
      total: analyses.length 
    });
  } catch (error) {
    console.error("Error fetching job fit analyses:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        error: ERROR_MESSAGES.JOB_FIT_ANALYSIS_FAILED || "Failed to fetch job fit analyses",
        code: "FETCH_ERROR"
      },
      { status: 500 }
    );
  }
}