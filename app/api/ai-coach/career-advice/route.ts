import { type NextRequest } from "next/server";
import { streamText, generateText, createTextStreamResponse, type LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { AI_COACH_PROMPTS } from "@/lib/constants/ai-prompts";
import { RateLimitService } from "@/lib/services/rate-limit.service";
import { getUserSubscriptionTier } from "@/lib/middleware/rate-limit.middleware";

// Cast to LanguageModel to handle type compatibility between ai and @ai-sdk/openai
const model = openai("gpt-4o-mini") as LanguageModel;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

async function careerAdviceHandler(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn("Unauthorized career advice request", {
        category: LogCategory.SECURITY,
        action: "career_advice_unauthorized",
      });
      return new Response(JSON.stringify({ error: ERROR_MESSAGES.UNAUTHORIZED }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    userId = user.id;

    // Check permission using middleware
    const permissionResult = await PermissionMiddleware.checkApiPermission(
      user.id,
      "CAREER_ADVICE"
    );

    if (!permissionResult.allowed) {
      loggerService.logSecurityEvent(
        "ai_feature_access_denied",
        "medium",
        {
          feature: "career_advice",
          reason: permissionResult.reason || "subscription_required",
          userId: user.id,
        },
        { userId: user.id }
      );
      return new Response(
        JSON.stringify({
          error: permissionResult.message || ERROR_MESSAGES.AI_COACH_REQUIRED,
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check rate limit
    const subscriptionTier = await getUserSubscriptionTier(user.id);
    const rateLimitService = RateLimitService.getInstance();
    const rateLimitResult = await rateLimitService.checkLimit(
      user.id,
      "career_advice",
      subscriptionTier
    );

    if (!rateLimitResult.allowed) {
      loggerService.warn("Rate limit exceeded for career advice", {
        category: LogCategory.SECURITY,
        userId: user.id,
        action: "rate_limit_exceeded",
        metadata: {
          feature: "career_advice",
          limit: rateLimitResult.limit,
          resetAt: rateLimitResult.reset.toISOString(),
        },
      });
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: `You have exceeded the ${rateLimitResult.limit} requests limit. Please try again after ${rateLimitResult.reset.toLocaleTimeString()}.`,
          resetAt: rateLimitResult.reset.toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
            ...(rateLimitResult.retryAfter && {
              "Retry-After": rateLimitResult.retryAfter.toString(),
            }),
          },
        }
      );
    }

    // Track usage asynchronously
    rateLimitService.trackUsage(user.id, "career_advice", true).catch((err) => {
      loggerService.error("Failed to track rate limit usage", err, {
        category: LogCategory.PERFORMANCE,
        userId: user.id,
        action: "rate_limit_track_error",
      });
    });

    const body = await request.json();
    const messages: Message[] = body.messages || [];
    let conversationId: string | undefined = body.conversationId;

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.MISSING_QUESTION }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.MISSING_QUESTION }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate conversation ownership if conversationId is provided
    if (conversationId) {
      const { data: existingConv, error: convCheckError } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .single();

      if (convCheckError || !existingConv) {
        loggerService.warn("Invalid conversation access attempt", {
          category: LogCategory.SECURITY,
          userId: user.id,
          action: "invalid_conversation_access",
          metadata: { conversationId },
        });
        return new Response(
          JSON.stringify({ error: "Conversation not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create a new conversation if none provided
    if (!conversationId) {
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: null, // Will be generated after first exchange
        })
        .select()
        .single();

      if (convError) {
        loggerService.error("Error creating conversation", convError, {
          category: LogCategory.DATABASE,
          userId: user.id,
          action: "conversation_create_error",
        });
        return new Response(
          JSON.stringify({ error: "Failed to create conversation" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      conversationId = conversation.id;
    }

    // Save the user message
    const { error: saveUserError } = await supabase.from("career_advice").insert({
      user_id: user.id,
      conversation_id: conversationId,
      content: lastUserMessage.content,
      is_user: true,
      created_at: new Date().toISOString(),
    });

    if (saveUserError) {
      loggerService.error("Error saving user message", saveUserError, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: "career_advice_save_user_message_error",
      });
    }

    loggerService.debug("Generating career advice response", {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: "career_advice_generation_start",
      metadata: {
        conversationId,
        messageCount: messages.length,
      },
    });

    // Convert messages to the format expected by the AI SDK
    const aiMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Stream the response
    const result = streamText({
      model,
      system: AI_COACH_PROMPTS.CAREER_ADVISOR,
      messages: aiMessages,
      async onFinish({ text, usage }) {
        const aiGenerationDuration = Date.now() - startTime;

        // Save the AI response
        const { error: saveAiError } = await supabase.from("career_advice").insert({
          user_id: user.id,
          conversation_id: conversationId,
          content: text,
          is_user: false,
          created_at: new Date().toISOString(),
        });

        if (saveAiError) {
          loggerService.error("Error saving AI message", saveAiError, {
            category: LogCategory.DATABASE,
            userId: user.id,
            action: "career_advice_save_ai_message_error",
          });
        }

        // Generate a title for new conversations (first message)
        const { data: conv } = await supabase
          .from("conversations")
          .select("title")
          .eq("id", conversationId)
          .single();

        if (conv && !conv.title) {
          try {
            const titleResult = await generateText({
              model,
              system:
                "Generate a short, descriptive title (max 50 characters) for this conversation. Return only the title text, no quotes or extra formatting.",
              prompt: lastUserMessage.content,
              maxOutputTokens: 50,
            });

            const generatedTitle = titleResult.text.trim().slice(0, 50);

            await supabase
              .from("conversations")
              .update({
                title: generatedTitle,
                updated_at: new Date().toISOString(),
              })
              .eq("id", conversationId);
          } catch (titleError) {
            loggerService.warn("Failed to generate conversation title", {
              category: LogCategory.AI_SERVICE,
              userId: user.id,
              action: "conversation_title_generation_error",
              metadata: { conversationId },
            });
          }
        } else {
          // Update the conversation's updated_at timestamp
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);
        }

        loggerService.info("Career advice generated successfully", {
          category: LogCategory.AI_SERVICE,
          userId: user.id,
          action: "career_advice_ai_response",
          duration: aiGenerationDuration,
          metadata: {
            conversationId,
            responseLength: text.length,
            model: "gpt-4o-mini",
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
          },
        });
      },
    });

    // Return the stream with the conversation ID in the headers
    return createTextStreamResponse({
      textStream: result.textStream,
      headers: {
        ...(conversationId && { "X-Conversation-Id": conversationId }),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Limit": rateLimitResult.limit.toString(),
      },
    });
  } catch (error) {
    loggerService.error("Error getting career advice", error, {
      category: LogCategory.API,
      userId,
      action: "career_advice_error",
      duration: Date.now() - startTime,
      metadata: {
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
    });

    if (error instanceof Error) {
      if (error.message.includes("OPENAI_API_KEY") || error.message.includes("API key")) {
        return new Response(
          JSON.stringify({ error: "AI service not configured. Please contact support." }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      if (error.message.includes("Rate limit")) {
        return new Response(
          JSON.stringify({
            error: "AI service rate limit exceeded. Please try again in a few moments.",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      if (error.message.includes("quota")) {
        return new Response(
          JSON.stringify({ error: "AI service quota exceeded. Please contact support." }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.GENERATION_FAILED }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const POST = careerAdviceHandler;
