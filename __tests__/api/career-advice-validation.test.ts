/**
 * Unit tests for the AI Coach career-advice message content validator.
 * Focuses on the redesigned diversity check and stable rejection reason codes.
 */

import {
  validateMessageContent,
  type MessageRejectionReason,
} from "@/app/api/ai-coach/career-advice/route";

// The route module pulls in heavy AI/Supabase deps at import time; stub them so the
// pure validator can be imported and unit-tested in isolation.
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/ai-coach");
jest.mock("@/lib/middleware/permissions");
jest.mock("@/lib/middleware/rate-limit.middleware", () => ({
  withRateLimit: async (handler: any, options: any) => handler(options.request),
  getUserSubscriptionTier: jest.fn().mockResolvedValue("pro"),
}));
jest.mock("@/lib/services/rate-limit.service", () => ({
  RateLimitService: { getInstance: jest.fn().mockReturnValue({}) },
}));
jest.mock("ai", () => ({
  streamText: jest.fn(),
  generateText: jest.fn(),
  tool: jest.fn().mockImplementation((config: any) => config),
  stepCountIs: jest.fn().mockReturnValue(true),
}));
jest.mock("@ai-sdk/openai", () => ({ openai: jest.fn().mockReturnValue("mock-model") }));
jest.mock("@/services/resumes", () => ({ ResumeService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("@/dal/applications", () => ({ ApplicationDAL: jest.fn().mockImplementation(() => ({})) }));
jest.mock("@/lib/analytics/posthog-server", () => ({ captureServerEvent: jest.fn() }));

describe("validateMessageContent", () => {
  describe("valid messages", () => {
    const validMessages: Array<[string, string]> = [
      [
        "worked example",
        "I have 5 years in marketing and want to move into product management — what should I focus on?",
      ],
      ["normal ~300-char paragraph", buildParagraph()],
      ["three distinct repeated words", "ok ok ok ok ok ok ok ok"],
      [
        "pasted job description with separators",
        "Responsibilities include the following key areas:\n------------------------\nBuild scalable services and own delivery end to end.\n........................\nCollaborate with product and design partners daily.",
      ],
      [
        "short code snippet",
        "function add(a, b) {\n  return a + b;\n}\nconsole.log(add(2, 3));",
      ],
      [
        "emoji/CJM content over 30 chars",
        "Here is my plan for the week 🚀🎯 私は仕事を探しています 頑張ります today",
      ],
    ];

    it.each(validMessages)("accepts %s", (_label, message) => {
      const result = validateMessageContent(message);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe("rejected messages", () => {
    const rejectedMessages: Array<[string, string, MessageRejectionReason]> = [
      ["single repeated char over floor", "a".repeat(40), "low_diversity"],
      ["two distinct chars repeated", "ab".repeat(30), "low_diversity"],
      ["empty string", "", "too_short"],
      ["below min length", "hi", "too_short"],
      ["over max length", "a".repeat(10001), "too_long"],
    ];

    it.each(rejectedMessages)("rejects %s with reason %s", (_label, message, expectedReason) => {
      const result = validateMessageContent(message);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe(expectedReason);
      expect(result.error).toBeTruthy();
    });
  });

  it("does not flag a >30-char message with exactly 3 distinct characters", () => {
    // "abc" repeated stays at 3 distinct chars (the MIN_DISTINCT_CHARS floor).
    const result = validateMessageContent("abc".repeat(20));
    expect(result.valid).toBe(true);
  });

  describe("diversity floor boundary (DIVERSITY_MIN_LENGTH=30, MIN_DISTINCT_CHARS=3)", () => {
    it("accepts a low-diversity message at exactly the length floor (30 chars)", () => {
      // length must be strictly greater than 30 to be checked, so 30 passes.
      expect(validateMessageContent("a".repeat(30)).valid).toBe(true);
    });

    it("rejects a 2-distinct message just over the length floor (31 chars)", () => {
      const result = validateMessageContent("ab".repeat(16)); // 32 chars, 2 distinct
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("low_diversity");
    });

    it("counts code points, so a varied multi-script message passes", () => {
      expect(validateMessageContent("Plan: 私は仕事 🚀 ready to grow my career now").valid).toBe(true);
    });

    it("rejects a long single repeated CJK glyph (intended anti-spam behavior)", () => {
      // 2-distinct repeated CJK over the floor is treated as degenerate input;
      // this is the one accepted false-positive class (auth + rate limits are the real controls).
      expect(validateMessageContent("好".repeat(40)).reason).toBe("low_diversity");
    });
  });
});

// Builds a realistic ~300-character paragraph of ordinary prose.
function buildParagraph(): string {
  const sentence =
    "Career transitions take time, so focus on transferable skills and build a clear narrative. ";
  let text = "";
  while (text.length < 300) {
    text += sentence;
  }
  return text.slice(0, 300);
}
