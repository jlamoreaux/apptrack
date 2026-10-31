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

/**
 * Send an exception to PostHog Error Tracking with its stack. Use in React error
 * boundaries: errors they catch never reach window.onerror, so exception autocapture
 * does not see them.
 */
export function capturePostHogException(
  error: unknown,
  properties?: Record<string, unknown>
) {
  if (typeof window !== "undefined") {
    import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.captureException(error, properties);
      })
      .catch(() => {
        // Analytics must never break the error UI
      });
  }
}
