/**
 * The authorization request (OAuth 2.1 §4.1.1): one validator shared by
 * GET /oauth/authorize, the consent page and POST /api/oauth/authorize, and
 * the URLs built from its result.
 *
 * Validation follows the split in OAuth 2.1 §4.1.2.1. A problem with the
 * client_id or redirect_uri is `fatal`: the user sees /oauth/error and is
 * never sent to an unverified redirect. Every other problem is a
 * `redirect_error` sent back to the matched redirect_uri. Unknown scope
 * values are ignored, and a missing resource means the canonical one.
 *
 * Repeated parameters are refused (RFC 6749 §3.1), and an empty value counts
 * as absent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAgentTokenScope } from "@/lib/auth/agent-token";
import { findClient } from "@/lib/auth/oauth/clients";
import { matchRegisteredRedirectUri } from "@/lib/auth/oauth/redirect-uri";
import { toAcceptedMcpResource } from "@/lib/auth/oauth/resource";
import { AGENT_TOKEN_SCOPES, type AgentTokenScope } from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_ACCESS_DENIED_ERROR,
  AGENT_OAUTH_AUTHORIZE_PARAMS,
  AGENT_OAUTH_ERROR_PAGE_REASON_PARAM,
  AGENT_OAUTH_ISSUER,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_PATHS,
  AGENT_OAUTH_PKCE,
  AGENT_OAUTH_RESPONSE_PARAMS,
  AGENT_OAUTH_RESPONSE_TYPE,
  CANONICAL_MCP_RESOURCE,
  type AgentOAuthAuthorizeErrorCode,
  type AgentOAuthErrorPageReason,
} from "@/lib/constants/agent-oauth";
import type {
  AgentOAuthAuthorizeFatalReason,
  AgentOAuthAuthorizeParams,
  AgentOAuthAuthorizeValidation,
} from "@/types";

/** Anything that reads query parameters the way URLSearchParams does. */
export type AuthorizeRequestParams = Pick<URLSearchParams, "getAll">;

type RedirectError = Extract<AgentOAuthAuthorizeValidation, { kind: "redirect_error" }>;

interface RedirectErrorDetail {
  error: AgentOAuthAuthorizeErrorCode;
  description: string;
}

type SingleParam = { ok: true; value: string | null } | { ok: false };

