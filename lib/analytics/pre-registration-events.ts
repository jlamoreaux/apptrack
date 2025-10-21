/**
 * Pre-Registration Analytics Events
 * PostHog event tracking for try-before-signup conversion funnel
 */

export type PreRegFeatureType = "job_fit" | "cover_letter" | "interview_prep" | "resume_analysis";

interface BaseEventProps {
  feature_type: PreRegFeatureType;
  session_id?: string;
}

interface PreviewStartedProps extends BaseEventProps {
  entry_point?: string; // homepage, landing page, direct
}

interface PreviewCompletedProps extends BaseEventProps {
  generation_time_ms?: number;
  input_length?: number;
}

interface SignupClickedProps extends BaseEventProps {
  cta_location: "preview_card" | "unlock_overlay" | "header";
}

interface PreviewUnlockedProps extends BaseEventProps {
  user_id: string;
  time_to_signup_ms?: number;
}

interface RateLimitReachedProps {
  feature_type: PreRegFeatureType;
  had_previous_session: boolean;
}

/**
 * Track when user starts trying a pre-registration feature
 */
export function trackPreviewStarted(props: PreviewStartedProps) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture("prereg_preview_started", {
      ...props,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Track when preview generation completes successfully
 */
export function trackPreviewCompleted(props: PreviewCompletedProps) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture("prereg_preview_completed", {
      ...props,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Track when user clicks signup CTA from preview
 */
export function trackSignupClicked(props: SignupClickedProps) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture("prereg_signup_clicked", {
      ...props,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Track when user successfully unlocks full content after signup
 */
export function trackPreviewUnlocked(props: PreviewUnlockedProps) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture("prereg_preview_unlocked", {
      ...props,
      timestamp: new Date().toISOString(),
    });

    // Also track as conversion event
    window.posthog.capture("prereg_conversion", {
      feature_type: props.feature_type,
      user_id: props.user_id,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Track when user hits rate limit
 */
export function trackRateLimitReached(props: RateLimitReachedProps) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture("prereg_rate_limit_reached", {
      ...props,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Track when user generates AI content using free tier (authenticated)
 */
export function trackFreeTierUsed(featureType: PreRegFeatureType, remainingTries: number) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture("free_tier_used", {
      feature_type: featureType,
      remaining_tries: remainingTries,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Track when authenticated user exhausts free tier
 */
export function trackFreeTierExhausted(featureType: PreRegFeatureType) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture("free_tier_exhausted", {
      feature_type: featureType,
      timestamp: new Date().toISOString(),
    });

    // Track as potential upgrade opportunity
    window.posthog.capture("upgrade_opportunity", {
      trigger: "free_tier_exhausted",
      feature_type: featureType,
      timestamp: new Date().toISOString(),
    });
  }
}
