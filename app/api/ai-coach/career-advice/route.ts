import { type NextRequest } from "next/server";
import { streamText, generateText, tool, stepCountIs, type LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { AI_COACH_PROMPTS } from "@/lib/constants/ai-prompts";
import { RateLimitService } from "@/lib/services/rate-limit.service";
import { getUserSubscriptionTier } from "@/lib/middleware/rate-limit.middleware";
import { ResumeService } from "@/services/resumes";
import { ApplicationDAL } from "@/dal/applications";
import { APPLICATION_STATUS_VALUES, type ApplicationStatus } from "@/lib/constants/application-status";

// Cast to LanguageModel to handle type compatibility between ai and @ai-sdk/openai
const model = openai("gpt-4o-mini") as LanguageModel;

// Service instances
const resumeService = new ResumeService();
const applicationDAL = new ApplicationDAL();

/**
 * Creates AI tools with user context for the career advisor
 */
function createCareerAdvisorTools(userId: string) {
  return {
    getSavedResumes: tool({
      description: "Get a list of the user's saved resumes. Use this to see what resumes they have available.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const resumes = await resumeService.getAllResumes(userId);
          return resumes.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            isDefault: r.is_default,
            uploadedAt: r.uploaded_at,
          }));
        } catch (error) {
          loggerService.error("Tool error: getSavedResumes", error, {
            category: LogCategory.AI_SERVICE,
            userId,
            action: "tool_get_saved_resumes_error",
          });
          return { error: "Failed to fetch resumes" };
        }
      },
    }),

    getResumeContent: tool({
      description: "Get the text content of a specific resume by ID, or the default resume if no ID is provided. Use this to analyze or reference the user's resume.",
      inputSchema: z.object({
        resumeId: z.string().uuid().optional().describe("The ID of a specific resume. If not provided, returns the default resume."),
      }),
      execute: async ({ resumeId }) => {
        try {
          let resume;
          if (resumeId) {
            resume = await resumeService.findById(resumeId);
            // Verify ownership
            if (resume && resume.user_id !== userId) {
              return { error: "Resume not found" };
            }
          } else {
            resume = await resumeService.getDefaultResume(userId);
          }

          if (!resume) {
            return { error: resumeId ? "Resume not found" : "No default resume set" };
          }

          return {
            id: resume.id,
            name: resume.name,
            content: resume.extracted_text || "No text content available",
            isDefault: resume.is_default,
          };
        } catch (error) {
          loggerService.error("Tool error: getResumeContent", error, {
            category: LogCategory.AI_SERVICE,
            userId,
            action: "tool_get_resume_content_error",
          });
          return { error: "Failed to fetch resume content" };
        }
      },
    }),

    getJobApplications: tool({
      description: "Get the user's job applications. Can filter by status and limit results. Use this to understand their job search progress.",
      inputSchema: z.object({
        status: z.enum(APPLICATION_STATUS_VALUES as [string, ...string[]]).optional().describe("Filter by application status"),
        limit: z.number().min(1).max(50).default(10).describe("Maximum number of applications to return"),
        includeArchived: z.boolean().default(false).describe("Include archived applications"),
      }),
      execute: async ({ status, limit, includeArchived }) => {
        try {
          const result = await applicationDAL.queryApplications(userId, {
            pageSize: limit,
            statusFilter: status ? [status as ApplicationStatus] : [],
            includeArchived,
            sortField: "date_applied",
            sortDirection: "desc",
          });

          return result.applications.map((app) => ({
            id: app.id,
            company: app.company,
            role: app.role,
            status: app.status,
            dateApplied: app.date_applied,
            notes: app.notes,
            roleLink: app.role_link,
          }));
        } catch (error) {
          loggerService.error("Tool error: getJobApplications", error, {
            category: LogCategory.AI_SERVICE,
            userId,
            action: "tool_get_job_applications_error",
          });
          return { error: "Failed to fetch job applications" };
        }
      },
    }),

    getApplicationStats: tool({
      description: "Get statistics about the user's job search progress including counts by status and response rates.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const [statusCounts, totalCount, recentApps] = await Promise.all([
            applicationDAL.getStatusCounts(userId),
            applicationDAL.count(userId),
            applicationDAL.getRecentApplications(userId, 5),
          ]);

          const totalResponses = (statusCounts["Interview Scheduled"] || 0) +
            (statusCounts["Interviewed"] || 0) +
            (statusCounts["Offer"] || 0) +
            (statusCounts["Hired"] || 0) +
            (statusCounts["Rejected"] || 0);

          const responseRate = totalCount > 0 ? (totalResponses / totalCount) * 100 : 0;
          const interviewRate = totalCount > 0
            ? (((statusCounts["Interview Scheduled"] || 0) + (statusCounts["Interviewed"] || 0)) / totalCount) * 100
            : 0;

          const result = {
            totalApplications: totalCount,
            statusBreakdown: statusCounts,
            responseRate: Math.round(responseRate),
            interviewRate: Math.round(interviewRate),
            recentApplications: recentApps.map((app) => ({
              company: app.company,
              role: app.role,
              status: app.status,
              dateApplied: app.date_applied,
            })),
          };

          loggerService.info("Tool executed: getApplicationStats", {
            category: LogCategory.AI_SERVICE,
            userId,
            action: "tool_get_application_stats_success",
            metadata: { totalApplications: totalCount },
          });

          return result;
        } catch (error) {
          loggerService.error("Tool error: getApplicationStats", error, {
            category: LogCategory.AI_SERVICE,
            userId,
            action: "tool_get_application_stats_error",
          });
          return { error: "Failed to fetch application statistics" };
        }
      },
    }),

    searchApplications: tool({
      description: "Search the user's job applications by company name or role title.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Search query to match against company names or roles"),
      }),
      execute: async ({ query }) => {
        try {
          // Get all applications and filter client-side for simple search
          const allApps = await applicationDAL.findByUserId(userId);
          const lowerQuery = query.toLowerCase();

          const matches = allApps.filter(
            (app) =>
              app.company.toLowerCase().includes(lowerQuery) ||
              app.role.toLowerCase().includes(lowerQuery)
          ).slice(0, 10);

          return matches.map((app) => ({
            id: app.id,
            company: app.company,
            role: app.role,
            status: app.status,
            dateApplied: app.date_applied,
            notes: app.notes,
          }));
        } catch (error) {
          loggerService.error("Tool error: searchApplications", error, {
            category: LogCategory.AI_SERVICE,
            userId,
            action: "tool_search_applications_error",
          });
          return { error: "Failed to search applications" };
        }
      },
    }),

    updateApplicationStatus: tool({
      description: "Update the status of a job application. Use this when the user mentions they got an interview, offer, rejection, etc.",
      inputSchema: z.object({
        applicationId: z.string().uuid().describe("The ID of the application to update"),
        newStatus: z.enum(APPLICATION_STATUS_VALUES as [string, ...string[]]).describe("The new status for the application"),
        notes: z.string().optional().describe("Optional notes to add about this status change"),
      }),
      execute: async ({ applicationId, newStatus, notes }) => {
        try {
          // Verify ownership
          const existing = await applicationDAL.findById(applicationId);
          if (!existing || existing.user_id !== userId) {
            return { error: "Application not found" };
          }

          const updateData: { status: ApplicationStatus; notes?: string } = {
            status: newStatus as ApplicationStatus,
          };

          if (notes) {
            const existingNotes = existing.notes || "";
            const timestamp = new Date().toLocaleDateString();
            updateData.notes = existingNotes
              ? `${existingNotes}\n\n[${timestamp}] ${notes}`
              : `[${timestamp}] ${notes}`;
          }

          const updated = await applicationDAL.update(applicationId, updateData);

          if (!updated) {
            return { error: "Failed to update application" };
          }

          // Add to history
          await applicationDAL.addHistory({
            application_id: applicationId,
            user_id: userId,
            status: newStatus,
            notes: notes,
          });

          return {
            success: true,
            application: {
              id: updated.id,
              company: updated.company,
              role: updated.role,
              status: updated.status,
              dateApplied: updated.date_applied,
            },
          };
        } catch (error) {
          loggerService.error("Tool error: updateApplicationStatus", error, {
            category: LogCategory.AI_SERVICE,
            userId,
            action: "tool_update_application_status_error",
          });
          return { error: "Failed to update application status" };
        }
      },
    }),
  };
}

