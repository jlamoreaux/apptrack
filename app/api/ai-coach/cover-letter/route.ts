import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { withRateLimit } from "@/lib/middleware/rate-limit.middleware";

async function coverLetterHandler(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Check permission using middleware
    const permissionResult = await PermissionMiddleware.checkApiPermission(
      user.id,
      "COVER_LETTER"
    );

    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED },
        { status: 403 }
      );
    }

    const { 
      jobDescription, 
      userBackground, 
      companyName,
      roleName,
      applicationId,
      tone,
      additionalInfo 
    } = await request.json();

    if (!jobDescription || !userBackground || !companyName) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.AI_COACH.COVER_LETTER.MISSING_INFO },
        { status: 400 }
      );
    }

    const aiCoach = createAICoach(user.id);
    const coverLetter = await aiCoach.generateCoverLetter(
      jobDescription,
      userBackground,
      companyName
    );

    // Store the cover letter in database with additional metadata
    try {
      const supabase = await createClient();
      const { data: savedCoverLetter, error } = await supabase
        .from("cover_letters")
        .insert({
          user_id: user.id,
          application_id: applicationId || null,
          company_name: companyName,
          role_name: roleName || null,
          job_description: jobDescription,
          cover_letter: coverLetter,
          tone: tone || 'professional',
          additional_info: additionalInfo || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving cover letter to database:", error);
        // Don't fail the request if saving fails, still return the generated letter
      }
    } catch (saveError) {
      console.error("Failed to save cover letter:", saveError);
      // Continue anyway - the letter was generated successfully
    }

    return NextResponse.json({ coverLetter });
  } catch (error) {
    console.error("Error generating cover letter:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.COVER_LETTER.GENERATION_FAILED },
      { status: 500 }
    );
  }
}

// Export with rate limiting middleware
export const POST = withRateLimit(coverLetterHandler, {
  feature: 'cover_letter',
});
