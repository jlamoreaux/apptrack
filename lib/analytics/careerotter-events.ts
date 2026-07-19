/**
 * CareerOtter Phase 2 analytics — client-side track helpers for the evidence
 * loop. Server-fired events (win_logged from the API, ztc_completed, recap
 * generation) use the raw names from careerotter-event-names.ts directly.
 */

import { capturePostHogEvent } from "./posthog";
import { CAREEROTTER_EVENT_NAMES } from "./careerotter-event-names";

export const CAREEROTTER_EVENTS = CAREEROTTER_EVENT_NAMES;

/** Zero to Case onboarding started (first question shown). */
export function trackZeroToCaseStarted(props: { mode?: string } = {}) {
  capturePostHogEvent(CAREEROTTER_EVENTS.ZTC_STARTED, props);
}

/** A win was logged from the capture bar. Server also records this authoritatively. */
export function trackWinLogged(props: { tag?: string; source?: string } = {}) {
  capturePostHogEvent(CAREEROTTER_EVENTS.WIN_LOGGED, props);
}

/** The user opened their weekly recap (in-app or from the email link). */
export function trackRecapOpened(props: { week_start?: string } = {}) {
  capturePostHogEvent(CAREEROTTER_EVENTS.RECAP_OPENED, props);
}
