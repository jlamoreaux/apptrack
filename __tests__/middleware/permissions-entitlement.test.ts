/**
 * Tests for PermissionMiddleware.getUserPlanInfo entitlement gating.
 *
 * The `isActive` field is derived from the subscription status via the shared
 * `isEntitledStatus` predicate (SSOT). This proves the refactor preserves
 * behavior: a `trialing` user is granted access the same as `active`, while a
 * `canceled` user (or no subscription) is denied.
 *
 * We mock at `@/lib/supabase/queries` (`getSubscription`) — the cleanest
 * boundary, matching repo convention (see __tests__/api/resume-management).
 */

jest.mock("@/lib/supabase/queries", () => ({
  getSubscription: jest.fn(),
}));

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { getSubscription } from "@/lib/supabase/queries";
import { PLAN_NAMES } from "@/lib/constants/plans";

const mockGetSubscription = getSubscription as jest.MockedFunction<
  typeof getSubscription
>;

const USER_ID = "user-123";

function aiCoachSubscription(status: string) {
  return {
    status,
    subscription_plans: { name: PLAN_NAMES.AI_COACH },
  } as never;
}

describe("PermissionMiddleware.getUserPlanInfo entitlement gating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("grants access for an active subscription", async () => {
    mockGetSubscription.mockResolvedValue(aiCoachSubscription("active"));

    const info = await PermissionMiddleware.getUserPlanInfo(USER_ID);

    expect(info.isActive).toBe(true);
    expect(info.isAICoach).toBe(true);
    expect(info.plan).toBe(PLAN_NAMES.AI_COACH);
  });

  it("grants access for a trialing subscription, same as active", async () => {
    mockGetSubscription.mockResolvedValue(aiCoachSubscription("trialing"));

    const info = await PermissionMiddleware.getUserPlanInfo(USER_ID);

    expect(info.isActive).toBe(true);
    expect(info.isAICoach).toBe(true);
  });

  it("denies access for a canceled subscription", async () => {
    mockGetSubscription.mockResolvedValue(aiCoachSubscription("canceled"));

    const info = await PermissionMiddleware.getUserPlanInfo(USER_ID);

    expect(info.isActive).toBe(false);
  });

  it("denies access for a past_due subscription", async () => {
    mockGetSubscription.mockResolvedValue(aiCoachSubscription("past_due"));

    const info = await PermissionMiddleware.getUserPlanInfo(USER_ID);

    expect(info.isActive).toBe(false);
  });

  it("denies access (Free) when there is no subscription", async () => {
    mockGetSubscription.mockResolvedValue(null);

    const info = await PermissionMiddleware.getUserPlanInfo(USER_ID);

    expect(info.isActive).toBe(false);
    expect(info.plan).toBe(PLAN_NAMES.FREE);
    expect(info.isFree).toBe(true);
  });
});
