import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAICoachAccess } from "@/lib/middleware/ai-coach-auth";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { z } from "zod";

const CreateConversationSchema = z.object({
  title: z.string().optional(),
});

// GET /api/ai-coach/conversations - List all conversations for user
export async function GET() {
  const startTime = Date.now();

  try {
    const authResult = await checkAICoachAccess("CAREER_ADVICE");
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      loggerService.error("Error fetching conversations", error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: "conversations_fetch_error",
        duration: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      );
    }

    loggerService.debug("Conversations retrieved", {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: "conversations_retrieved",
      duration: Date.now() - startTime,
      metadata: { count: conversations?.length || 0 },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    loggerService.error("Conversations GET error", error, {
      category: LogCategory.API,
      action: "conversations_get_error",
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}

// POST /api/ai-coach/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authResult = await checkAICoachAccess("CAREER_ADVICE");
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    const body = await request.json().catch(() => ({}));
    const { title } = CreateConversationSchema.parse(body);

    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: title || null,
      })
      .select()
      .single();

    if (error) {
      loggerService.error("Error creating conversation", error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: "conversation_create_error",
        duration: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    loggerService.info("Conversation created", {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: "conversation_created",
      duration: Date.now() - startTime,
      metadata: { conversationId: conversation.id },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    loggerService.error("Conversations POST error", error, {
      category: LogCategory.API,
      action: "conversations_post_error",
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}
