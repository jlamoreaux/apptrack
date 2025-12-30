import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ResumeService } from "@/services/resumes";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { RESUME_ERROR_MESSAGES } from "@/lib/constants/resume";

/**
 * GET /api/resume/check-limit
 * Check if user can add more resumes based on their plan
 * Returns: { allowed, current, limit, plan }
 */
export async function GET() {
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn('Unauthorized resume limit check attempt', {
        category: LogCategory.SECURITY,
        action: 'resume_check_limit_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const resumeService = new ResumeService();
    const limitInfo = await resumeService.canAddResume(user.id);

    loggerService.info('Resume limit checked', {
      category: LogCategory.API,
      userId: user.id,
      action: 'resume_check_limit_success',
      duration: Date.now() - startTime,
      metadata: {
        current: limitInfo.current,
        limit: limitInfo.limit,
        plan: limitInfo.plan,
        allowed: limitInfo.allowed
      }
    });

    return NextResponse.json(limitInfo);
  } catch (error) {
    loggerService.error('Failed to check resume limit', error, {
      category: LogCategory.API,
      action: 'resume_check_limit_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to check resume limit" },
      { status: 500 }
    );
  }
}