const PARAM = AGENT_OAUTH_AUTHORIZE_PARAMS;
const RESPONSE_PARAM = AGENT_OAUTH_RESPONSE_PARAMS;
const SCOPE_SEPARATOR = " ";
const QUERY_START = "?";
const QUERY_SEPARATOR = "&";
const CODE_CHALLENGE_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{${AGENT_OAUTH_PKCE.challengeLength}}$`
);

const MESSAGES = {
  responseType: `response_type must be "${AGENT_OAUTH_RESPONSE_TYPE}"`,
  state: `state must be a single value of at most ${AGENT_OAUTH_LIMITS.stateMaxLength} characters`,
  codeChallenge: `code_challenge must be ${AGENT_OAUTH_PKCE.challengeLength} base64url characters`,
  codeChallengeMethod: `code_challenge_method must be ${AGENT_OAUTH_PKCE.method}`,
  scope: `scope must be a single value of at most ${AGENT_OAUTH_LIMITS.scopeParamMaxLength} characters`,
  resource: "resource must be this server's MCP endpoint",
  accessDenied: "The user denied the request",
} as const;

// ── reading ────────────────────────────────────────────────────────────────

function readSingle(params: AuthorizeRequestParams, name: string): SingleParam {
  const values = params.getAll(name);
  if (values.length > 1) return { ok: false };
  const value = values[0];
  return { ok: true, value: value === undefined || value === "" ? null : value };
}

/**
 * A Next.js `searchParams` record as URLSearchParams, keeping repeated values
 * so the validator can refuse them.
 */
export function searchParamsFromRecord(
  record: Readonly<Record<string, string | string[] | undefined>>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(record)) {
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const item of values) params.append(name, item);
  }
  return params;
}

/** The known scopes in a scope parameter, deduplicated, in canonical order. */
export function requestedKnownScopes(scope: string | null): AgentTokenScope[] {
  const requested = new Set((scope ?? "").split(SCOPE_SEPARATOR).filter(isAgentTokenScope));
  return AGENT_TOKEN_SCOPES.filter((known) => requested.has(known));
}

// ── checks ─────────────────────────────────────────────────────────────────

type Checked<T> = { ok: true; value: T } | { ok: false; detail: RedirectErrorDetail };

function invalidRequest(description: string): RedirectErrorDetail {
  return { error: "invalid_request", description };
}

function isWithin(read: SingleParam, maxLength: number): read is { ok: true; value: string | null } {
  return read.ok && (read.value === null || read.value.length <= maxLength);
}

/** The state to echo back: only a single value within the limit. */
function echoableState(state: SingleParam): string | null {
  return isWithin(state, AGENT_OAUTH_LIMITS.stateMaxLength) ? state.value : null;
}

function checkResponseType(params: AuthorizeRequestParams): RedirectErrorDetail | null {
  const responseType = readSingle(params, PARAM.responseType);
  if (responseType.ok && responseType.value === AGENT_OAUTH_RESPONSE_TYPE) return null;
  return { error: "unsupported_response_type", description: MESSAGES.responseType };
}

/** PKCE is required, with S256 only (OAuth 2.1 §4.1.1). */
function readCodeChallenge(params: AuthorizeRequestParams): Checked<string> {
  const challenge = readSingle(params, PARAM.codeChallenge);
  if (!challenge.ok || challenge.value === null || !CODE_CHALLENGE_PATTERN.test(challenge.value)) {
    return { ok: false, detail: invalidRequest(MESSAGES.codeChallenge) };
  }
  const method = readSingle(params, PARAM.codeChallengeMethod);
  if (!method.ok || method.value !== AGENT_OAUTH_PKCE.method) {
    return { ok: false, detail: invalidRequest(MESSAGES.codeChallengeMethod) };
  }
  return { ok: true, value: challenge.value };
}

function acceptedResource(resource: SingleParam): string | null {
  if (!resource.ok) return null;
  if (resource.value === null) return CANONICAL_MCP_RESOURCE;
  return toAcceptedMcpResource(resource.value);
}

/** The normalized accepted resource, or the canonical one when absent (RFC 8707). */
function readResource(params: AuthorizeRequestParams): Checked<string> {
  const accepted = acceptedResource(readSingle(params, PARAM.resource));
  if (accepted === null) {
    return { ok: false, detail: { error: "invalid_target", description: MESSAGES.resource } };
  }
  return { ok: true, value: accepted };
}

function fatal(reason: AgentOAuthAuthorizeFatalReason): AgentOAuthAuthorizeValidation {
  return { kind: "fatal", reason };
}

/**
 * Everything after the client and redirect URI are known to be good, in
 * OAuth 2.1 §4.1.2.1 order; the first problem is returned.
 */
function validateRedirectableParams(
  params: AuthorizeRequestParams,
  base: Pick<AgentOAuthAuthorizeParams, "clientId" | "redirectUri" | "registeredRedirectUri">
): RedirectError | { kind: "valid"; params: AgentOAuthAuthorizeParams } {
  const state = readSingle(params, PARAM.state);
  const scope = readSingle(params, PARAM.scope);
  const reject = (detail: RedirectErrorDetail): RedirectError => ({
    kind: "redirect_error",
    redirectUri: base.redirectUri,
    state: echoableState(state),
    ...detail,
  });

  const responseTypeProblem = checkResponseType(params);
  if (responseTypeProblem !== null) return reject(responseTypeProblem);
  if (!isWithin(state, AGENT_OAUTH_LIMITS.stateMaxLength)) {
    return reject(invalidRequest(MESSAGES.state));
  }
  const challenge = readCodeChallenge(params);
  if (!challenge.ok) return reject(challenge.detail);
  if (!isWithin(scope, AGENT_OAUTH_LIMITS.scopeParamMaxLength)) {
    return reject(invalidRequest(MESSAGES.scope));
  }
  const resource = readResource(params);
  if (!resource.ok) return reject(resource.detail);

  return {
    kind: "valid",
    params: {
      ...base,
      state: state.value,
      codeChallenge: challenge.value,
      resource: resource.value,
      scope: scope.value,
    },
  };
}

/**
 * Validate an authorization request. The client is looked up with the
 * service-role `admin` client; a lookup failure is `unavailable`. On `ok`,
 * `params.redirectUri` is where the user is sent back (the URI as presented,
 * which differs from the registered one only in a loopback port), and
 * `params.registeredRedirectUri` is what the code stores.
 */
export async function validateAuthorizeRequest(
  admin: SupabaseClient,
  params: AuthorizeRequestParams
): Promise<AgentOAuthAuthorizeValidation> {
  const clientId = readSingle(params, PARAM.clientId);
  if (!clientId.ok || clientId.value === null) return fatal("unknown_client");
  const redirectUri = readSingle(params, PARAM.redirectUri);
  if (!redirectUri.ok || redirectUri.value === null) return fatal("invalid_redirect_uri");

  const lookup = await findClient(admin, clientId.value);
  if (lookup.kind === "unavailable") return { kind: "unavailable" };
  if (lookup.kind === "not_found") return fatal("unknown_client");
  const registered = matchRegisteredRedirectUri(redirectUri.value, lookup.client.redirect_uris);
  if (registered === null) return fatal("invalid_redirect_uri");

  const checked = validateRedirectableParams(params, {
    clientId: clientId.value,
    redirectUri: redirectUri.value,
    registeredRedirectUri: registered,
  });
  if (checked.kind !== "valid") return checked;
  return {
    kind: "ok",
    params: checked.params,
    client: lookup.client,
    requestedScopes: requestedKnownScopes(checked.params.scope),
  };
}

// ── building ───────────────────────────────────────────────────────────────

/**
 * The validated request as a query string, rebuilt from scratch so login,
 * the auth callback and onboarding carry only what was validated, and every
 * value is encoded (so isValidInternalPath never sees "://").
 */
export function canonicalAuthorizeQuery(params: AgentOAuthAuthorizeParams): URLSearchParams {
  const query = new URLSearchParams();
  query.set(PARAM.responseType, AGENT_OAUTH_RESPONSE_TYPE);
  query.set(PARAM.clientId, params.clientId);
  query.set(PARAM.redirectUri, params.redirectUri);
  if (params.state !== null) query.set(PARAM.state, params.state);
  query.set(PARAM.codeChallenge, params.codeChallenge);
  query.set(PARAM.codeChallengeMethod, AGENT_OAUTH_PKCE.method);
  query.set(PARAM.resource, params.resource);
  if (params.scope !== null) query.set(PARAM.scope, params.scope);
  return query;
}

/** /oauth/error, with the reason when it isn't the default "invalid link" card. */
export function oauthErrorPath(reason: AgentOAuthErrorPageReason): string {
  if (reason === "invalid") return AGENT_OAUTH_PATHS.error;
  const query = new URLSearchParams({ [AGENT_OAUTH_ERROR_PAGE_REASON_PARAM]: reason });
  return `${AGENT_OAUTH_PATHS.error}${QUERY_START}${query}`;
}

/** The consent page's path for a validated request. */
export function consentPathFor(params: AgentOAuthAuthorizeParams): string {
  return `${AGENT_OAUTH_PATHS.consent}${QUERY_START}${canonicalAuthorizeQuery(params)}`;
}

/**
 * `redirectUri` with `values` appended to its query. Registered redirect URIs
 * never carry a fragment, so appending keeps the URI's own query intact and
 * never adds one. The issuer is always included (RFC 9207).
 */
export function clientRedirectUrl(
  redirectUri: string,
  values: ReadonlyArray<readonly [string, string | null]>
): string {
  const query = new URLSearchParams();
  for (const [name, value] of values) {
    if (value !== null) query.append(name, value);
  }
  query.append(RESPONSE_PARAM.issuer, AGENT_OAUTH_ISSUER);
  if (!redirectUri.includes(QUERY_START)) return `${redirectUri}${QUERY_START}${query}`;
  const endsWithSeparator = redirectUri.endsWith(QUERY_START) || redirectUri.endsWith(QUERY_SEPARATOR);
  return `${redirectUri}${endsWithSeparator ? "" : QUERY_SEPARATOR}${query}`;
}

/** Where a redirect error sends the browser. */
export function authorizationErrorRedirectUrl(
  redirectError: Pick<RedirectError, "redirectUri" | "state" | "error" | "description">
): string {
  return clientRedirectUrl(redirectError.redirectUri, [
    [RESPONSE_PARAM.error, redirectError.error],
    [RESPONSE_PARAM.errorDescription, redirectError.description],
    [RESPONSE_PARAM.state, redirectError.state],
  ]);
}

/** Where an approval sends the browser: the code, state and issuer. */
export function authorizationCodeRedirectUrl(
  params: AgentOAuthAuthorizeParams,
  code: string
): string {
  return clientRedirectUrl(params.redirectUri, [
    [RESPONSE_PARAM.code, code],
    [RESPONSE_PARAM.state, params.state],
  ]);
}

/** Where a denial sends the browser: access_denied, state and issuer. */
export function accessDeniedRedirectUrl(params: AgentOAuthAuthorizeParams): string {
  return clientRedirectUrl(params.redirectUri, [
    [RESPONSE_PARAM.error, AGENT_OAUTH_ACCESS_DENIED_ERROR],
    [RESPONSE_PARAM.errorDescription, MESSAGES.accessDenied],
    [RESPONSE_PARAM.state, params.state],
  ]);
}
