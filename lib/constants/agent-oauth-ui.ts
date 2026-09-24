/**
 * Copy for the OAuth pages (/oauth/error and /oauth/consent) and the consent
 * form. Client-safe: no server imports.
 */

import { AGENT_API_NETWORK_ERROR } from "@/lib/constants/agent-access-ui";
import type { AgentOAuthErrorPageReason } from "@/lib/constants/agent-oauth";

export const OAUTH_ERROR_PAGE_COPY = {
  invalid: {
    title: "This connection link is invalid",
    body: "Start again from your app.",
  },
  unavailable: {
    title: "We couldn't check this connection",
    body: "Something went wrong on our side. Wait a moment, then start again from your app.",
  },
} as const satisfies Record<AgentOAuthErrorPageReason, { title: string; body: string }>;

export const OAUTH_ERROR_PAGE_DASHBOARD_LINK = "Go to your dashboard";

export const OAUTH_CONSENT_COPY = {
  // Follows the app's name, which is rendered in its own <bdi> so a
  // right-to-left name can't reorder the rest of the sentence.
  headingAfterName: "wants to connect to your CareerOtter account",
  unverified:
    "CareerOtter hasn't verified this app. Only continue if you just started connecting it.",
  returnTo: "After you choose, you'll go back to",
  clientUri: "App website:",
  signedInAs: "Signed in as",
  notYou: "Not you?",
  signOut: "Sign out",
  formLabel: "Approve or deny this app",
  scopesLegend: "What this app can do",
  requestedByApp: "Requested by the app",
  replacesAccess: "Approving replaces this app's current access.",
  atCap: (max: number) =>
    `You already have ${max} connected apps. Remove one before connecting another.`,
  manageApps: "Manage connected apps",
  approve: "Approve",
  deny: "Deny",
  submitting: "Sending...",
  noAccount: "Don't have an account? Create one, then reconnect from your app.",
} as const;

export const OAUTH_CONSENT_MESSAGES = {
  scopesRequired: "Choose at least one thing this app can do.",
  invalid: "This request couldn't be completed. Start again from your app.",
  unauthorized: "Your session ended. Sign in again, then start again from your app.",
  atCap: "You have too many connected apps. Remove one on your data page, then try again.",
  retry: "Something went wrong. Try again in a moment.",
  accountChanged: "You're signed in as a different account. Reload to continue.",
  network: AGENT_API_NETWORK_ERROR,
} as const;
