/**
 * Example: AI service integration with logging
 * Shows how to add logging to OpenAI and other AI service calls
 */

import OpenAI from "openai";
import { loggerService } from "@/lib/services/logger.service";
import { Models } from "@/lib/openai/models";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_SYSTEM_PROMPT,
} from "@/lib/openai/config";
import type { OpenAIOptions, ChatMessage } from "@/lib/openai/types";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

export async function callOpenAIWithLogging({
  messages,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = DEFAULT_TEMPERATURE,
  model = Models.default,
  systemPrompt,
  requestId,
  userId,
}: OpenAIOptions & { requestId?: string; userId?: string }): Promise<string> {
  const startTime = performance.now();
  
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

    // Log the AI service call
    loggerService.debug('Starting OpenAI completion', {
      category: LogCategory.AI_SERVICE,
      requestId,
      userId,
      metadata: {
        model,
        messageCount: apiMessages.length,
        maxTokens,
        temperature
      }
    });

    const response = await client.chat.completions.create({
      model,
      messages: apiMessages,
      max_tokens: maxTokens,
      temperature,
    });

    const duration = performance.now() - startTime;
    const tokens = response.usage?.total_tokens;

    // Log successful completion
    loggerService.logAiServiceCall(
      'openai',
      'chat_completion',
      duration,
      tokens,
      undefined,
      {
        requestId,
        userId,
        model,
        metadata: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          finishReason: response.choices[0]?.finish_reason
        }
      }
    );

    // Extract text from the response
    if (response.choices && response.choices[0]?.message?.content) {
      return response.choices[0].message.content;
    }

    throw new Error("No content in response");
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Log the error with context
    loggerService.logAiServiceCall(
      'openai',
      'chat_completion',
      duration,
      undefined,
      error as Error,
      {
        requestId,
        userId,
        model
      }
    );
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        loggerService.logSecurityEvent(
          'invalid_api_key',
          'high',
          { service: 'openai' },
          { requestId }
        );
        throw new Error("Invalid or missing OpenAI API key");
      }
      if (error.message.includes("rate limit")) {
        loggerService.logSecurityEvent(
          'rate_limit_exceeded',
          'medium',
          { 
            service: 'openai',
            model 
          },
          { requestId, userId }
        );
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (error.message.includes("model")) {
        throw new Error(`Invalid model: ${model}`);
      }
    }
    
    throw new Error("Failed to get response from OpenAI. Please try again.");
  }
}

/**
 * Example of logging for streaming responses
 */
export async function streamOpenAIWithLogging({
  messages,
  model = Models.default,
  requestId,
  userId,
  onToken,
}: {
  messages: ChatMessage[];
  model?: string;
  requestId?: string;
  userId?: string;
  onToken?: (token: string) => void;
}): Promise<string> {
  const startTime = performance.now();
  let fullResponse = '';
  let tokenCount = 0;
  
  try {
    const client = getOpenAIClient();
    
    loggerService.debug('Starting OpenAI streaming completion', {
      category: LogCategory.AI_SERVICE,
      requestId,
      userId,
      metadata: {
        model,
        messageCount: messages.length
      }
    });
    
    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        tokenCount++;
        onToken?.(content);
      }
    }
    
    const duration = performance.now() - startTime;
    
    // Log successful streaming completion
    loggerService.logAiServiceCall(
      'openai',
      'chat_stream',
      duration,
      tokenCount,
      undefined,
      {
        requestId,
        userId,
        model,
        metadata: {
          responseLength: fullResponse.length,
          streamedTokens: tokenCount
        }
      }
    );
    
    return fullResponse;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    loggerService.logAiServiceCall(
      'openai',
      'chat_stream',
      duration,
      tokenCount,
      error as Error,
      {
        requestId,
        userId,
        model,
        metadata: {
          partialResponse: fullResponse.substring(0, 100)
        }
      }
    );
    
    throw error;
  }
}

// Import LogCategory for use in the examples
import { LogCategory } from "@/lib/services/logger.types";