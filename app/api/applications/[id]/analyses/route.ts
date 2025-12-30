import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

/**
 * GET /api/applications/[id]/analyses
 * Get all AI analyses for a specific application
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify application belongs to user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (appError || !application) {
      loggerService.warn('Application not found for analyses fetch', {
        category: LogCategory.API,
        userId: user.id,
        action: 'application_analyses_not_found',
        duration: Date.now() - startTime,
        metadata: { applicationId: id }
      });
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Fetch all analyses for this application
    const [jobFitResults, coverLetterResults, interviewPrepResults] =
      await Promise.all([
        // Job fit analyses
        supabase
          .from("job_fit_analysis")
          .select(
            `
            id,
            fit_score,
            analysis_result,
            created_at,
            user_resume_id,
            user_resumes (
              id,
              name
            )
          `
          )
          .eq("application_id", id)
          .order("created_at", { ascending: false }),

        // Cover letters
        supabase
          .from("cover_letters")
          .select(
            `
            id,
            company_name,
            role_name,
            cover_letter,
            created_at,
            user_resume_id,
            user_resumes (
              id,
              name
            )
          `
          )
          .eq("application_id", id)
          .order("created_at", { ascending: false }),

        // Interview prep (match by user + job context, since it doesn't have direct application link)
        supabase
          .from("interview_prep")
          .select(
            `
            id,
            interview_context,
            prep_content,
            created_at,
            user_resume_id,
            user_resumes (
              id,
              name
            )
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10), // Get recent ones
      ]);

    loggerService.info('Application analyses fetched successfully', {
      category: LogCategory.API,
      userId: user.id,
      action: 'application_analyses_success',
      duration: Date.now() - startTime,
      metadata: {
        applicationId: id,
        jobFitCount: jobFitResults.data?.length || 0,
        coverLetterCount: coverLetterResults.data?.length || 0,
        interviewPrepCount: interviewPrepResults.data?.length || 0
      }
    });

    return NextResponse.json({
      jobFitAnalyses: jobFitResults.data || [],
      coverLetters: coverLetterResults.data || [],
      interviewPreps: interviewPrepResults.data || [],
      counts: {
        jobFit: jobFitResults.data?.length || 0,
        coverLetter: coverLetterResults.data?.length || 0,
        interviewPrep: interviewPrepResults.data?.length || 0,
      },
    });
  } catch (error) {
    loggerService.error('Failed to fetch application analyses', error, {
      category: LogCategory.API,
      action: 'application_analyses_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to fetch analyses" },
      { status: 500 }
    );
  }
}