/**
 * Builds an enhanced system prompt that includes the user's default resume context
 */
async function buildSystemPromptWithContext(userId: string): Promise<string> {
  let contextSection = "";

  try {
    const defaultResume = await resumeService.getDefaultResume(userId);
    if (defaultResume?.extracted_text) {
      contextSection = `

=== USER'S DEFAULT RESUME ===
The following is the user's default resume. Reference it when providing personalized career advice:

${defaultResume.extracted_text}

=== END OF RESUME ===

`;
    }
  } catch (error) {
    loggerService.warn("Failed to fetch default resume for context", {
      category: LogCategory.AI_SERVICE,
      userId,
      action: "default_resume_context_error",
    });
  }

  const toolsExplanation = `

You have access to tools that let you fetch real data about the user's job search:
- getSavedResumes: List all their saved resumes
- getResumeContent: Read the full text of a specific resume (or their default)
- getJobApplications: See their job applications with optional status filters
- getApplicationStats: Get statistics about their job search progress
- searchApplications: Search applications by company or role name
- updateApplicationStatus: Update an application's status when they share news (e.g., "I got an interview!")

Use these tools proactively to give personalized, data-driven advice. For example:
- If they ask "How is my job search going?", use getApplicationStats
- If they mention a specific company, use searchApplications to find their application
- If they share news like "I got an offer from Google!", use searchApplications to find the application, then updateApplicationStatus to record it

IMPORTANT: After using any tools, you MUST always respond with a helpful text message summarizing and explaining the results to the user. Never just return tool results without commentary.
`;

  return AI_COACH_PROMPTS.CAREER_ADVISOR + contextSection + toolsExplanation;
}

