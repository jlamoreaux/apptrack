import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      loggerService.warn('Unauthorized current resume access', {
        category: LogCategory.SECURITY,
        action: 'resume_current_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the most recent resume for the user
    const { data: resume, error } = await supabase
      .from("user_resumes")
      .select("*")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      loggerService.error('Error fetching current resume', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'resume_current_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch current resume" }, { status: 500 });
    }

    if (!resume) {
      loggerService.info('No current resume found', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'resume_current_not_found',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "No resume found" }, { status: 404 });
    }

    loggerService.info('Current resume retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_current_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        resumeId: resume.id,
        fileType: resume.file_type,
        hasExtractedText: !!resume.extracted_text
      }
    });

    return NextResponse.json({ resume });

  } catch (error) {
    loggerService.error('Current resume GET error', error, {
      category: LogCategory.API,
      action: 'resume_current_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}