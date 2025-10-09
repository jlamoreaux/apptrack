import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ResumeService } from "@/services/resumes";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn('Unauthorized resume access', {
        category: LogCategory.SECURITY,
        action: 'resume_get_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const resumeService = new ResumeService();
    const resume = await resumeService.findCurrentByUserId(user.id);

    if (!resume) {
      loggerService.info('No resume found for user', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'resume_get_not_found',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "No resume found" }, { status: 404 });
    }

    loggerService.info('Resume retrieved successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_get_success',
      duration: Date.now() - startTime,
      metadata: {
        resumeId: resume.id,
        fileType: resume.file_type,
        hasExtractedText: !!resume.extracted_text
      }
    });
    
    return NextResponse.json({
      success: true,
      resume: {
        id: resume.id,
        file_url: resume.file_url,
        file_type: resume.file_type,
        extracted_text: resume.extracted_text,
        uploaded_at: resume.uploaded_at,
        updated_at: resume.updated_at,
      },
    });
  } catch (error) {
    loggerService.error('Resume get error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'resume_get_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn('Unauthorized resume deletion', {
        category: LogCategory.SECURITY,
        action: 'resume_delete_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const resumeService = new ResumeService();
    const resume = await resumeService.findCurrentByUserId(user.id);

    if (!resume) {
      loggerService.info('No resume found for deletion', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'resume_delete_not_found',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "No resume found" }, { status: 404 });
    }

    // Delete from storage
    const fileName = resume.file_url.split("/").pop();
    if (fileName) {
      const { error: storageError } = await supabase.storage
        .from("resumes")
        .remove([`resumes/${user.id}/${fileName}`]);

      if (storageError) {
        loggerService.error('Storage delete error', storageError, {
          category: LogCategory.DATABASE,
          userId: user.id,
          action: 'resume_delete_storage_error',
          metadata: {
            fileName,
            resumeId: resume.id
          }
        });
      }
    }

    // Delete from database
    await resumeService.delete(resume.id);

    loggerService.info('Resume deleted successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_delete_success',
      duration: Date.now() - startTime,
      metadata: {
        resumeId: resume.id,
        fileName
      }
    });
    
    return NextResponse.json({
      success: true,
      message: "Resume deleted successfully",
    });
  } catch (error) {
    loggerService.error('Resume delete error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'resume_delete_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}