interface MessagePart {
  type: string;
  text?: string;
  toolInvocation?: unknown;
  toolResult?: unknown;
}

/**
 * Message interface that handles both traditional content format and UIMessage parts format.
 *
 * EXPERIMENTAL: experimental_attachments is not part of the official AI SDK types.
 * This is a custom extension that may break with SDK updates. Use with caution.
 *
 * @see https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot for official SDK documentation
 */
interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  parts?: MessagePart[];
  /**
   * Tool invocations for assistant messages that called tools
   */
  toolInvocations?: unknown[];
  /**
   * EXPERIMENTAL: Custom attachment handling.
   * Not part of official SDK. May break with updates.
   * Runtime validation required before use.
   */
  experimental_attachments?: Array<{
    name: string;
    contentType: string;
    url: string;
  }>;
}

/**
 * Type guard to validate experimental attachment structure.
 * Use this before accessing attachment properties to ensure runtime safety.
 */
function isValidAttachment(attachment: unknown): attachment is {
  name: string;
  contentType: string;
  url: string;
} {
  return (
    typeof attachment === "object" &&
    attachment !== null &&
    "name" in attachment &&
    typeof attachment.name === "string" &&
    "contentType" in attachment &&
    typeof attachment.contentType === "string" &&
    "url" in attachment &&
    typeof attachment.url === "string"
  );
}

// Helper to extract content from message including attachments
function getMessageContent(message: Message): string {
  let textContent = "";

  if (message.content) {
    textContent = message.content;
  }

  if (message.parts) {
    textContent += message.parts
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("");
  }

  // Handle experimental_attachments with runtime validation
  if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
    for (const attachment of message.experimental_attachments) {
      // Validate attachment structure at runtime
      if (!isValidAttachment(attachment)) {
        loggerService.warn("Invalid attachment structure detected", {
          category: LogCategory.SECURITY,
          action: "invalid_attachment",
          metadata: { attachment },
        });
        continue;
      }

      if (attachment.contentType.startsWith("text/") && attachment.url) {
        try {
          // Decode data URL
          const base64Data = attachment.url.split(",")[1];
          if (base64Data) {
            const fileContent = Buffer.from(base64Data, "base64").toString("utf-8");
            const fileType = attachment.name.toLowerCase().includes("resume")
              ? "resume"
              : attachment.name.toLowerCase().includes("job") ||
                attachment.name.toLowerCase().includes("jd")
              ? "job description"
              : "document";
            textContent += `\n\n=== ATTACHED ${fileType.toUpperCase()}: ${attachment.name} ===\n\n${fileContent}\n\n=== END OF ${fileType.toUpperCase()} ===`;
          }
        } catch (err) {
          loggerService.error("Failed to decode attachment", err, {
            category: LogCategory.API,
            action: "attachment_decode_error",
          });
        }
      }
    }
  }

  return textContent;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 10000;
const MIN_MESSAGE_LENGTH = 3;

/**
 * Validates message content for quality and security.
 */
