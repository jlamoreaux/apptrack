import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ResumeService } from "@/services/resumes";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { RESUME_ERROR_MESSAGES } from "@/lib/constants/resume";

/**
 * PATCH /api/resume/[id]/default
 * Set a resume as the default resume
 * Automatically unsets other defaults (handled by DB trigger)
 */
export async function PATCH(
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
      loggerService.warn('Unauthorized set default resume attempt', {
        category: LogCategory.SECURITY,
        action: 'resume_set_default_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { id } = await params;
    const resumeService = new ResumeService();

    // Set as default (includes authorization check)
    const updatedResume = await resumeService.setDefaultResume(id, user.id);

    if (!updatedResume) {
      loggerService.warn('Resume not found for set default', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_set_default_not_found',
        duration: Date.now() - startTime,
        metadata: { resumeId: id }
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.RESUME_NOT_FOUND },
        { status: 404 }
      );
    }

    loggerService.info('Default resume set successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_set_default_success',
      duration: Date.now() - startTime,
      metadata: { resumeId: id }
    });

    return NextResponse.json({
      resume: updatedResume,
      message: "Default resume updated successfully"
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      loggerService.warn('Unauthorized set default attempt (wrong owner)', {
        category: LogCategory.SECURITY,
        action: 'resume_set_default_wrong_owner',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "You don't have permission to modify this resume" },
        { status: 403 }
      );
    }

    loggerService.error('Failed to set default resume', error, {
      category: LogCategory.API,
      action: 'resume_set_default_error',
      duration: Date.now() - startTime
    });

    return NextResponse.json(
      { error: "Failed to set default resume" },
      { status: 500 }
    );
  }
}
