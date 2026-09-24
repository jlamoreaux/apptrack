/**
 * Regression tests for AIFeatureUsageService tier resolution.
 *
 * Background: `checkAllowance` used to read `users.subscription_tier`. The table
 * `public.users` does not exist in production, so that query ALWAYS errored and fell
 * into a fail-open branch returning `allowedCount: 999` — i.e. unlimited AI for every
 * caller. These tests pin the corrected behaviour.
 *
 * Two production facts these tests encode:
 *   1. A user with no `user_subscriptions` row is the NORMAL case, not an error.
 *      `handle_new_user_subscription()` is wired to no trigger, so 187 of 221 users
 *      have no row at all. Absent row => free tier.
 *   2. A genuine lookup failure must fail CLOSED, so a database outage cannot be used
 *      to mint unlimited AI calls.
 *
 * This mocks the DAL rather than the Supabase query-builder chain: the assertion is
 * about behaviour, not about how the query happens to be constructed. That keeps the
 * test valid when the data layer moves to Drizzle.
 */

import { AIFeatureUsageService } from "@/lib/services/ai-feature-usage.service";
import { PLAN_NAMES } from "@/lib/constants/plans";

const mockGetSubscriptionWithPlanName = jest.fn();

jest.mock("@/dal/subscriptions", () => ({
  SubscriptionDAL: jest.fn().mockImplementation(() => ({
    getSubscriptionWithPlanName: mockGetSubscriptionWithPlanName,
  })),
}));

// checkAllowance still reads ai_feature_usage directly; stub the client so the
// tier-resolution path can be exercised in isolation.
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

describe("AIFeatureUsageService.getSubscriptionTier", () => {
  beforeEach(() => {
    mockGetSubscriptionWithPlanName.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves ai_coach for an entitled AI Coach subscription", async () => {
    mockGetSubscriptionWithPlanName.mockResolvedValue({
      plan_name: PLAN_NAMES.AI_COACH,
    });

    await expect(AIFeatureUsageService.getSubscriptionTier("u1")).resolves.toBe(
      "ai_coach"
    );
  });

  it("resolves pro for a grandfathered Pro subscription", async () => {
    mockGetSubscriptionWithPlanName.mockResolvedValue({
      plan_name: PLAN_NAMES.PRO,
    });

    await expect(AIFeatureUsageService.getSubscriptionTier("u1")).resolves.toBe(
      "pro"
    );
  });

  it("treats a missing subscription row as free, not as an error", async () => {
    // 187 of 221 production users are in exactly this state.
    mockGetSubscriptionWithPlanName.mockResolvedValue(null);

    await expect(AIFeatureUsageService.getSubscriptionTier("u1")).resolves.toBe(
      "free"
    );
  });

  it("returns null when the lookup genuinely fails, so callers can fail closed", async () => {
    mockGetSubscriptionWithPlanName.mockRejectedValue(new Error("connection reset"));

    await expect(
      AIFeatureUsageService.getSubscriptionTier("u1")
    ).resolves.toBeNull();
  });
});

describe("AIFeatureUsageService.checkAllowance", () => {
  beforeEach(() => {
    mockGetSubscriptionWithPlanName.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("grants unlimited use to AI Coach subscribers", async () => {
    mockGetSubscriptionWithPlanName.mockResolvedValue({
      plan_name: PLAN_NAMES.AI_COACH,
    });

    const allowance = await AIFeatureUsageService.checkAllowance(
      "u1",
      "resume_analysis"
    );

    expect(allowance.canUse).toBe(true);
    expect(allowance.requiresUpgrade).toBe(false);
  });

  it("gives a free-tier user a limited allowance, NOT 999", async () => {
    // The pre-fix bug returned allowedCount: 999 here for every user.
    mockGetSubscriptionWithPlanName.mockResolvedValue(null);

    const allowance = await AIFeatureUsageService.checkAllowance(
      "u1",
      "resume_analysis"
    );

    expect(allowance.allowedCount).toBe(1);
    expect(allowance.allowedCount).not.toBe(999);
  });

  it("fails closed on a genuine lookup failure", async () => {
    mockGetSubscriptionWithPlanName.mockRejectedValue(new Error("db down"));

    const allowance = await AIFeatureUsageService.checkAllowance(
      "u1",
      "resume_analysis"
    );

    expect(allowance.canUse).toBe(false);
    expect(allowance.allowedCount).toBe(0);
  });

  it("denies career_advice to free users regardless of usage", async () => {
    mockGetSubscriptionWithPlanName.mockResolvedValue(null);

    const allowance = await AIFeatureUsageService.checkAllowance(
      "u1",
      "career_advice"
    );

    expect(allowance.canUse).toBe(false);
    expect(allowance.requiresUpgrade).toBe(true);
  });
});
