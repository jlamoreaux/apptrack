import { ModelType } from "./models";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CareerCoachOptions {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: ModelType;
}

export type { ModelType };
