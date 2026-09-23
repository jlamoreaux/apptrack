/**
 * Everything GET /oauth/consent decides before it renders, as data the page
 * turns into notFound(), redirect() or the consent screen:
 * - OAuth off -> 404
 * - the request is revalidated: fatal or unavailable -> /oauth/error, a
 *   redirect error -> the client
 * - signed out -> login, returning here
 * - a brand-new account -> onboarding, returning here when it finishes
 * - otherwise the screen, with the user's grant state for this app
 * Nothing is written; the consent URL carries the whole request.
 */

import {
  authorizationErrorRedirectUrl,
  canonicalAuthorizeQuery,
  consentPathFor,
  oauthErrorPath,
  searchParamsFromRecord,
  validateAuthorizeRequest,
} from "@/lib/auth/oauth/authorize-params";
import { loadConsentGrantState } from "@/lib/auth/oauth/consent";
import { redirectUriDisplay } from "@/lib/auth/oauth/redirect-uri";
import { parseUrl } from "@/lib/auth/oauth/url";
import { getSessionUser } from "@/lib/auth/session-user";
import { bareHostname, isMcpOAuthEnabled } from "@/lib/constants/agent-oauth";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loginHref, onboardingHref, type SearchParamValue } from "@/lib/utils/auth-redirect";
import { isNewUser } from "@/lib/utils/user-onboarding";
import type { AgentOAuthAuthorizeParams, AgentOAuthClientRecord, AgentOAuthConsentView } from "@/types";

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
  email: string | null,
  grants: { hasActiveGrant: boolean; atCap: boolean }
): AgentOAuthConsentView {
  return {
    clientName: client.client_name,
    returnDestination: redirectUriDisplay(params.redirectUri),
    clientUri: sameHostClientUri(client.client_uri, params.redirectUri),
    email,
    requestedScopes,
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
  if (await isNewUser(user.id)) return redirectTo(onboardingHref(consentPath));

  const grants = await loadConsentGrantState(admin, user.id, validation.client.client_id, now);
  if (grants.kind === "unavailable") return redirectTo(oauthErrorPath("unavailable"));
  return {
    kind: "render",
    view: consentView(validation.client, validation.params, validation.requestedScopes, user.email, grants),
  };
}
