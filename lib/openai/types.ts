import { ModelType } from "./models";
import type { AiTrackingContext } from "@/lib/analytics/llm-tracking";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenAIOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  /** Ignored by models that reject it (all GPT-6 models). */
  temperature?: number;
  model?: ModelType;
  systemPrompt?: string;
  responseFormat?: "json_object";
  /** Attributes the call's cost and errors in PostHog. */
  tracking?: AiTrackingContext;
}

export type { ModelType, AiTrackingContext };
