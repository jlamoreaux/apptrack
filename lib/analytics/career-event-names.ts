/**
 * Raw Career Companion event-name strings.
 *
 * Framework-agnostic (no "use client", no imports) so both the client hook
 * module (career-events.ts) and server routes (validation email, waitlist API)
 * can share one source of truth instead of duplicating the literals.
 */
export const CAREER_EVENT_NAMES = {
  WAITLIST_VIEWED: "career_waitlist_viewed",
  EMAIL_CLICKED: "career_email_clicked",
  BANNER_CLICKED: "career_banner_clicked",
  BANNER_DISMISSED: "career_banner_dismissed",
  // Server-fired only:
  EMAIL_SENT: "career_email_sent",
  WAITLIST_JOINED: "career_waitlist_joined",
} as const;
