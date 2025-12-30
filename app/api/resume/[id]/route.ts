import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ResumeService } from "@/services/resumes";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { RESUME_ERROR_MESSAGES } from "@/lib/constants/resume";
import { UpdateResumeSchema } from "@/lib/validation/resume.schema";

/**
 * PATCH /api/resume/[id]
 * Update resume metadata (name, description, display_order)
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
      loggerService.warn('Unauthorized resume update attempt', {
        category: LogCategory.SECURITY,
        action: 'resume_update_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validation = UpdateResumeSchema.safeParse(body);
    if (!validation.success) {
      loggerService.warn('Invalid resume update input', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_update_invalid_input',
        duration: Date.now() - startTime,
        metadata: {
          errors: validation.error.errors
        }
      });
      return NextResponse.json(
        {
          error: RESUME_ERROR_MESSAGES.INVALID_INPUT,
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const resumeService = new ResumeService();

    // Verify resume belongs to user
    const resume = await resumeService.findById(id);
    if (!resume) {
      loggerService.warn('Resume not found for update', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_update_not_found',
        duration: Date.now() - startTime,
        metadata: { resumeId: id }
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.RESUME_NOT_FOUND },
        { status: 404 }
      );
    }

    if (resume.user_id !== user.id) {
      loggerService.warn('Unauthorized resume update attempt (wrong owner)', {
        category: LogCategory.SECURITY,
        userId: user.id,
        action: 'resume_update_wrong_owner',
        duration: Date.now() - startTime,
        metadata: {
          resumeId: id,
          resumeOwnerId: resume.user_id
        }
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 403 }
      );
    }

    // Update resume
    const updated = await resumeService.update(id, validation.data);

    loggerService.info('Resume updated successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_update_success',
      duration: Date.now() - startTime,
      metadata: {
        resumeId: id,
        updates: Object.keys(validation.data)
      }
    });

    return NextResponse.json({ resume: updated });
  } catch (error) {
    loggerService.error('Failed to update resume', error, {
      category: LogCategory.API,
      action: 'resume_update_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to update resume" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/resume/[id]
 * Delete a resume (DB trigger will handle default reassignment)
 */
export async function DELETE(
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
      loggerService.warn('Unauthorized resume delete attempt', {
        category: LogCategory.SECURITY,
        action: 'resume_delete_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const { id } = await params;
    const resumeService = new ResumeService();

    // Verify resume belongs to user
    const resume = await resumeService.findById(id);
    if (!resume) {
      loggerService.warn('Resume not found for deletion', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_delete_not_found',
        duration: Date.now() - startTime,
        metadata: { resumeId: id }
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.RESUME_NOT_FOUND },
        { status: 404 }
      );
    }

    if (resume.user_id !== user.id) {
      loggerService.warn('Unauthorized resume delete attempt (wrong owner)', {
        category: LogCategory.SECURITY,
        userId: user.id,
        action: 'resume_delete_wrong_owner',
        duration: Date.now() - startTime,
        metadata: {
          resumeId: id,
          resumeOwnerId: resume.user_id
        }
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 403 }
      );
    }

    // Check if this is the only resume and it's default
    const resumeCount = await resumeService.count(user.id);
    if (resumeCount === 1 && resume.is_default) {
      loggerService.warn('Attempted to delete only default resume', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'resume_delete_only_default',
        duration: Date.now() - startTime,
        metadata: { resumeId: id }
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.CANNOT_DELETE_ONLY_DEFAULT },
        { status: 400 }
      );
    }

    // Delete resume from database first (DB trigger handles default reassignment)
    // This validates constraints before cleanup
    await resumeService.delete(id);

    // Cleanup file from storage (don't fail if storage cleanup fails)
    const fileName = resume.file_url.split("/").pop();
    if (fileName && /^[\w\-\.]+$/.test(fileName) && !fileName.includes('..')) {
      const filePath = `resumes/${user.id}/${fileName}`;

      // Verify path is within user's directory
      if (!filePath.includes('..') && filePath.startsWith(`resumes/${user.id}/`)) {
        const { error: storageError } = await supabase.storage
          .from("resumes")
          .remove([filePath]);

        if (storageError) {
          loggerService.warn('Storage cleanup failed after DB deletion', {
            category: LogCategory.API,
            userId: user.id,
            action: 'resume_storage_cleanup_error',
            duration: Date.now() - startTime,
            metadata: {
              resumeId: id,
              filePath,
              error: storageError.message
            }
          });
          // Don't fail the request - DB deletion succeeded
        }
      }
    }

    loggerService.info('Resume deleted successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_delete_success',
      duration: Date.now() - startTime,
      metadata: {
        resumeId: id,
        wasDefault: resume.is_default
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error('Failed to delete resume', error, {
      category: LogCategory.API,
      action: 'resume_delete_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to delete resume" },
      { status: 500 }
    );
  }
}
