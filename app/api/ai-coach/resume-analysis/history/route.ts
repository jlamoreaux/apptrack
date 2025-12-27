import { NextRequest, NextResponse } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized resume analysis history access', {
        category: LogCategory.SECURITY,
        action: 'resume_analysis_history_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: analyses, error } = await supabase
      .from("resume_analysis")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      loggerService.error('Error fetching resume analyses', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'resume_analyses_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch resume analyses" }, { status: 500 });
    }

    loggerService.info('Resume analyses retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_analyses_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        count: analyses?.length || 0
      }
    });

    return NextResponse.json({ analyses: analyses || [] });

  } catch (error) {
    loggerService.error('Resume analysis history GET error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'resume_analysis_history_get_error',
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
      loggerService.warn('Unauthorized resume analysis history creation', {
        category: LogCategory.SECURITY,
        action: 'resume_analysis_history_create_unauthorized'
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { resumeUrl, analysisResult } = await request.json();

    if (!resumeUrl || !analysisResult) {
      loggerService.warn('Resume analysis creation missing fields', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_analysis_missing_fields',
        duration: Date.now() - startTime,
        metadata: {
          hasResumeUrl: !!resumeUrl,
          hasAnalysisResult: !!analysisResult
        }
      });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: analysis, error } = await supabase
      .from("resume_analysis")
      .insert({
        user_id: user.id,
        resume_url: resumeUrl,
        analysis_result: analysisResult,
      })
      .select()
      .single();

    if (error) {
      loggerService.error('Error creating resume analysis', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'resume_analysis_create_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to create resume analysis" }, { status: 500 });
    }

    loggerService.info('Resume analysis created', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_analysis_created',
      duration: Date.now() - startTime,
      metadata: {
        resumeUrl,
        analysisId: analysis?.id
      }
    });

    return NextResponse.json({ analysis });

  } catch (error) {
    loggerService.error('Resume analysis history POST error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'resume_analysis_history_post_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}