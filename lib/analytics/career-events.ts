/**
 * Career Companion Analytics Events
 * PostHog tracking for the Career Companion Phase 0 validation funnel
 */

import { capturePostHogEvent } from "./posthog";
import { getStoredUTMParams } from "@/lib/hooks/use-utm-tracking";

/**
 * Central registry of Career Companion event names.
 * `EMAIL_SENT` and `WAITLIST_JOINED` are fired server-side (validation email
 * route and waitlist API respectively) — listed here so the full funnel has a
 * single source of truth, but they have no client track functions.
 */
export const CAREER_EVENTS = {
  WAITLIST_VIEWED: "career_waitlist_viewed",
  EMAIL_CLICKED: "career_email_clicked",
  BANNER_CLICKED: "career_banner_clicked",
  BANNER_DISMISSED: "career_banner_dismissed",
  // Server-fired only:
  EMAIL_SENT: "career_email_sent",
  WAITLIST_JOINED: "career_waitlist_joined",
} as const;

/** Session-scoped de-dupe marker for career_email_clicked */
const EMAIL_CLICKED_SESSION_KEY = "apptrack_career_email_clicked";

export interface CareerWaitlistViewedProps {
  /** How the visitor reached /career (e.g. 'email', 'banner', 'direct') */
  source: string;
}

function captureCareerEvent(
  eventName: string,
  props: Record<string, unknown> = {}
) {
  capturePostHogEvent(eventName, {
    ...props,
    ...getStoredUTMParams(),
  });
}

/** Fires when the /career landing page mounts */
export function trackCareerWaitlistViewed(props: CareerWaitlistViewedProps) {
  captureCareerEvent(CAREER_EVENTS.WAITLIST_VIEWED, { source: props.source });
}

/**
 * Fires when the visitor landed on /career from the validation email
 * (utm_campaign match). Honest definition: "landed from the email" — Resend
 * click-tracking is not enabled, so this is the closest client-side proxy.
 * De-duped to at most once per browser session via sessionStorage.
 */
export function trackCareerEmailClicked() {
  if (typeof window === "undefined") return;

  try {
    if (sessionStorage.getItem(EMAIL_CLICKED_SESSION_KEY)) return;
    sessionStorage.setItem(EMAIL_CLICKED_SESSION_KEY, "1");
  } catch {
    // sessionStorage unavailable (private mode / storage disabled): fire
    // anyway — a possible duplicate beats losing the signal entirely.
  }

  captureCareerEvent(CAREER_EVENTS.EMAIL_CLICKED);
}

/** Fires when the user clicks the dashboard waitlist banner CTA */
export function trackCareerBannerClicked() {
  captureCareerEvent(CAREER_EVENTS.BANNER_CLICKED);
}

/** Fires when the user dismisses the dashboard waitlist banner */
export function trackCareerBannerDismissed() {
  captureCareerEvent(CAREER_EVENTS.BANNER_DISMISSED);
}
