import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ResumeService } from "@/services/resumes";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import {
  extractTextFromBuffer,
  isSupportedFileType,
} from "@/lib/utils/text-extraction-server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { RESUME_CONSTRAINTS, RESUME_ERROR_MESSAGES } from "@/lib/constants/resume";
import { validateResumeName, validateResumeDescription } from "@/lib/validation/resume.schema";
import { withRateLimit } from "@/lib/middleware/rate-limit.middleware";
import { validateFileType } from "@/lib/utils/file-type-validation";

async function handleUpload(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let uploadedFileName: string | null = null;

  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn('Unauthorized resume upload attempt', {
        category: LogCategory.SECURITY,
        action: 'resume_upload_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const nameInput = formData.get("name") as string | null;
    const descriptionInput = formData.get("description") as string | null;
    const setAsDefault = formData.get("setAsDefault") === "true";

    if (!file) {
      loggerService.warn('Resume upload missing file', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_no_file',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.NO_FILE_PROVIDED },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > RESUME_CONSTRAINTS.MAX_FILE_SIZE) {
      loggerService.warn('Resume upload file too large', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_file_too_large',
        duration: Date.now() - startTime,
        metadata: {
          fileSize: file.size,
          maxSize: RESUME_CONSTRAINTS.MAX_FILE_SIZE,
          fileName: file.name
        }
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.FILE_TOO_LARGE },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isSupportedFileType(file.type)) {
      loggerService.warn('Resume upload unsupported file type', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_unsupported_type',
        duration: Date.now() - startTime,
        metadata: {
          fileType: file.type,
          fileName: file.name
        }
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.UNSUPPORTED_FILE_TYPE },
        { status: 400 }
      );
    }

    // Check resume limit before processing file (advisory only - DB trigger is enforcement)
    const resumeService = new ResumeService();
    const limitCheck = await resumeService.canAddResume(user.id);

    if (!limitCheck.allowed) {
      loggerService.warn('Resume upload limit reached', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'resume_upload_limit_reached',
        duration: Date.now() - startTime,
        metadata: {
          current: limitCheck.current,
          limit: limitCheck.limit,
          plan: limitCheck.plan
        }
      });
      return NextResponse.json(
        {
          error: RESUME_ERROR_MESSAGES.LIMIT_REACHED(limitCheck.plan, limitCheck.limit),
          limit: limitCheck.limit,
          current: limitCheck.current,
          plan: limitCheck.plan
        },
        { status: 403 }
      );
    }

    // Extract text from file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate actual file type using magic bytes (prevents file type spoofing)
    const fileTypeValidation = await validateFileType(buffer, file.type);
    if (!fileTypeValidation.valid) {
      loggerService.warn('Resume upload failed magic byte validation', {
        category: LogCategory.SECURITY,
        userId: user.id,
        action: 'resume_upload_magic_byte_failed',
        duration: Date.now() - startTime,
        metadata: {
          claimedType: fileTypeValidation.claimedType,
          detectedType: fileTypeValidation.detectedType,
          fileName: file.name,
          error: fileTypeValidation.error
        }
      });
      return NextResponse.json(
        {
          error: fileTypeValidation.error || 'File type validation failed',
          details: {
            claimed: fileTypeValidation.claimedType,
            detected: fileTypeValidation.detectedType
          }
        },
        { status: 400 }
      );
    }

    const extractionResult = await extractTextFromBuffer(
      buffer,
      file.type,
      file.name
    );

    if (!extractionResult.success) {
      loggerService.error(
        'Resume text extraction failed',
        new Error(extractionResult.error || 'Unknown extraction error'),
        {
          category: LogCategory.API,
          userId: user.id,
          action: 'resume_upload_extraction_failed',
          duration: Date.now() - startTime,
          metadata: {
            fileName: file.name,
            fileType: file.type
          }
        }
      );
      return NextResponse.json(
        {
          error: extractionResult.error || RESUME_ERROR_MESSAGES.EXTRACTION_FAILED
        },
        { status: 400 }
      );
    }

    if (!extractionResult.text.trim()) {
      loggerService.warn('Resume upload empty text extraction', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_empty_text',
        duration: Date.now() - startTime,
        metadata: {
          fileName: file.name,
          fileType: file.type
        }
      });
      return NextResponse.json(
        { error: RESUME_ERROR_MESSAGES.EMPTY_EXTRACTION },
        { status: 400 }
      );
    }

    // Upload file to Supabase Storage
    const fileName = `resumes/${user.id}/${Date.now()}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError || !uploadData?.path) {
      loggerService.error('Resume storage upload error', uploadError || new Error('No path returned'), {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'resume_upload_storage_error',
        duration: Date.now() - startTime,
        metadata: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          errorDetails: uploadError ? {
            message: uploadError.message,
            name: uploadError.name
          } : { message: 'No path returned' }
        }
      });
      return NextResponse.json(
        { error: `${RESUME_ERROR_MESSAGES.UPLOAD_FAILED}: ${uploadError?.message || 'No path returned'}` },
        { status: 500 }
      );
    }

    uploadedFileName = fileName;

    // Verify the file exists and is accessible
    const { data: verifyData, error: verifyError } = await supabase.storage
      .from("resumes")
      .download(uploadData.path);

    if (verifyError || !verifyData) {
      // Cleanup failed upload
      await supabase.storage.from("resumes").remove([uploadData.path]);

      loggerService.error('Resume storage verification failed', verifyError || new Error('No data returned'), {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'resume_upload_verification_failed',
        duration: Date.now() - startTime,
        metadata: {
          fileName: file.name,
          uploadPath: uploadData.path,
          errorDetails: verifyError ? {
            message: verifyError.message,
            name: verifyError.name
          } : { message: 'No data returned' }
        }
      });

      return NextResponse.json(
        { error: `${RESUME_ERROR_MESSAGES.UPLOAD_FAILED}: Uploaded file verification failed` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("resumes")
      .getPublicUrl(fileName);

    // Validate and sanitize inputs
    let resumeName: string;
    try {
      resumeName = nameInput?.trim()
        ? validateResumeName(nameInput.trim())
        : file.name.replace(/\.[^/.]+$/, "");
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid name';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    let resumeDescription: string | null;
    try {
      resumeDescription = validateResumeDescription(descriptionInput);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid description';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Get resume count
    const resumeCount = await resumeService.count(user.id);
    const isFirstResume = resumeCount === 0;

    // Get next display order atomically to prevent race conditions
    let nextDisplayOrder: number;
    const { data: displayOrderData, error: displayOrderError } = await supabase
      .rpc('get_next_display_order', { p_user_id: user.id });

    if (displayOrderError || displayOrderData === null) {
      loggerService.error('Failed to get next display order, using fallback', displayOrderError, {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_display_order_error',
        duration: Date.now() - startTime
      });
      // Fallback to non-atomic method if RPC fails
      nextDisplayOrder = await resumeService.getMaxDisplayOrder(user.id) + 1;
    } else {
      nextDisplayOrder = displayOrderData;
    }

    // Save to database using create() for multi-resume support
    // DB trigger will enforce limit and prevent race conditions
    let resume;
    try {
      resume = await resumeService.create({
        user_id: user.id,
        name: resumeName,
        description: resumeDescription,
        file_url: urlData.publicUrl,
        file_type: file.type,
        extracted_text: extractionResult.text,
        is_default: setAsDefault || isFirstResume,
        display_order: nextDisplayOrder,
      });
    } catch (error) {
      // If DB trigger rejects due to limit, cleanup uploaded file
      if (error instanceof Error && error.message.includes('Resume limit reached')) {
        if (uploadedFileName) {
          await supabase.storage.from("resumes").remove([uploadedFileName]);
        }

        loggerService.warn('Resume creation blocked by database trigger', {
          category: LogCategory.BUSINESS,
          userId: user.id,
          action: 'resume_upload_trigger_blocked',
          duration: Date.now() - startTime,
          metadata: {
            current: limitCheck.current,
            limit: limitCheck.limit,
            plan: limitCheck.plan
          }
        });

        return NextResponse.json(
          {
            error: RESUME_ERROR_MESSAGES.LIMIT_REACHED(limitCheck.plan, limitCheck.limit),
            limit: limitCheck.limit,
            current: limitCheck.current,
            plan: limitCheck.plan
          },
          { status: 403 }
        );
      }

      // For other errors, cleanup and re-throw
      if (uploadedFileName) {
        await supabase.storage.from("resumes").remove([uploadedFileName]);
      }
      throw error;
    }

    loggerService.info('Resume uploaded successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_upload_success',
      duration: Date.now() - startTime,
      metadata: {
        resumeId: resume.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        extractedTextLength: extractionResult.text.length
      }
    });

    return NextResponse.json({
      success: true,
      resume: {
        id: resume.id,
        name: resume.name,
        description: resume.description,
        file_url: resume.file_url,
        file_type: resume.file_type,
        extracted_text: resume.extracted_text,
        is_default: resume.is_default,
        display_order: resume.display_order,
        uploaded_at: resume.uploaded_at,
      },
    });
  } catch (error) {
    // Cleanup orphaned file if upload succeeded but DB insert failed
    if (uploadedFileName) {
      const supabase = await createClient();
      await supabase.storage.from("resumes").remove([uploadedFileName]);
    }

    // Get user ID for logging (may be undefined if error occurred during auth)
    let userId: string | undefined;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    } catch {
      // User not available, continue without userId
    }

    loggerService.error('Resume upload error', error, {
      category: LogCategory.API,
      userId,
      action: 'resume_upload_error',
      duration: Date.now() - startTime
    });

    return NextResponse.json(
      { error: RESUME_ERROR_MESSAGES.UNEXPECTED_ERROR },
      { status: 500 }
    );
  }
}

/**
 * POST /api/resume/upload
 * Upload a new resume with rate limiting
 */
export async function POST(request: NextRequest) {
  return withRateLimit(handleUpload, {
    feature: 'resume_upload',
    request,
    skipTracking: false, // Track usage for analytics
  });
}
