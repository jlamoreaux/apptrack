export const AnthropicModels = {
  CLAUDE_3_5_SONNET: "anthropic/claude-3-5-sonnet",
  CLAUDE_3_5_HAIKU: "anthropic/claude-3-5-haiku",
  CLAUDE_3_7_SONNET: "anthropic/claude-3.7-sonnet",
  CLAUDE_4_SONNET: "anthropic/claude-4-sonnet",
} as const;

export const OpenAIModels = {
  GPT_O4_MINI: "openai/o4-mini",
  GPT_4O_MINI: "openai/gpt-4o-mini",
  GPT_4_TURBO: "openai/gpt-4-turbo",
  GPT_4_1: "openai/gpt-4.1",
  GPT_4_1_MINI: "openai/gpt-4.1-mini",
  GPT_4_1_NANO: "openai/gpt-4.1-nano",
} as const;

export const MetaModels = {
  LLAMA_3_1_8B: "meta/llama-3.1-8b",
  LLAMA_3_1_70B: "meta/llama-3.1-70b",
} as const;

export const GoogleModels = {
  GEMINI_PRO: "google/gemini-pro",
  GEMINI_FLASH: "google/gemini-flash",
} as const;

// Main Models object for easy access
export const Models = {
  anthropic: AnthropicModels,
  openai: OpenAIModels,
  meta: MetaModels,
  google: GoogleModels,
  // Default model for the application
  default: AnthropicModels.CLAUDE_4_SONNET,
} as const;

// Type for any model
export type ModelType =
  | (typeof AnthropicModels)[keyof typeof AnthropicModels]
  | (typeof OpenAIModels)[keyof typeof OpenAIModels]
  | (typeof MetaModels)[keyof typeof MetaModels]
  | (typeof GoogleModels)[keyof typeof GoogleModels];
