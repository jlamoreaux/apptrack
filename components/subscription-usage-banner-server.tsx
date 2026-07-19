// Application tracking is unlimited on every tier now — the paywall is AI, not
// count (CareerOtter D2). There is no tracking limit to warn about, so this
// banner renders nothing. Kept as a no-op export so the dashboard import stays
// stable; the Free-tier upgrade nudge moves to the AI "preview of Pro" surface
// (M2).
export async function SubscriptionUsageBannerServer(_props: {
  userId: string;
}) {
  return null;
}
