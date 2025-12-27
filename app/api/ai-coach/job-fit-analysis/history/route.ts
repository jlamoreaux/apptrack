import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized job fit analysis history access', {
        category: LogCategory.SECURITY,
        action: 'job_fit_analysis_history_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: analyses, error } = await supabase
      .from("job_fit_analysis")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      loggerService.error('Error fetching job fit analyses', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'job_fit_analyses_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch job fit analyses" }, { status: 500 });
    }

    loggerService.info('Job fit analyses retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'job_fit_analyses_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        count: analyses?.length || 0
      }
    });

    return NextResponse.json({ analyses: analyses || [] });

  } catch (error) {
    loggerService.error('Job fit analysis history GET error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'job_fit_analysis_history_get_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized job fit analysis history creation', {
        category: LogCategory.SECURITY,
        action: 'job_fit_analysis_history_create_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobDescription, analysisResult, fitScore } = await request.json();

    if (!jobDescription || !analysisResult || typeof fitScore !== 'number') {
      loggerService.warn('Job fit analysis creation missing fields', {
        category: LogCategory.API,
        userId: user.id,
        action: 'job_fit_analysis_missing_fields',
        duration: Date.now() - startTime,
        metadata: {
          hasJobDescription: !!jobDescription,
          hasAnalysisResult: !!analysisResult,
          hasFitScore: typeof fitScore === 'number'
        }
      });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: analysis, error } = await supabase
      .from("job_fit_analysis")
      .insert({
        user_id: user.id,
        job_description: jobDescription,
        analysis_result: analysisResult,
        fit_score: fitScore,
      })
      .select()
      .single();

    if (error) {
      loggerService.error('Error creating job fit analysis', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'job_fit_analysis_create_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to create job fit analysis" }, { status: 500 });
    }

    loggerService.info('Job fit analysis created', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'job_fit_analysis_created',
      duration: Date.now() - startTime,
      metadata: {
        fitScore,
        jobDescriptionLength: jobDescription.length,
        analysisId: analysis?.id
      }
    });

    return NextResponse.json({ analysis });

  } catch (error) {
    loggerService.error('Job fit analysis history POST error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'job_fit_analysis_history_post_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}