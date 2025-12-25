/**
 * PostHog analytics helper using dynamic import
 * Use this instead of window.posthog for reliable event capture
 */

/**
 * Capture a PostHog event using dynamic import
 * This pattern ensures PostHog is loaded before capturing
 */
export function capturePostHogEvent(
  eventName: string,
  properties?: Record<string, unknown>
) {
  if (typeof window !== "undefined") {
    import("posthog-js").then(({ default: posthog }) => {
      posthog.capture(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
      });
    });
  }
}