function validateMessageContent(content: string): { valid: boolean; error?: string } {
  const trimmed = content.trim();

  if (!trimmed) {
    return { valid: false, error: "Message cannot be empty" };
  }

  if (trimmed.length < MIN_MESSAGE_LENGTH) {
    return { valid: false, error: "Message is too short. Please provide more context." };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    };
  }

  // Check for suspicious patterns
  const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, "")).size;
  const totalChars = trimmed.replace(/\s/g, "").length;
  if (totalChars > 20 && uniqueChars / totalChars < 0.3) {
    return {
      valid: false,
      error: "Message appears to contain suspicious patterns. Please use normal text.",
    };
  }

  return { valid: true };
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

    // Debug logging for message structure
    loggerService.debug("Received messages", {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: "career_advice_messages_received",
      metadata: {
        messageCount: messages.length,
        messageRoles: messages.map((m) => m.role),
        hasToolInvocations: messages.some((m) => m.toolInvocations?.length),
        messageStructure: messages.map((m) => ({
          role: m.role,
          hasContent: !!m.content,
          hasParts: !!m.parts?.length,
          hasToolInvocations: !!m.toolInvocations?.length,
        })),
      },
    });

    // Validate conversationId format if provided
    if (conversationId && !UUID_REGEX.test(conversationId)) {
      return new Response(
        JSON.stringify({ error: "Invalid conversation ID format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.MISSING_QUESTION }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Basic validation - only validate user messages have content
    // Assistant and tool messages may have complex structures (tool invocations, etc.)
    for (const msg of messages) {
      if (msg.role !== "user") {
        continue; // Only validate user messages
      }
      const content = getMessageContent(msg);
      if (!content.trim()) {
        return new Response(
          JSON.stringify({ error: "Message cannot be empty" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
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

    const lastUserContent = getMessageContent(lastUserMessage);

    // Validate only the new user message with comprehensive checks (length, spam detection, etc.)
    const lastMessageValidation = validateMessageContent(lastUserContent);
    if (!lastMessageValidation.valid) {
      return new Response(
        JSON.stringify({ error: lastMessageValidation.error || "Invalid message" }),
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
      content: lastUserContent,
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
    // Filter out tool-result messages and properly handle tool invocations
    const aiMessages = messages
      .filter((m) => m.role !== "tool") // Filter out tool result messages
      .map((m) => {
        // For messages with tool invocations, pass them through as-is if they have content
        const content = getMessageContent(m);
        return {
          role: m.role as "user" | "assistant",
          content: content || "", // Ensure content is never undefined
        };
      })
      .filter((m) => m.content); // Remove messages with no content

    // Ensure we have at least one message to send
    if (aiMessages.length === 0) {
      loggerService.warn("No valid messages after filtering", {
        category: LogCategory.AI_SERVICE,
        userId: user.id,
        action: "career_advice_no_valid_messages",
        metadata: {
          originalCount: messages.length,
          filteredCount: aiMessages.length,
        },
      });
      return new Response(
        JSON.stringify({ error: "No valid message content found" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Build enhanced system prompt with user context (default resume)
    const systemPrompt = await buildSystemPromptWithContext(user.id);

    // Create tools with user context
    const tools = createCareerAdvisorTools(user.id);

    // Stream the response with tools enabled
    const result = streamText({
      model,
      system: systemPrompt,
      messages: aiMessages,
      tools,
      stopWhen: stepCountIs(5), // Allow up to 5 steps for multi-step tool usage
      onStepFinish({ stepType, toolCalls, toolResults, text: stepText, finishReason }) {
        loggerService.info("Step finished", {
          category: LogCategory.AI_SERVICE,
          userId: user.id,
          action: "career_advice_step_finish",
          metadata: {
            stepType,
            finishReason,
            toolCallCount: toolCalls?.length || 0,
            toolResultCount: toolResults?.length || 0,
            textLength: stepText?.length || 0,
            toolNames: toolCalls?.map((tc: { toolName: string }) => tc.toolName) || [],
          },
        });
      },
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
              prompt: lastUserContent,
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

    // Return the UI message stream response (supports tool calls + text)
    return result.toUIMessageStreamResponse({
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

    // Return detailed error in development for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isDev = process.env.NODE_ENV === "development";

    return new Response(
      JSON.stringify({
        error: ERROR_MESSAGES.AI_COACH.CAREER_ADVICE.GENERATION_FAILED,
        ...(isDev && { details: errorMessage, stack: error instanceof Error ? error.stack : undefined }),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const POST = careerAdviceHandler;
