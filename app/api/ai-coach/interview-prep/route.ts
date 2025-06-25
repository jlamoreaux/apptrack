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
      "INTERVIEW_PREP"
    );

    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED },
        { status: 403 }
      );
    }

    const { jobDescription, userBackground } = await request.json();

    if (!jobDescription) {
      return NextResponse.json(
        {
          error: ERROR_MESSAGES.AI_COACH.INTERVIEW_PREP.MISSING_JOB_DESCRIPTION,
        },
        { status: 400 }
      );
    }

    const aiCoach = createAICoach(user.id);
    const preparation = await aiCoach.prepareForInterview(
      jobDescription,
      userBackground
    );

    // Create interview prep record using service
    const aiCoachService = new AICoachService();
    await aiCoachService.createInterviewPrep(
      user.id,
      jobDescription,
      JSON.stringify(preparation)
    );

    return NextResponse.json({ preparation });
  } catch (error) {
    console.error("Error in interview preparation:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.INTERVIEW_PREP.GENERATION_FAILED },
      { status: 500 }
    );
  }
}
