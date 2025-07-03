import { SYSTEM_PROMPTS } from "@/lib/constants/ai-prompts";

// Configuration constants
export const DEFAULT_MAX_TOKENS = 1024;
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_SYSTEM_PROMPT =
  "You are a professional career coach specializing in job applications, interviews, and career development. Provide helpful, actionable advice.";

// Re-export system prompts for backward compatibility
export { SYSTEM_PROMPTS };
