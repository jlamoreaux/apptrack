/**
 * OpenAI model registry. Every OpenAI call in the app resolves its model, request
 * parameters, and pricing from here, so a model bump is a change to this file only.
 *
 * Sources: https://developers.openai.com/api/docs/models and
 * https://developers.openai.com/api/docs/deprecations
 */
export const OpenAIModels = {
  GPT_6_LUNA: "gpt-6-luna",
  GPT_6_1_TERRA: "gpt-6.1-terra",
  GPT_6_1_SOL: "gpt-6.1-sol",
  // Kept only as a rollback target via OPENAI_DEFAULT_MODEL. OpenAI shuts it down
  // on 2027-01-14, after which selecting it will fail every request.
  GPT_4O_MINI: "gpt-4o-mini",
} as const;

export type ModelType = (typeof OpenAIModels)[keyof typeof OpenAIModels];

/** The reasoning efforts the app sends: the lowest each model accepts. */
export type ReasoningEffort = "none" | "low";

export interface ModelPricing {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M cached input tokens. Omitted where OpenAI has not published it. */
  cachedInput?: number;
  /** USD per 1M output tokens (reasoning tokens are billed as output) */
  output: number;
}

export interface ModelSpec {
  pricing: ModelPricing;
  /**
   * Effort sent with every request. GPT-6 models default to `medium`, which adds
   * latency and output tokens that the app's short, single-shot prompts don't need.
   */
  reasoningEffort: ReasoningEffort | null;
  /** GPT-6 models reject `temperature`/`top_p` at every reasoning effort. */
  supportsTemperature: boolean;
}

export const MODEL_SPECS = {
  "gpt-6-luna": {
    pricing: { input: 0.1, cachedInput: 0.01, output: 0.5 },
    reasoningEffort: "none",
    supportsTemperature: false,
  },
  "gpt-6.1-terra": {
    pricing: { input: 1, output: 5 },
    reasoningEffort: "none",
    supportsTemperature: false,
  },
  "gpt-6.1-sol": {
    pricing: { input: 2, output: 10 },
    // Sol has no `none` effort.
    reasoningEffort: "low",
    supportsTemperature: false,
  },
  "gpt-4o-mini": {
    pricing: { input: 0.15, cachedInput: 0.075, output: 0.6 },
    reasoningEffort: null,
    supportsTemperature: true,
  },
} as const satisfies Record<ModelType, ModelSpec>;

const KNOWN_MODELS: ReadonlySet<string> = new Set(Object.values(OpenAIModels));

export function isKnownModel(value: unknown): value is ModelType {
  return typeof value === "string" && KNOWN_MODELS.has(value);
}

/**
 * OPENAI_DEFAULT_MODEL switches the default (e.g. back to gpt-4o-mini) without a code
 * change. Unknown values are ignored so a typo can't take every AI feature down.
 */
function resolveDefaultModel(): ModelType {
  const override = process.env.OPENAI_DEFAULT_MODEL;
  return isKnownModel(override) ? override : OpenAIModels.GPT_6_LUNA;
}

const DEFAULT_MODEL = resolveDefaultModel();

export const Models = {
  // High-volume, cost-sensitive default for every feature today
  default: DEFAULT_MODEL,
  fast: DEFAULT_MODEL,
  // Reserved for tasks where the default's quality falls short
  premium: OpenAIModels.GPT_6_1_TERRA,
  advanced: OpenAIModels.GPT_6_1_SOL,
  openai: OpenAIModels,
} as const;

export function getModelSpec(model: ModelType): ModelSpec {
  return MODEL_SPECS[model];
}

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  /** Subset of inputTokens served from the prompt cache */
  cachedInputTokens?: number;
}

export interface CostBreakdown {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

/**
 * Standard-tier cost of one request. Ignores the long-context surcharge (prompts over
 * 272K tokens), which no feature in the app comes near.
 */
export function calculateCost(model: ModelType, usage: TokenUsage): CostBreakdown {
  const { pricing } = getModelSpec(model);
  const input = usage.inputTokens ?? 0;
  const cached = Math.min(usage.cachedInputTokens ?? 0, input);
  const uncached = input - cached;
  const cachedRate = pricing.cachedInput ?? pricing.input;

  const inputCostUsd = (uncached * pricing.input + cached * cachedRate) / 1_000_000;
  const outputCostUsd = ((usage.outputTokens ?? 0) * pricing.output) / 1_000_000;

  return { inputCostUsd, outputCostUsd, totalCostUsd: inputCostUsd + outputCostUsd };
}
