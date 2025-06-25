import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ResumeService } from "@/services/resumes";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export async function GET(request: NextRequest) {
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

    const resumeService = new ResumeService();
    const resume = await resumeService.findCurrentByUserId(user.id);

    if (!resume) {
      return NextResponse.json({ error: "No resume found" }, { status: 404 });
    }

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
    console.error("Resume get error:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const resumeService = new ResumeService();
    const resume = await resumeService.findCurrentByUserId(user.id);

    if (!resume) {
      return NextResponse.json({ error: "No resume found" }, { status: 404 });
    }

    // Delete from storage
    const fileName = resume.file_url.split("/").pop();
    if (fileName) {
      const { error: storageError } = await supabase.storage
        .from("resumes")
        .remove([`resumes/${user.id}/${fileName}`]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
      }
    }

    // Delete from database
    await resumeService.delete(resume.id);

    return NextResponse.json({
      success: true,
      message: "Resume deleted successfully",
    });
  } catch (error) {
    console.error("Resume delete error:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.UNEXPECTED },
      { status: 500 }
    );
  }
}
