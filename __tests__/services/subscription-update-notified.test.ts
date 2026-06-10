/**
 * Tests that SubscriptionService.updateFromStripeWebhook forwards the
 * trial_ending_notified_at idempotency stamp through to the Supabase
 * `.update(...)` call.
 *
 * The DAL query under test is:
 *   from("user_subscriptions")
 *     .update(data)
 *     .eq("stripe_subscription_id", ...)
 *     .select()
 *     .single()
 *
 * A chainable Supabase client stub is injected into the service constructor and
 * records the object passed to `.update(...)` so the test can assert the field
 * is plumbed through without any mapping.
 */

import { SubscriptionService } from "@/services/subscriptions";

function buildSupabaseMock(updatedRow: unknown) {
  const updateArgs: unknown[] = [];

  const single = jest.fn().mockResolvedValue({ data: updatedRow, error: null });
  const select = jest.fn().mockReturnValue({ single });
  const eq = jest.fn().mockReturnValue({ select });
  const update = jest.fn().mockImplementation((data: unknown) => {
    updateArgs.push(data);
    return { eq };
  });
  const from = jest.fn().mockReturnValue({ update });

  return { supabase: { from }, updateArgs, update, eq };
}

const STRIPE_SUB_ID = "sub_stripe_123";

describe("SubscriptionService.updateFromStripeWebhook trial_ending_notified_at", () => {
  it("forwards trial_ending_notified_at to the Supabase update", async () => {
    const notifiedAt = "2026-05-29T12:00:00.000Z";
    const { supabase, updateArgs, eq } = buildSupabaseMock({
      id: "sub-1",
      stripe_subscription_id: STRIPE_SUB_ID,
      trial_ending_notified_at: notifiedAt,
    });

    const service = new SubscriptionService(supabase as never);

    const result = await service.updateFromStripeWebhook(STRIPE_SUB_ID, {
      trial_ending_notified_at: notifiedAt,
    });

    expect(updateArgs[0]).toEqual({ trial_ending_notified_at: notifiedAt });
    expect(eq).toHaveBeenCalledWith("stripe_subscription_id", STRIPE_SUB_ID);
    expect(result?.trial_ending_notified_at).toBe(notifiedAt);
  });
});
