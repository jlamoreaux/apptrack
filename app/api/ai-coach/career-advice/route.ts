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
      "CAREER_ADVICE"
    );

    if (!permissionResult.allowed) {
      return NextResponse.json(
        { error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED },
        { status: 403 }
      );
    }

    const { question, context } = await request.json();

    if (!question) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.MISSING_QUESTION },
        { status: 400 }
      );
    }

    const aiCoach = createAICoach(user.id);
    const advice = await aiCoach.askCareerQuestion(question, context);

    // Create career advice record using service
    const aiCoachService = new AICoachService();
    await aiCoachService.createCareerAdvice(
      user.id,
      question,
      JSON.stringify(advice)
    );

    return NextResponse.json({ advice });
  } catch (error) {
    console.error("Error getting career advice:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.GENERATION_FAILED },
      { status: 500 }
    );
  }
}
