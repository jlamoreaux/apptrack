import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { checkAICoachAccess } from "@/lib/middleware/ai-coach-auth";
import { z } from "zod";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

const MessageSchema = z.object({
  content: z.string().min(1, "Message content is required"),
  is_user: z.boolean(),
});

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Check authentication and AI Coach access
    const authResult = await checkAICoachAccess('CAREER_ADVICE');
    if (!authResult.authorized) {
      loggerService.warn('Unauthorized career advice history access', {
        category: LogCategory.SECURITY,
        action: 'career_advice_history_unauthorized',
        metadata: {
          reason: authResult.reason || 'unknown'
        }
      });
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    // Get conversation history
    const { data: messages, error } = await supabase
      .from("career_advice")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      loggerService.error('Error fetching career advice history', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'career_advice_history_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch conversation history" }, { status: 500 });
    }

    loggerService.info('Career advice history retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'career_advice_history_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        messageCount: messages?.length || 0
      }
    });

    return NextResponse.json({ messages });

  } catch (error) {
    loggerService.error('Career advice history GET error', error, {
      category: LogCategory.API,
      action: 'career_advice_history_get_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication and AI Coach access
    const authResult = await checkAICoachAccess('CAREER_ADVICE');
    if (!authResult.authorized) {
      loggerService.warn('Unauthorized career advice history post', {
        category: LogCategory.SECURITY,
        action: 'career_advice_history_post_unauthorized',
        metadata: {
          reason: authResult.reason || 'unknown'
        }
      });
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = MessageSchema.parse(body);

    // Insert message
    const { data: message, error } = await supabase
      .from("career_advice")
      .insert([
        {
          ...validatedData,
          user_id: user.id,
        }
      ])
      .select()
      .single();

    if (error) {
      loggerService.error('Error saving career advice message', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'career_advice_message_save_error',
        duration: Date.now() - startTime,
        metadata: {
          isUserMessage: validatedData.is_user
        }
      });
      return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
    }

    loggerService.info('Career advice message saved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'career_advice_message_saved',
      duration: Date.now() - startTime,
      metadata: {
        isUserMessage: validatedData.is_user,
        messageLength: validatedData.content.length
      }
    });

    return NextResponse.json({ message }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      loggerService.warn('Career advice history validation error', {
        category: LogCategory.API,
        userId: authResult?.user?.id,
        action: 'career_advice_history_validation_error',
        duration: Date.now() - startTime,
        metadata: {
          errors: error.errors
        }
      });
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    loggerService.error('Career advice history POST error', error, {
      category: LogCategory.API,
      userId: authResult?.user?.id,
      action: 'career_advice_history_post_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}