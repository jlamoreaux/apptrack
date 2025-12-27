import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAICoachAccess } from "@/lib/middleware/ai-coach-auth";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and AI Coach access
    const authResult = await checkAICoachAccess('UPLOAD_RESUME');
    if (!authResult.authorized) {
      loggerService.logSecurityEvent(
        'ai_feature_access_denied',
        'medium',
        {
          feature: 'upload_resume',
          reason: 'unauthorized_access'
        },
        { userId: authResult.user?.id }
      );
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

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

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      loggerService.warn('Resume upload file too large', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_file_too_large',
        duration: Date.now() - startTime,
        metadata: {
          fileSize: file.size,
          limit: 5 * 1024 * 1024
        }
      });
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Check file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      loggerService.warn('Resume upload invalid file type', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_invalid_type',
        duration: Date.now() - startTime,
        metadata: {
          fileType: file.type,
          fileName: file.name
        }
      });
      return NextResponse.json(
        { error: "Please upload a PDF, Word document, or text file" },
        { status: 400 }
      );
    }

    let extractedText = "";

    if (file.type === "text/plain") {
      // Handle plain text files
      extractedText = await file.text();
    } else if (file.type === "application/pdf") {
      // For PDF files, we'll need to extract text
      // For now, return an error asking user to copy/paste
      loggerService.warn('PDF parsing not implemented', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_pdf_not_implemented',
        duration: Date.now() - startTime,
        metadata: {
          fileType: file.type,
          fileName: file.name
        }
      });
      return NextResponse.json(
        {
          error:
            "PDF parsing not yet implemented. Please copy and paste your resume text instead.",
        },
        { status: 400 }
      );
    } else {
      // For Word documents, we'll need to extract text
      // For now, return an error asking user to copy/paste
      loggerService.warn('Word document parsing not implemented', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_word_not_implemented',
        duration: Date.now() - startTime,
        metadata: {
          fileType: file.type,
          fileName: file.name
        }
      });
      return NextResponse.json(
        {
          error:
            "Word document parsing not yet implemented. Please copy and paste your resume text instead.",
        },
        { status: 400 }
      );
    }

    if (!extractedText.trim()) {
      loggerService.warn('Resume upload empty text extraction', {
        category: LogCategory.API,
        userId: user.id,
        action: 'resume_upload_empty_extraction',
        duration: Date.now() - startTime,
        metadata: {
          fileType: file.type,
          fileName: file.name
        }
      });
      return NextResponse.json(
        { error: "Could not extract text from the file" },
        { status: 400 }
      );
    }

    loggerService.info('Resume uploaded successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'resume_uploaded',
      duration: Date.now() - startTime,
      metadata: {
        fileType: file.type,
        fileName: file.name,
        fileSize: file.size,
        textLength: extractedText.length
      }
    });

    return NextResponse.json({ text: extractedText });
  } catch (error) {
    loggerService.error('Resume upload error', error, {
      category: LogCategory.API,
      userId: authResult?.user?.id,
      action: 'resume_upload_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to process resume" },
      { status: 500 }
    );
  }
}
