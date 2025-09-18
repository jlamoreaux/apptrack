export const OpenAIModels = {
  // Latest models
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
  GPT_4_TURBO: "gpt-4-turbo",
  
  // O1 series (reasoning models - more expensive)
  O1_PREVIEW: "o1-preview",
  O1_MINI: "o1-mini",
  
  // Legacy models
  GPT_4: "gpt-4",
  GPT_3_5_TURBO: "gpt-3.5-turbo",
} as const;

// Main Models object for easy access
export const Models = {
  // Default model - extremely cost-effective
  default: OpenAIModels.GPT_4O_MINI,
  
  // Premium model for complex tasks
  premium: OpenAIModels.GPT_4O,
  
  // Fast model for quick responses
  fast: OpenAIModels.GPT_4O_MINI,
  
  // Advanced model for complex reasoning (expensive, use sparingly)
  advanced: OpenAIModels.GPT_4_TURBO,
  
  // All models
  openai: OpenAIModels,
} as const;

// Type for any model
export type ModelType = (typeof OpenAIModels)[keyof typeof OpenAIModels];