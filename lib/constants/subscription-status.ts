// Single source of truth for subscription status values.
// ZERO-IMPORT leaf module: imported by client components (e.g. components/danger-zone.tsx),
// so it must not import anything (especially server-only modules).

// The statuses our Stripe webhook (mapStripeStatus) can actually persist.
// Note: "unpaid" is intentionally excluded — mapStripeStatus never emits it.
export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// Statuses where the user currently holds their plan entitlements.
export const ENTITLED_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
] as const satisfies readonly SubscriptionStatus[];

/**
 * Returns true iff the status grants plan entitlements — i.e. the user
 * currently has the plan (active subscription or in trial). Total: any
 * null/undefined/unknown value returns false.
 */
export function isEntitledStatus(status: string | null | undefined): boolean {
  return (ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
    status ?? ""
  );
}
