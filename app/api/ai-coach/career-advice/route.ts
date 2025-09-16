import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { withRateLimit } from "@/lib/middleware/rate-limit.middleware";

async function careerAdviceHandler(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
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

    const { message, conversationHistory } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.MISSING_QUESTION },
        { status: 400 }
      );
    }

    // Save user message to database
    const userMessage = {
      user_id: user.id,
      content: message,
      is_user: true,
      created_at: new Date().toISOString(),
    };

    const { error: saveUserError } = await supabase
      .from("career_advice")
      .insert(userMessage);

    if (saveUserError) {
      console.error("Error saving user message:", saveUserError);
    }

    // Generate AI response using the AI Coach
    const aiCoach = createAICoach(user.id);
    
    // Build context from conversation history
    const context = conversationHistory || [];
    
    // Call the askCareerQuestion method with the message and context
    const response = await aiCoach.askCareerQuestion(message, context);

    // Save AI response to database
    const aiMessage = {
      user_id: user.id,
      content: typeof response === 'string' ? response : response.advice || response.message || JSON.stringify(response),
      is_user: false,
      created_at: new Date().toISOString(),
    };

    const { error: saveAiError } = await supabase
      .from("career_advice")
      .insert(aiMessage);

    if (saveAiError) {
      console.error("Error saving AI message:", saveAiError);
    }

    return NextResponse.json({ response: aiMessage.content });
  } catch (error) {
    console.error("Error getting career advice:", error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.GENERATION_FAILED },
      { status: 500 }
    );
  }
}

// Export with rate limiting middleware
export const POST = async (request: NextRequest) => {
  return withRateLimit(careerAdviceHandler, {
    feature: 'career_advice',
    request,
  });
};
