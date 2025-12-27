import OpenAI from "openai";
import { Models } from "./models";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_SYSTEM_PROMPT,
} from "./config";
import type { OpenAIOptions, ChatMessage } from "./types";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

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
}: OpenAIOptions): Promise<string> {
  const startTime = Date.now();
  
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
        maxTokens,
        temperature,
        messageCount: apiMessages.length,
        systemPromptLength: systemMessage.length,
        userMessageLength: apiMessages.find(m => m.role === 'user')?.content.length || 0
      }
    });

    const response = await client.chat.completions.create({
      model,
      messages: apiMessages,
      max_tokens: maxTokens,
      temperature,
    });

    // Extract text from the response
    if (response.choices && response.choices[0]?.message?.content) {
      const content = response.choices[0].message.content;
      
      loggerService.info('OpenAI API response received', {
        category: LogCategory.AI_SERVICE,
        action: 'openai_response_success',
        duration: Date.now() - startTime,
        metadata: {
          model,
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
          responseLength: content.length
        }
      });
      
      return content;
    }

    throw new Error("No content in response");
  } catch (error) {
    const errorDetails: any = {
      category: LogCategory.AI_SERVICE,
      action: 'openai_error',
      duration: Date.now() - startTime,
      metadata: { model, maxTokens }
    };
    
    // Provide more specific error messages
    if (error instanceof Error) {
      errorDetails.metadata.errorMessage = error.message;
      
      if (error.message.includes("API key") || error.message === "OPENAI_API_KEY is not set") {
        loggerService.error('OpenAI API key error', error, errorDetails);
        throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.");
      }
      if (error.message.includes("rate limit")) {
        loggerService.warn('OpenAI rate limit exceeded', errorDetails);
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (error.message.includes("model")) {
        loggerService.error('Invalid OpenAI model', error, errorDetails);
        throw new Error(`Invalid model: ${model}`);
      }
      if (error.message.includes("insufficient_quota")) {
        loggerService.error('OpenAI quota exceeded', error, errorDetails);
        throw new Error("OpenAI API quota exceeded. Please check your billing.");
      }
    }
    
    loggerService.error('OpenAI API call failed', error, errorDetails);
    throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Legacy function name for backward compatibility
export async function callCareerCoach(options: OpenAIOptions): Promise<string> {
  return callOpenAI(options);
}