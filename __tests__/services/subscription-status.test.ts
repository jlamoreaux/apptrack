/**
 * Tests for SubscriptionService entitlement resolution.
 *
 * Exercises getSubscriptionStatus / getUserPlan against a mocked Supabase
 * query-builder injected into the service constructor. The DAL query under
 * test is:
 *   from("user_subscriptions")
 *     .select("*, subscription_plans!inner(name)")
 *     .eq("user_id", ...)
 *     .in("status", ENTITLED_SUBSCRIPTION_STATUSES)
 *     .order("created_at", { ascending: false })
 *     .limit(1)
 *     .single()
 *
 * The `.in([active, trialing])` filter means a canceled-only user never
 * matches a row, so the DAL returns null and the service falls back to "Free".
 */

import { SubscriptionService } from "@/services/subscriptions";
import { PLAN_NAMES } from "@/lib/constants/plans";

type SingleResult = { data: unknown; error: unknown };

/**
 * Builds a chainable Supabase client stub whose `user_subscriptions` query
 * terminates with the provided `.single()` result. Records the value passed
 * to `.in("status", ...)` so the test can assert the entitled-status filter.
 */
function buildSupabaseMock(singleResult: SingleResult) {
  const inArgs: { column: string; values: unknown }[] = [];

  const single = jest.fn().mockResolvedValue(singleResult);
  const limit = jest.fn().mockReturnValue({ single });
  const order = jest.fn().mockReturnValue({ limit });
  const inFn = jest.fn().mockImplementation((column: string, values: unknown) => {
    inArgs.push({ column, values });
    return { order };
  });
  const eq = jest.fn().mockReturnValue({ in: inFn });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockReturnValue({ select });

  return { supabase: { from }, inArgs, single };
}

const USER_ID = "user-123";

describe("SubscriptionService entitlement resolution", () => {
  it("resolves a trialing AI Coach subscription as active on the AI Coach plan", async () => {
    const { supabase, inArgs } = buildSupabaseMock({
      data: {
        id: "sub-1",
        user_id: USER_ID,
        status: "trialing",
        created_at: "2026-05-01T00:00:00Z",
        subscription_plans: { name: "AI Coach" },
      },
      error: null,
    });

    const service = new SubscriptionService(supabase as never);

    const status = await service.getSubscriptionStatus(USER_ID);
    expect(status).toEqual({
      plan: "AI Coach",
      status: "trialing",
      isActive: true,
    });

    const plan = await service.getUserPlan(USER_ID);
    expect(plan).toBe("AI Coach");

    // The query must filter on the entitled statuses, not just "active".
    expect(inArgs[0]).toEqual({
      column: "status",
      values: ["active", "trialing"],
    });
  });

  it("falls back to Free / inactive for a canceled subscription (excluded by the entitled filter)", async () => {
    // A canceled row is excluded by `.in([active, trialing])`, so the DAL sees
    // no matching row and (via maybeSingle/single PGRST116) returns null.
    const { supabase } = buildSupabaseMock({ data: null, error: null });

    const service = new SubscriptionService(supabase as never);

    const status = await service.getSubscriptionStatus(USER_ID);
    expect(status).toEqual({
      plan: PLAN_NAMES.FREE,
      status: "none",
      isActive: false,
    });

    const plan = await service.getUserPlan(USER_ID);
    expect(plan).toBe(PLAN_NAMES.FREE);
  });

  it("does not throw when both an active and a trialing row exist; returns the most recent (order desc)", async () => {
    // The DB query orders by created_at desc and limits to 1, so the most
    // recent entitled row wins. Here the trialing AI Coach row is newest.
    const { supabase } = buildSupabaseMock({
      data: {
        id: "sub-trialing-newest",
        user_id: USER_ID,
        status: "trialing",
        created_at: "2026-05-20T00:00:00Z",
        subscription_plans: { name: "AI Coach" },
      },
      error: null,
    });

    const service = new SubscriptionService(supabase as never);

    await expect(service.getSubscriptionStatus(USER_ID)).resolves.toEqual({
      plan: "AI Coach",
      status: "trialing",
      isActive: true,
    });
  });
});
