import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

/**
 * GET /api/resume/[id]/analyses
 * Get all AI analyses that used this specific resume
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

    // Verify resume belongs to user
    const { data: resume, error: resumeError } = await supabase
      .from("user_resumes")
      .select("id, user_id, name")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (resumeError || !resume) {
      loggerService.warn('Resume not found for analyses fetch', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_analyses_not_found',
        duration: Date.now() - startTime,
        metadata: { resumeId: id }
      });
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    // Fetch all analyses that used this resume
    const [
      jobFitResults,
      coverLetterResults,
      interviewPrepResults,
      resumeAnalysisResults,
    ] = await Promise.all([
      // Job fit analyses
      supabase
        .from("job_fit_analysis")
        .select(
          `
            id,
            fit_score,
            analysis_result,
            created_at,
            application_id,
            applications (
              id,
              company,
              role
            )
          `
        )
        .eq("user_resume_id", id)
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
            application_id,
            applications (
              id,
              company,
              role
            )
          `
        )
        .eq("user_resume_id", id)
        .order("created_at", { ascending: false }),

      // Interview prep
      supabase
        .from("interview_prep")
        .select(
          `
            id,
            interview_context,
            prep_content,
            created_at
          `
        )
        .eq("user_resume_id", id)
        .order("created_at", { ascending: false }),

      // Resume analyses
      supabase
        .from("resume_analysis")
        .select(
          `
            id,
            analysis_text,
            created_at
          `
        )
        .eq("user_resume_id", id)
        .order("created_at", { ascending: false }),
    ]);

    loggerService.info('Resume analyses fetched successfully', {
      category: LogCategory.API,
      userId: user.id,
      action: 'resume_analyses_success',
      duration: Date.now() - startTime,
      metadata: {
        resumeId: id,
        jobFitCount: jobFitResults.data?.length || 0,
        coverLetterCount: coverLetterResults.data?.length || 0,
        interviewPrepCount: interviewPrepResults.data?.length || 0,
        resumeAnalysisCount: resumeAnalysisResults.data?.length || 0
      }
    });

    return NextResponse.json({
      resume: {
        id: resume.id,
        name: resume.name,
      },
      analyses: {
        jobFit: jobFitResults.data || [],
        coverLetters: coverLetterResults.data || [],
        interviewPreps: interviewPrepResults.data || [],
        resumeAnalyses: resumeAnalysisResults.data || [],
      },
      counts: {
        jobFit: jobFitResults.data?.length || 0,
        coverLetter: coverLetterResults.data?.length || 0,
        interviewPrep: interviewPrepResults.data?.length || 0,
        resumeAnalysis: resumeAnalysisResults.data?.length || 0,
        total:
          (jobFitResults.data?.length || 0) +
          (coverLetterResults.data?.length || 0) +
          (interviewPrepResults.data?.length || 0) +
          (resumeAnalysisResults.data?.length || 0),
      },
    });
  } catch (error) {
    loggerService.error('Failed to fetch resume analyses', error, {
      category: LogCategory.API,
      action: 'resume_analyses_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to fetch analyses" },
      { status: 500 }
    );
  }
}
