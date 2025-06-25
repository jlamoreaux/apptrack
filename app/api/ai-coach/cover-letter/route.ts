import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { AICoachService } from "@/services/ai-coach";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export async function POST(request: NextRequest) {
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

    const { jobDescription, userBackground, companyName } =
      await request.json();

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

    // Create cover letter record using service
    const aiCoachService = new AICoachService();
    await aiCoachService.createCoverLetter(
      user.id,
      jobDescription,
      coverLetter
    );

    return NextResponse.json({ coverLetter });
  } catch (error) {
    console.error("Error generating cover letter:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.COVER_LETTER.GENERATION_FAILED },
      { status: 500 }
    );
  }
}
