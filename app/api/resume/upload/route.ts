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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      loggerService.warn('Resume upload missing file', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_no_file',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      loggerService.warn('Resume upload file too large', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_file_too_large',
        duration: Date.now() - startTime,
        metadata: {
          fileSize: file.size,
          maxSize: MAX_FILE_SIZE,
          fileName: file.name
        }
      });
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
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
        {
          error:
            "Please upload a PDF, Word document (.doc/.docx), or text file",
        },
        { status: 400 }
      );
    }

    // Extract text from file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const extractionResult = await extractTextFromBuffer(
      buffer,
      file.type,
      file.name
    );

    if (!extractionResult.success) {
      loggerService.error('Resume text extraction failed', new Error(extractionResult.error || 'Unknown extraction error'), {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_extraction_failed',
        duration: Date.now() - startTime,
        metadata: {
          fileName: file.name,
          fileType: file.type
        }
      });
      return NextResponse.json(
        { error: extractionResult.error || "Failed to extract text from file" },
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
        { error: "Could not extract text from the file" },
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

    if (uploadError) {
      loggerService.error('Resume storage upload error', uploadError, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'resume_upload_storage_error',
        duration: Date.now() - startTime,
        metadata: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          errorDetails: {
            message: uploadError.message,
            name: uploadError.name
          }
        }
      });
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("resumes")
      .getPublicUrl(fileName);

    // Save to database
    const resumeService = new ResumeService();
    const resume = await resumeService.upsertByUserId(user.id, {
      user_id: user.id,
      file_url: urlData.publicUrl,
      file_type: file.type,
      extracted_text: extractionResult.text,
    });

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
        file_url: resume.file_url,
        file_type: resume.file_type,
        extracted_text: resume.extracted_text,
        uploaded_at: resume.uploaded_at,
      },
    });
  } catch (error) {
    loggerService.error('Resume upload error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'resume_upload_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
