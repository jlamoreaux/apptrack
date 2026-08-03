/**
 * Single source of truth for AppTrack -> CareerOtter rename messaging.
 *
 * Imported by the in-app transition banner (`components/rebrand-banner.tsx`)
 * and the rename-announcement email (`lib/email/templates/rebrand-announcement.ts`)
 * so the two user-facing surfaces can never drift. The roast 301 redirect copy
 * in `lib/rebrand-redirect.ts` should also import from here once M1 lands.
 */
export const REBRAND_COPY = {
  headline: "AppTrack is now CareerOtter",
  subhead: "Same account, same data, same login — only the name has changed.",
  whyLabel: "Why the new name?",
  /** Points at the (post-cutover, CareerOtter-branded) marketing home. */
  whyHref: "/",
} as const;

/**
 * `campaign_sends.campaign` marker id for the rename email — the primary-key
 * guard that stops a re-trigger from double-sending the announcement.
 */
export const REBRAND_CAMPAIGN = "rebrand_announcement";

// Banner visibility is controlled by two client-visible env vars, referenced as
// static literals in rebrand-banner.tsx (Next only inlines literal NEXT_PUBLIC_*
// reads into the client bundle, so they can't be indirected through a constant):
//   NEXT_PUBLIC_REBRAND_BANNER     — "on" during the bounded post-cutover window
//   NEXT_PUBLIC_REBRAND_CUTOVER_AT — ISO instant separating existing vs new users
