import type OpenAI from "openai";
import { getModelSpec, type ModelType } from "./models";

export interface ChatParamOptions {
  maxTokens: number;
  temperature?: number;
  responseFormat?: "json_object";
}

/**
 * Chat Completions params for `model`. Uses `max_completion_tokens` because reasoning
 * models reject `max_tokens` (older models accept both), drops `temperature` where the
 * model rejects it, and pins the reasoning effort from the model spec.
 */
export function buildChatCompletionParams(
  model: ModelType,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  { maxTokens, temperature, responseFormat }: ChatParamOptions
): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming {
  const spec = getModelSpec(model);

  return {
    model,
    messages,
    max_completion_tokens: maxTokens,
    ...(spec.supportsTemperature && temperature !== undefined && { temperature }),
    ...(spec.reasoningEffort && {
      // The installed openai SDK's ReasoningEffort type predates `none`; the API accepts it.
      reasoning_effort: spec.reasoningEffort as OpenAI.ReasoningEffort,
    }),
    ...(responseFormat && { response_format: { type: responseFormat } }),
  };
}

/**
 * `providerOptions` for Vercel AI SDK calls. The AI SDK already strips temperature for
 * GPT-6 models; it needs the effort passed explicitly or the API default (`medium`) applies.
 */
export function buildAiSdkProviderOptions(model: ModelType) {
  const { reasoningEffort } = getModelSpec(model);
  return reasoningEffort ? { openai: { reasoningEffort } } : undefined;
}
