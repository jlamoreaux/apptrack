import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: cookies() }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
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
      return NextResponse.json(
        {
          error:
            "Word document parsing not yet implemented. Please copy and paste your resume text instead.",
        },
        { status: 400 }
      );
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from the file" },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: extractedText });
  } catch (error) {
    console.error("Resume upload error:", error);
    return NextResponse.json(
      { error: "Failed to process resume" },
      { status: 500 }
    );
  }
}
