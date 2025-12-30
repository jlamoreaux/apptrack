import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/supabase/queries";
import { ResumeService } from "@/services/resumes";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { RESUME_ERROR_MESSAGES } from "@/lib/constants/resume";

/**
 * GET /api/resume/list
 * Get all resumes for the authenticated user
 * Returns resumes sorted by display_order
 */
export async function GET() {
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn('Unauthorized resume list attempt', {
        category: LogCategory.SECURITY,
        action: 'resume_list_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const resumeService = new ResumeService();

    // Get all resumes (single query)
    const resumes = await resumeService.getAllResumes(user.id);

    // Get subscription info to determine limit (avoid redundant count query)
    const subscription = await getSubscription(user.id);
    const planName = subscription?.subscription_plans?.name || 'Free';
    const limit = ['AI Coach', 'Pro'].includes(planName) ? 100 : 1;
    const current = resumes.length; // Derive count from fetched resumes instead of separate query
    const allowed = current < limit;

    loggerService.info('Resumes listed successfully', {
      category: LogCategory.API,
      userId: user.id,
      action: 'resume_list_success',
      duration: Date.now() - startTime,
      metadata: {
        count: resumes.length,
        limit
      }
    });

    return NextResponse.json({
      resumes,
      meta: {
        total: resumes.length,
        limit,
        current,
        canAdd: allowed,
        plan: planName,
      },
    });
  } catch (error) {
    loggerService.error('Failed to fetch resumes', error, {
      category: LogCategory.API,
      action: 'resume_list_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to fetch resumes" },
      { status: 500 }
    );
  }
}
