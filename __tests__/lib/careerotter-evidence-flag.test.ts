/**
 * The careerotter_evidence flag is the single switch that will gate every
 * net-new surface. This locks two invariants: the canonical key string, and
 * default-OFF on both the client hook and the server helper when PostHog is
 * unavailable — so a missing/erroring flag can never expose half-built surfaces.
 */

jest.mock("posthog-js/react", () => ({
  usePostHog: jest.fn(() => null),
}));

import { renderHook } from "@testing-library/react";
import { FEATURE_FLAGS, useFeatureFlag } from "@/lib/hooks/use-feature-flag";
import { getServerFeatureFlag } from "@/lib/analytics/posthog-server";

describe("careerotter_evidence flag", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses the canonical hyphenated PostHog key", () => {
    expect(FEATURE_FLAGS.CAREEROTTER_EVIDENCE).toBe("careerotter-evidence");
  });

  it("client hook returns false when PostHog is unavailable", () => {
    const { result } = renderHook(() => useFeatureFlag(FEATURE_FLAGS.CAREEROTTER_EVIDENCE));
    expect(result.current).toBe(false);
  });

  it("server helper returns false when PostHog is not configured", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_FF_CAREEROTTER_EVIDENCE;
    await expect(
      getServerFeatureFlag("user-123", FEATURE_FLAGS.CAREEROTTER_EVIDENCE)
    ).resolves.toBe(false);
  });

  it("server helper honors an explicit env override of false", async () => {
    process.env.NEXT_PUBLIC_FF_CAREEROTTER_EVIDENCE = "false";
    await expect(
      getServerFeatureFlag("user-123", FEATURE_FLAGS.CAREEROTTER_EVIDENCE)
    ).resolves.toBe(false);
  });
});
