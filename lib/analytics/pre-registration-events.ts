/**
 * Pre-Registration Analytics Events
 * PostHog event tracking for try-before-signup conversion funnel
 */

import { capturePostHogEvent } from "./posthog";
import { getStoredUTMParams } from "@/lib/hooks/use-utm-tracking";

export type PreRegFeatureType = "job_fit" | "cover_letter" | "interview_prep" | "resume_analysis";

interface BaseEventProps {
  feature_type: PreRegFeatureType;
  session_id?: string;
}

/**
 * Capture event with UTM params included
 */
function capturePreRegEvent(eventName: string, props: Record<string, unknown>) {
  capturePostHogEvent(eventName, {
    ...props,
    ...getStoredUTMParams(),
  });
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
  capturePreRegEvent("prereg_preview_started", props);
}

/**
 * Track when preview generation completes successfully
 */
export function trackPreviewCompleted(props: PreviewCompletedProps) {
  capturePreRegEvent("prereg_preview_completed", props);
}

/**
 * Track when user clicks signup CTA from preview
 */
export function trackSignupClicked(props: SignupClickedProps) {
  capturePreRegEvent("prereg_signup_clicked", props);
}

/**
 * Track when user successfully unlocks full content after signup
 */
export function trackPreviewUnlocked(props: PreviewUnlockedProps) {
  capturePreRegEvent("prereg_preview_unlocked", props);
  capturePreRegEvent("prereg_conversion", {
    feature_type: props.feature_type,
    user_id: props.user_id,
  });
}

/**
 * Track when user hits rate limit
 */
export function trackRateLimitReached(props: RateLimitReachedProps) {
  capturePreRegEvent("prereg_rate_limit_reached", props);
}

/**
 * Track when user generates AI content using free tier (authenticated)
 */
export function trackFreeTierUsed(featureType: PreRegFeatureType, remainingTries: number) {
  capturePreRegEvent("free_tier_used", {
    feature_type: featureType,
    remaining_tries: remainingTries,
  });
}

/**
 * Track when authenticated user exhausts free tier
 */
export function trackFreeTierExhausted(featureType: PreRegFeatureType) {
  capturePreRegEvent("free_tier_exhausted", { feature_type: featureType });
  capturePreRegEvent("upgrade_opportunity", {
    trigger: "free_tier_exhausted",
    feature_type: featureType,
  });
}
