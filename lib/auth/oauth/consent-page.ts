/**
 * Everything GET /oauth/consent decides before it renders, as data the page
 * turns into notFound(), redirect() or the consent screen:
 * - OAuth off -> 404
 * - the request is revalidated: fatal or unavailable -> /oauth/error, a
 *   redirect error -> the client
 * - signed out -> login, returning here
 * - a brand-new account -> onboarding, returning here when it finishes with
 *   a marker (onboarded=1) so it's never sent to onboarding twice
 * - otherwise the screen, with the user's grant state for this app
 * Nothing is written; the consent URL carries the whole request.
 */

import {
  authorizationErrorRedirectUrl,
  canonicalAuthorizeQuery,
  consentPathAfterOnboarding,
  consentPathFor,
  oauthErrorPath,
  searchParamsFromRecord,
  validateAuthorizeRequest,
} from "@/lib/auth/oauth/authorize-params";
import { loadConsentGrantState } from "@/lib/auth/oauth/consent";
import { redirectUriDisplay } from "@/lib/auth/oauth/redirect-uri";
import { parseUrl } from "@/lib/auth/oauth/url";
import { getSessionUser } from "@/lib/auth/session-user";
import {
  AGENT_OAUTH_ONBOARDED_PARAM,
  AGENT_OAUTH_ONBOARDED_VALUE,
  bareHostname,
  isMcpOAuthEnabled,
} from "@/lib/constants/agent-oauth";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loginHref, onboardingHref } from "@/lib/utils/auth-redirect";
import { needsOnboardingBeforeConsent } from "@/lib/utils/user-onboarding";
import type {
  AgentOAuthAuthorizeParams,
  AgentOAuthClientRecord,
  AgentOAuthConsentView,
  SearchParamValue,
  SessionUser,
} from "@/types";

export type ConsentPageResolution =
  | { kind: "not_found" }
  | { kind: "redirect"; location: string }
  | { kind: "render"; view: AgentOAuthConsentView };

const HTTPS_PROTOCOL = "https:";

function redirectTo(location: string): ConsentPageResolution {
  return { kind: "redirect", location };
}

/**
 * The client's website, only when both it and the redirect are https on the
 * same host. A client_uri elsewhere would lend a lookalike app credibility.
 */
export function sameHostClientUri(clientUri: string | null, redirectUri: string): string | null {
  if (clientUri === null) return null;
  const site = parseUrl(clientUri);
  const redirect = parseUrl(redirectUri);
  if (site === null || redirect === null) return null;
  const bothHttps = site.protocol === HTTPS_PROTOCOL && redirect.protocol === HTTPS_PROTOCOL;
  const sameHost = bareHostname(site.hostname) === bareHostname(redirect.hostname);
  return bothHttps && sameHost ? clientUri : null;
}

function consentView(
  client: AgentOAuthClientRecord,
  params: AgentOAuthAuthorizeParams,
  requestedScopes: AgentOAuthConsentView["requestedScopes"],
  user: SessionUser,
  grants: { hasActiveGrant: boolean; atCap: boolean }
): AgentOAuthConsentView {
  return {
    clientName: client.client_name,
    returnDestination: redirectUriDisplay(params.redirectUri),
    clientUri: sameHostClientUri(client.client_uri, params.redirectUri),
    email: user.email,
    requestedScopes,
    userId: user.id,
    requestParams: Object.fromEntries(canonicalAuthorizeQuery(params)),
    consentPath: consentPathFor(params),
    hasActiveGrant: grants.hasActiveGrant,
    atCap: grants.atCap,
  };
}

/** What the consent page should do for these search params at `now`. */
export async function resolveConsentPage(
  searchParams: Readonly<Record<string, SearchParamValue>>,
  now: Date
): Promise<ConsentPageResolution> {
  if (!isMcpOAuthEnabled()) return { kind: "not_found" };
  const admin = createAdminClient();
  const validation = await validateAuthorizeRequest(admin, searchParamsFromRecord(searchParams));
  if (validation.kind === "fatal") return redirectTo(oauthErrorPath("invalid"));
  if (validation.kind === "unavailable") return redirectTo(oauthErrorPath("unavailable"));
  if (validation.kind === "redirect_error") {
    return redirectTo(authorizationErrorRedirectUrl(validation));
  }

  const consentPath = consentPathFor(validation.params);
  const user = await getSessionUser();
  if (user === null) return redirectTo(loginHref(consentPath));
  const returnedFromOnboarding =
    searchParams[AGENT_OAUTH_ONBOARDED_PARAM] === AGENT_OAUTH_ONBOARDED_VALUE;
  if (!returnedFromOnboarding && (await needsOnboardingBeforeConsent(user.id))) {
    return redirectTo(onboardingHref(consentPathAfterOnboarding(validation.params)));
  }

  const grants = await loadConsentGrantState(admin, user.id, validation.client.client_id, now);
  if (grants.kind === "unavailable") return redirectTo(oauthErrorPath("unavailable"));
  return {
    kind: "render",
    view: consentView(validation.client, validation.params, validation.requestedScopes, user, grants),
  };
}
