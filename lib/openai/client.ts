import OpenAI from "openai";
import { Models } from "./models";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_SYSTEM_PROMPT,
} from "./config";
import type { OpenAIOptions, ChatMessage } from "./types";

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

export async function callOpenAI({
  messages,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = DEFAULT_TEMPERATURE,
  model = Models.default,
  systemPrompt,
}: OpenAIOptions): Promise<string> {
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

    const response = await client.chat.completions.create({
      model,
      messages: apiMessages,
      max_tokens: maxTokens,
      temperature,
    });

    // Extract text from the response
    if (response.choices && response.choices[0]?.message?.content) {
      return response.choices[0].message.content;
    }

    throw new Error("No content in response");
  } catch (error) {
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        throw new Error("Invalid or missing OpenAI API key");
      }
      if (error.message.includes("rate limit")) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (error.message.includes("model")) {
        throw new Error(`Invalid model: ${model}`);
      }
    }
    
    throw new Error("Failed to get response from OpenAI. Please try again.");
  }
}

// Legacy function name for backward compatibility
export async function callCareerCoach(options: OpenAIOptions): Promise<string> {
  return callOpenAI(options);
}