import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAICoachAccess } from "@/lib/middleware/ai-coach-auth";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { z } from "zod";

const UpdateConversationSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

// GET /api/ai-coach/conversations/[id] - Get conversation with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  try {
    const authResult = await checkAICoachAccess("CAREER_ADVICE");
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Get messages for this conversation
    const { data: messages, error: msgError } = await supabase
      .from("career_advice")
      .select("*")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (msgError) {
      loggerService.error("Error fetching conversation messages", msgError, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: "conversation_messages_fetch_error",
        duration: Date.now() - startTime,
        metadata: { conversationId: id },
      });
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    loggerService.debug("Conversation retrieved", {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: "conversation_retrieved",
      duration: Date.now() - startTime,
      metadata: { conversationId: id, messageCount: messages?.length || 0 },
    });

    return NextResponse.json({ conversation, messages });
  } catch (error) {
    loggerService.error("Conversation GET error", error, {
      category: LogCategory.API,
      action: "conversation_get_error",
      duration: Date.now() - startTime,
      metadata: { conversationId: id },
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}

// PATCH /api/ai-coach/conversations/[id] - Update conversation (rename)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  try {
    const authResult = await checkAICoachAccess("CAREER_ADVICE");
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    const body = await request.json();
    const { title } = UpdateConversationSchema.parse(body);

    const { data: conversation, error } = await supabase
      .from("conversations")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      loggerService.error("Error updating conversation", error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: "conversation_update_error",
        duration: Date.now() - startTime,
        metadata: { conversationId: id },
      });
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 }
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    loggerService.info("Conversation updated", {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: "conversation_updated",
      duration: Date.now() - startTime,
      metadata: { conversationId: id },
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    loggerService.error("Conversation PATCH error", error, {
      category: LogCategory.API,
      action: "conversation_patch_error",
      duration: Date.now() - startTime,
      metadata: { conversationId: id },
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}

// DELETE /api/ai-coach/conversations/[id] - Delete conversation and its messages
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  try {
    const authResult = await checkAICoachAccess("CAREER_ADVICE");
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    // Delete conversation (messages will cascade delete due to FK)
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      loggerService.error("Error deleting conversation", error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: "conversation_delete_error",
        duration: Date.now() - startTime,
        metadata: { conversationId: id },
      });
      return NextResponse.json(
        { error: "Failed to delete conversation" },
        { status: 500 }
      );
    }

    loggerService.info("Conversation deleted", {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: "conversation_deleted",
      duration: Date.now() - startTime,
      metadata: { conversationId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error("Conversation DELETE error", error, {
      category: LogCategory.API,
      action: "conversation_delete_error",
      duration: Date.now() - startTime,
      metadata: { conversationId: id },
    });
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}
