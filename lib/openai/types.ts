import { ModelType } from "./models";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenAIOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: ModelType;
  systemPrompt?: string;
}

export type { ModelType };