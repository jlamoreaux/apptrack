import { calculateCost, type ModelType } from "@/lib/openai/models";
import { captureServerEventAfterResponse } from "@/lib/analytics/posthog-server";

/**
 * Feature names for `$ai_span_name`, so cost and failures can be broken down by
 * feature in PostHog AI Observability.
 */
export type AiFeature =
  | "career_advice"
  | "career_advice_title"
  | "career_coach"
  | "resume_advice"
  | "interview_prep"
  | "cover_letter"
  | "job_description_analysis"
  | "job_fit_analysis"
  | "careerotter_coach"
  | "careerotter_coach_summary"
  | "careerotter_case"
  | "careerotter_zero_to_case"
  | "careerotter_tailored_resume"
  | "careerotter_recap"
  | "onboarding_insight"
  | "onboarding_job_extraction"
  | "weekly_digest_insight"
  | "changelog"
  | "resume_roast"
  | "unspecified";

export interface AiTrackingContext {
  feature: AiFeature;
  /** User id. Omit for system jobs (cron, changelog). */
  distinctId?: string;
  /** Groups several generations from one user action into a single trace. */
  traceId?: string;
  /** Groups traces from one conversation. */
  sessionId?: string;
}

export interface AiGenerationResult {
  model: ModelType;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  finishReason?: string | null;
  stream?: boolean;
  error?: unknown;
}

const SYSTEM_DISTINCT_ID = "apptrack-server";

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

/**
 * Record one LLM call as a PostHog `$ai_generation` event. Prompt and completion text
 * are deliberately not sent: they contain resumes and job-search details, and token,
 * cost, latency, and error data are what the dashboards need.
 */
export function trackAiGeneration(context: AiTrackingContext, result: AiGenerationResult): void {
  try {
    captureGeneration(context, result);
  } catch {
    // Analytics must never fail the AI call it describes
  }
}

function captureGeneration(context: AiTrackingContext, result: AiGenerationResult): void {
  const cost = calculateCost(result.model, result);
  const isError = result.error !== undefined;

  captureServerEventAfterResponse(context.distinctId ?? SYSTEM_DISTINCT_ID, "$ai_generation", {
    $ai_provider: "openai",
    $ai_model: result.model,
    $ai_span_name: context.feature,
    $ai_trace_id: context.traceId ?? crypto.randomUUID(),
    $ai_session_id: context.sessionId ?? null,
    $ai_latency: result.latencyMs / 1000,
    $ai_stream: result.stream ?? false,
    $ai_input_tokens: result.inputTokens,
    $ai_output_tokens: result.outputTokens,
    $ai_cache_read_input_tokens: result.cachedInputTokens,
    $ai_reasoning_tokens: result.reasoningTokens,
    $ai_input_cost_usd: cost.inputCostUsd,
    $ai_output_cost_usd: cost.outputCostUsd,
    $ai_total_cost_usd: cost.totalCostUsd,
    $ai_is_error: isError,
    ...(isError && {
      $ai_error: result.error instanceof Error ? result.error.message : String(result.error),
      $ai_http_status: errorStatus(result.error),
    }),
    finish_reason: result.finishReason ?? undefined,
    $process_person_profile: false,
  });
}

/** Token fields of a Vercel AI SDK `LanguageModelUsage`, mapped for trackAiGeneration. */
export function fromAiSdkUsage(usage: {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  inputTokenDetails?: { cacheReadTokens: number | undefined };
  outputTokenDetails?: { reasoningTokens: number | undefined };
}): Pick<AiGenerationResult, "inputTokens" | "outputTokens" | "cachedInputTokens" | "reasoningTokens"> {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
  };
}
