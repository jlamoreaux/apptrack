import OpenAI from "openai";
import { Models, type ModelType } from "./models";
import { buildChatCompletionParams } from "./request-params";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_SYSTEM_PROMPT,
} from "./config";
import type { OpenAIOptions, ChatMessage } from "./types";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { trackAiGeneration, type AiGenerationResult } from "@/lib/analytics/llm-tracking";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    loggerService.error('OpenAI API key not configured', new Error('Missing OPENAI_API_KEY'), {
      category: LogCategory.AI_SERVICE,
      action: 'openai_missing_api_key'
    });
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export async function callOpenAI({
  messages,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = DEFAULT_TEMPERATURE,
  model = Models.default,
  systemPrompt,
  responseFormat,
  tracking = { feature: "unspecified" },
}: OpenAIOptions): Promise<string> {
  const startTime = Date.now();
  let usage: OpenAI.CompletionUsage | undefined;
  let finishReason: string | null | undefined;

  try {
    const client = getOpenAIClient();

    // Extract system message if present in messages or use provided systemPrompt
    const systemMessage =
      systemPrompt ||
      messages.find((m) => m.role === "system")?.content ||
      DEFAULT_SYSTEM_PROMPT;

    // Build messages array with system message first
    const apiMessages: ChatMessage[] = [
      { role: "system", content: systemMessage },
      ...messages.filter((m) => m.role !== "system"),
    ];

    loggerService.info('Calling OpenAI API', {
      category: LogCategory.AI_SERVICE,
      action: 'openai_request',
      metadata: {
        model,
        feature: tracking.feature,
        maxTokens,
        temperature,
        messageCount: apiMessages.length,
        systemPromptLength: systemMessage.length,
        userMessageLength: apiMessages.find(m => m.role === 'user')?.content.length || 0
      }
    });

    const response = await client.chat.completions.create(
      buildChatCompletionParams(model, apiMessages, { maxTokens, temperature, responseFormat })
    );
    usage = response.usage;
    finishReason = response.choices[0]?.finish_reason;

    const content = response.choices[0]?.message?.content;
    if (!content) {
      // A reasoning model that spends the whole budget thinking returns empty content
      // with finish_reason "length"; say so instead of a bare "no content".
      throw new Error(`No content in response (finish_reason: ${finishReason ?? 'unknown'})`);
    }

    loggerService.info('OpenAI API response received', {
      category: LogCategory.AI_SERVICE,
      action: 'openai_response_success',
      duration: Date.now() - startTime,
      metadata: {
        model,
        feature: tracking.feature,
        finishReason,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        responseLength: content.length
      }
    });

    trackAiGeneration(tracking, toGenerationResult(model, startTime, usage, finishReason));
    return content;
  } catch (error) {
    trackAiGeneration(tracking, {
      ...toGenerationResult(model, startTime, usage, finishReason),
      error,
    });
    throw toServiceError(error, model, maxTokens, Date.now() - startTime);
  }
}

function toGenerationResult(
  model: ModelType,
  startTime: number,
  usage: OpenAI.CompletionUsage | undefined,
  finishReason: string | null | undefined
): AiGenerationResult {
  return {
    model,
    latencyMs: Date.now() - startTime,
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    cachedInputTokens: usage?.prompt_tokens_details?.cached_tokens,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
    finishReason,
  };
}

/** Logs the failure and maps it to a user-safe error, keyed on the API status and code. */
function toServiceError(error: unknown, model: ModelType, maxTokens: number, duration: number): Error {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const errorDetails = {
    category: LogCategory.AI_SERVICE,
    action: 'openai_error',
    duration,
    metadata: {
      model,
      maxTokens,
      errorMessage: message,
      status: error instanceof OpenAI.APIError ? error.status : undefined,
      code: error instanceof OpenAI.APIError ? error.code : undefined,
      param: error instanceof OpenAI.APIError ? error.param : undefined,
    },
  };

  if (message === "OPENAI_API_KEY is not set" || (error instanceof OpenAI.APIError && error.status === 401)) {
    loggerService.error('OpenAI API key error', error, errorDetails);
    return new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.");
  }
  if (error instanceof OpenAI.APIError) {
    if (error.code === "insufficient_quota") {
      loggerService.error('OpenAI quota exceeded', error, errorDetails);
      return new Error("OpenAI API quota exceeded. Please check your billing.");
    }
    if (error.status === 429) {
      loggerService.warn('OpenAI rate limit exceeded', errorDetails);
      return new Error("Rate limit exceeded. Please try again later.");
    }
    if (error.status === 404 || error.code === "model_not_found") {
      loggerService.error('Invalid OpenAI model', error, errorDetails);
      return new Error(`Invalid model: ${model}`);
    }
  }

  loggerService.error('OpenAI API call failed', error, errorDetails);
  return new Error(`AI service error: ${message}`);
}

// Legacy function name for backward compatibility
export async function callCareerCoach(options: OpenAIOptions): Promise<string> {
  return callOpenAI(options);
}