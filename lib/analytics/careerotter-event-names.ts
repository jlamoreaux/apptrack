/**
 * Raw CareerOtter Phase 2 event-name strings.
 *
 * Framework-agnostic (no "use client", no imports) so both the client hook
 * module (careerotter-events.ts) and server routes (zero-to-case, recap cron)
 * share one source of truth. All events use `filterTestAccounts: true` at query
 * time (PRD §5). PostHog project 55190.
 */
export const CAREEROTTER_EVENT_NAMES = {
  // Onboarding (Zero to Case)
  ZTC_STARTED: "ztc_started",
  ZTC_COMPLETED: "ztc_completed",
  // The evidence loop
  WIN_LOGGED: "win_logged",
  RECAP_OPENED: "recap_opened",
  // Later milestones
  COACH_MESSAGE_SENT: "coach_message_sent",
  CASE_EXPORTED: "case_exported",
  COMP_ENTERED: "comp_entered",
} as const;

export type CareerotterEventName =
  (typeof CAREEROTTER_EVENT_NAMES)[keyof typeof CAREEROTTER_EVENT_NAMES];
