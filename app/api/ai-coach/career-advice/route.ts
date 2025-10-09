import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAICoach } from "@/lib/ai-coach";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { withRateLimit } from "@/lib/middleware/rate-limit.middleware";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

async function careerAdviceHandler(request: NextRequest) {
  const startTime = Date.now();
  let user: any = null;
  let message: string | undefined;
  
  try {
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    
    user = authUser;

    if (!user) {
      loggerService.warn('Unauthorized career advice request', {
        category: LogCategory.SECURITY,
        action: 'career_advice_unauthorized'
      });
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
      loggerService.logSecurityEvent(
        'ai_feature_access_denied',
        'medium',
        {
          feature: 'career_advice',
          reason: permissionResult.reason || 'subscription_required',
          userId: user.id
        },
        { userId: user.id }
      );
      return NextResponse.json(
        { error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED },
        { status: 403 }
      );
    }

    const requestBody = await request.json();
    message = requestBody.message;
    const conversationHistory = requestBody.conversationHistory;

    if (!message) {
      loggerService.warn('Career advice request missing message', {
        category: LogCategory.API,
        userId: user.id,
        action: 'career_advice_missing_message',
        duration: Date.now() - startTime
      });
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
      loggerService.error('Error saving user message', saveUserError, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'career_advice_save_user_message_error',
        metadata: {
          messageLength: message.length
        }
      });
    }

    // Generate AI response using the AI Coach
    const aiCoach = createAICoach(user.id);

    // Build context from conversation history
    const context = conversationHistory || [];

    loggerService.debug('Generating career advice response', {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: 'career_advice_generation_start',
      metadata: {
        contextLength: context.length,
        messageLength: message.length
      }
    });

    // Call the askCareerQuestion method with the message and context
    const aiGenerationStartTime = Date.now();
    const response = await aiCoach.askCareerQuestion(message, context);
    const aiGenerationDuration = Date.now() - aiGenerationStartTime;

    loggerService.info('Career advice generated successfully', {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: 'career_advice_ai_response',
      duration: aiGenerationDuration,
      metadata: {
        promptLength: message.length,
        responseLength: response.length,
        model: 'gpt-4o-mini', // Based on the logs showing this model
        estimatedTokens: Math.round((message.length + response.length) / 4)
      }
    });

    // Save AI response to database
    const aiMessage = {
      user_id: user.id,
      content: response,
      is_user: false,
      created_at: new Date().toISOString(),
    };

    const { error: saveAiError } = await supabase
      .from("career_advice")
      .insert(aiMessage);

    if (saveAiError) {
      loggerService.error('Error saving AI message', saveAiError, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'career_advice_save_ai_message_error',
        metadata: {
          responseLength: response.length
        }
      });
    }

    loggerService.info('Career advice generated successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'career_advice_generated',
      duration: Date.now() - startTime,
      metadata: {
        messageLength: message.length,
        responseLength: response.length,
        hasConversationHistory: (conversationHistory?.length || 0) > 0
      }
    });

    return NextResponse.json({ response: aiMessage.content });
  } catch (error) {
    loggerService.error('Error getting career advice', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'career_advice_error',
      duration: Date.now() - startTime,
      metadata: {
        message: message?.substring(0, 100), // First 100 chars for context
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }
    });
    
    // Return specific error messages for better debugging
    if (error instanceof Error) {
      if (error.message.includes('OPENAI_API_KEY') || error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service not configured. Please contact support.' },
          { status: 503 }
        );
      }
      if (error.message.includes('Rate limit')) {
        return NextResponse.json(
          { error: 'AI service rate limit exceeded. Please try again in a few moments.' },
          { status: 429 }
        );
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'AI service quota exceeded. Please contact support.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.GENERATION_FAILED },
      { status: 500 }
    );
  }
}

// Export with rate limiting middleware
export const POST = async (request: NextRequest) => {
  return withRateLimit(careerAdviceHandler, {
    feature: "career_advice",
    request,
  });
};
