/**
 * Model registry, cost calculation, and per-model request parameters.
 */
import {
  Models,
  OpenAIModels,
  calculateCost,
  isKnownModel,
} from "@/lib/openai/models";
import {
  buildAiSdkProviderOptions,
  buildChatCompletionParams,
} from "@/lib/openai/request-params";

const MESSAGES = [{ role: "user" as const, content: "hi" }];

describe("Models", () => {
  it("defaults every feature to gpt-6-luna", () => {
    expect(Models.default).toBe("gpt-6-luna");
    expect(Models.fast).toBe("gpt-6-luna");
  });

  it("no longer offers models OpenAI has shut down", () => {
    const ids: string[] = Object.values(OpenAIModels);
    for (const dead of ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1-preview", "o1-mini"]) {
      expect(ids).not.toContain(dead);
    }
  });

  it("recognises only registered model ids", () => {
    expect(isKnownModel("gpt-6-luna")).toBe(true);
    expect(isKnownModel("gpt-4-turbo")).toBe(false);
    expect(isKnownModel(undefined)).toBe(false);
  });

  describe("OPENAI_DEFAULT_MODEL", () => {
    const original = process.env.OPENAI_DEFAULT_MODEL;
    afterEach(() => {
      process.env.OPENAI_DEFAULT_MODEL = original;
    });

    function loadDefault(): string {
      let model = "";
      jest.isolateModules(() => {
        model = require("@/lib/openai/models").Models.default;
      });
      return model;
    }

    it("switches the default to a registered model", () => {
      process.env.OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
      expect(loadDefault()).toBe("gpt-4o-mini");
    });

    it("ignores an unknown model instead of breaking every call", () => {
      process.env.OPENAI_DEFAULT_MODEL = "gpt-4o-mini-typo";
      expect(loadDefault()).toBe("gpt-6-luna");
    });
  });
});

describe("calculateCost", () => {
  it("prices gpt-6-luna at $0.10 in / $0.50 out per 1M tokens", () => {
    const cost = calculateCost("gpt-6-luna", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost.inputCostUsd).toBeCloseTo(0.1);
    expect(cost.outputCostUsd).toBeCloseTo(0.5);
    expect(cost.totalCostUsd).toBeCloseTo(0.6);
  });

  it("bills cached input at the cached rate", () => {
    const cost = calculateCost("gpt-6-luna", {
      inputTokens: 1_000_000,
      cachedInputTokens: 500_000,
      outputTokens: 0,
    });
    // 500K uncached at $0.10/M + 500K cached at $0.01/M
    expect(cost.inputCostUsd).toBeCloseTo(0.055);
  });

  it("bills cached input at the full rate where no cached price is published", () => {
    const cost = calculateCost("gpt-6.1-terra", { inputTokens: 1_000_000, cachedInputTokens: 1_000_000 });
    expect(cost.inputCostUsd).toBeCloseTo(1);
  });

  it("treats missing usage as zero", () => {
    expect(calculateCost("gpt-6-luna", {}).totalCostUsd).toBe(0);
  });
});

describe("buildChatCompletionParams", () => {
  it("sends GPT-6 models max_completion_tokens and effort none, without temperature", () => {
    const params = buildChatCompletionParams("gpt-6-luna", MESSAGES, {
      maxTokens: 500,
      temperature: 0.7,
    });
    expect(params).toEqual({
      model: "gpt-6-luna",
      messages: MESSAGES,
      max_completion_tokens: 500,
      reasoning_effort: "none",
    });
    expect(params).not.toHaveProperty("max_tokens");
  });

  it("uses low effort for gpt-6.1-sol, which has no none effort", () => {
    const params = buildChatCompletionParams("gpt-6.1-sol", MESSAGES, { maxTokens: 10 });
    expect(params.reasoning_effort).toBe("low");
  });

  it("keeps temperature and omits reasoning effort for gpt-4o-mini", () => {
    const params = buildChatCompletionParams("gpt-4o-mini", MESSAGES, {
      maxTokens: 10,
      temperature: 0,
    });
    expect(params.temperature).toBe(0);
    expect(params).not.toHaveProperty("reasoning_effort");
  });

  it("passes JSON mode through", () => {
    const params = buildChatCompletionParams("gpt-6-luna", MESSAGES, {
      maxTokens: 10,
      responseFormat: "json_object",
    });
    expect(params.response_format).toEqual({ type: "json_object" });
  });
});

describe("buildAiSdkProviderOptions", () => {
  it("pins the reasoning effort for GPT-6 models", () => {
    expect(buildAiSdkProviderOptions("gpt-6-luna")).toEqual({ openai: { reasoningEffort: "none" } });
  });

  it("returns nothing for non-reasoning models", () => {
    expect(buildAiSdkProviderOptions("gpt-4o-mini")).toBeUndefined();
  });
});
