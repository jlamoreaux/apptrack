// Server-side analytics service.
//
// Previously this forwarded to `@vercel/analytics/server`, which does not exist off
// Vercel and silently degraded to a console.log. It now forwards to PostHog, which is
// where these events were always meant to land — note that `safeTrack` in lib/analytics.ts
// documents its second call as "Track to PostHog via API route", but that route
// (/api/analytics/track) reached only Vercel. Repointing it here closes that gap.
import { captureServerEvent } from "@/lib/analytics/posthog-server";

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  userId?: string;
}

/**
 * PostHog requires a distinct id. Server-side events are frequently anonymous — an
 * unauthenticated /api/analytics/track call, or a roast generated before signup — so
 * they are attributed to a stable synthetic id rather than dropped. PostHog treats this
 * as one "person"; filter it out when analysing per-user behaviour.
 */
const ANONYMOUS_DISTINCT_ID = "server:anonymous";

export class ServerAnalyticsService {
  /**
   * Track an event server-side. Never throws: analytics must not break a request.
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    // Callers pass identity two ways: an explicit `userId` (roast route) or a `user_id`
    // folded into properties by /api/analytics/track. Accept both.
    const distinctId =
      event.userId ??
      (typeof event.properties?.user_id === "string"
        ? event.properties.user_id
        : undefined) ??
      ANONYMOUS_DISTINCT_ID;

    await captureServerEvent(distinctId, event.name, event.properties ?? {});
  }
}

export const serverAnalyticsService = new ServerAnalyticsService();
