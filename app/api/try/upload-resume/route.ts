import { NextRequest, NextResponse } from "next/server";
import {
  extractTextFromBuffer,
  isSupportedFileType,
} from "@/lib/utils/text-extraction-server";
import { loggerService, LogCategory } from "@/lib/services/logger.service";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    if (!isSupportedFileType(file.type)) {
      return NextResponse.json(
        { error: "Please upload a PDF, Word document, or text file" },
        { status: 400 }
      );
    }

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

    return NextResponse.json({ text: extractionResult.text });
  } catch (error) {
    loggerService.error("Resume upload error", LogCategory.API, { error });
    return NextResponse.json(
      { error: "Failed to process resume" },
      { status: 500 }
    );
  }
}
