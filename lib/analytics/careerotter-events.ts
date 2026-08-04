/**
 * CareerOtter Phase 2 analytics — client-side track helpers for the evidence
 * loop. Server-fired events (win_logged from the API, ztc_completed, recap
 * generation) use the raw names from careerotter-event-names.ts directly and
 * intentionally have no client helper here, so a capture-bar submission can't
 * emit a duplicate, indistinguishable copy of the server-authoritative event.
 */

import { capturePostHogEvent } from "./posthog";
import { CAREEROTTER_EVENT_NAMES } from "./careerotter-event-names";

export const CAREEROTTER_EVENTS = CAREEROTTER_EVENT_NAMES;

/** Zero to Case onboarding started (first question shown). */
export function trackZeroToCaseStarted(props: { mode?: string } = {}) {
  capturePostHogEvent(CAREEROTTER_EVENTS.ZTC_STARTED, props);
}

/** The user opened their weekly recap (in-app or from the email link). */
export function trackRecapOpened(props: { week_start?: string } = {}) {
  capturePostHogEvent(CAREEROTTER_EVENTS.RECAP_OPENED, props);
}
