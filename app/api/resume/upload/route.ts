import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ResumeService } from "@/services/resumes";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import {
  extractTextFromBuffer,
  isSupportedFileType,
} from "@/lib/utils/text-extraction-server";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isSupportedFileType(file.type)) {
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
      return NextResponse.json(
        { error: extractionResult.error || "Failed to extract text from file" },
        { status: 400 }
      );
    }

    if (!extractionResult.text.trim()) {
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
      console.error("Storage upload error:", uploadError);
      console.error("Error details:", {
        message: uploadError.message,
        name: uploadError.name,
        stack: uploadError.stack,
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
    console.error("Resume upload error:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
