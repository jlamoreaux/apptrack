/**
 * callOpenAI: request shape, PostHog $ai_generation tracking, and error mapping.
 */
const mockCreate = jest.fn();

jest.mock("openai", () => {
  const actual = jest.requireActual("openai");
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  Object.assign(MockOpenAI, { APIError: actual.APIError });
  return { __esModule: true, default: MockOpenAI };
});
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEventAfterResponse: jest.fn(),
  isServerTelemetryEnabled: jest.fn(() => true),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import OpenAI from "openai";
import { callOpenAI } from "@/lib/openai/client";
import {
  captureServerEventAfterResponse,
  isServerTelemetryEnabled,
} from "@/lib/analytics/posthog-server";

const mockCapture = captureServerEventAfterResponse as jest.Mock;
const { APIError } = jest.requireActual("openai");

function completion(content: string | null, finishReason = "stop") {
  return {
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 200,
      total_tokens: 1200,
      prompt_tokens_details: { cached_tokens: 400 },
      completion_tokens_details: { reasoning_tokens: 0 },
    },
  };
}

function trackedProperties() {
  expect(mockCapture).toHaveBeenCalledTimes(1);
  const [distinctId, event, properties] = mockCapture.mock.calls[0];
  expect(event).toBe("$ai_generation");
  return { distinctId, properties };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
});

describe("callOpenAI", () => {
  it("sends GPT-6 parameters and returns the content", async () => {
    mockCreate.mockResolvedValue(completion("hello"));

    const text = await callOpenAI({
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "sys",
      maxTokens: 300,
      temperature: 0.4,
      tracking: { feature: "careerotter_coach", distinctId: "user-1" },
    });

    expect(text).toBe("hello");
    const params = mockCreate.mock.calls[0][0];
    expect(params).toMatchObject({
      model: "gpt-6-luna",
      max_completion_tokens: 300,
      reasoning_effort: "none",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
    });
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("max_tokens");
  });

  it("records tokens, cost, and feature without prompt or completion text", async () => {
    mockCreate.mockResolvedValue(completion("hello"));

    await callOpenAI({
      messages: [{ role: "user", content: "my resume" }],
      tracking: { feature: "careerotter_coach", distinctId: "user-1" },
    });

    const { distinctId, properties } = trackedProperties();
    expect(distinctId).toBe("user-1");
    expect(properties).toMatchObject({
      $ai_provider: "openai",
      $ai_model: "gpt-6-luna",
      $ai_span_name: "careerotter_coach",
      $ai_input_tokens: 1000,
      $ai_output_tokens: 200,
      $ai_cache_read_input_tokens: 400,
      $ai_is_error: false,
      finish_reason: "stop",
    });
    // 600 uncached at $0.10/M + 400 cached at $0.01/M + 200 out at $0.50/M
    expect(properties.$ai_total_cost_usd).toBeCloseTo(0.00006 + 0.000004 + 0.0001, 9);
    expect(JSON.stringify(properties)).not.toContain("my resume");
    expect(JSON.stringify(properties)).not.toContain("hello");
  });

  it("attributes untracked system calls to a server distinct id", async () => {
    mockCreate.mockResolvedValue(completion("ok"));
    await callOpenAI({ messages: [{ role: "user", content: "x" }] });
    const { distinctId, properties } = trackedProperties();
    expect(distinctId).toBe("apptrack-server");
    expect(properties.$ai_span_name).toBe("unspecified");
  });

  it("maps a 429 to the rate-limit error and records the failure", async () => {
    mockCreate.mockRejectedValue(
      APIError.generate(429, { message: "slow down", code: "rate_limit_exceeded" }, "slow down", new Headers())
    );

    await expect(
      callOpenAI({ messages: [{ role: "user", content: "x" }], tracking: { feature: "changelog" } })
    ).rejects.toThrow("Rate limit exceeded. Please try again later.");

    const { properties } = trackedProperties();
    expect(properties).toMatchObject({ $ai_is_error: true, $ai_http_status: 429 });
  });

  it("does not misreport a parameter error as an invalid model", async () => {
    mockCreate.mockRejectedValue(
      APIError.generate(
        400,
        { message: "Unsupported parameter: 'temperature' is not supported with this model.", param: "temperature" },
        "Unsupported parameter: 'temperature' is not supported with this model.",
        new Headers()
      )
    );

    await expect(callOpenAI({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(
      /^AI service error: .*temperature/
    );
  });

  it("explains an empty response cut off by the token limit", async () => {
    mockCreate.mockResolvedValue(completion(null, "length"));

    await expect(callOpenAI({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(
      "finish_reason: length"
    );
    expect(trackedProperties().properties.$ai_is_error).toBe(true);
  });

  it("sends no telemetry outside production", async () => {
    (isServerTelemetryEnabled as jest.Mock).mockReturnValueOnce(false);
    mockCreate.mockResolvedValue(completion("ok"));
    await callOpenAI({ messages: [{ role: "user", content: "x" }] });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("uses one client across calls", async () => {
    mockCreate.mockResolvedValue(completion("ok"));
    await callOpenAI({ messages: [{ role: "user", content: "x" }] });
    await callOpenAI({ messages: [{ role: "user", content: "y" }] });
    expect((OpenAI as unknown as jest.Mock).mock.calls.length).toBeLessThanOrEqual(1);
  });
});
