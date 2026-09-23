/**
 * CareerOtter OAuth 2.1 authorization server for the MCP server.
 *
 * The lists, lifetimes, limits and function outcomes here mirror
 * schemas/migrations/045_mcp_oauth.sql; __tests__/constants/agent-oauth.test.ts
 * guards against drift. Scopes are the PAT scopes (AGENT_TOKEN_SCOPES).
 */

import {
  AGENT_RATE_LIMITS,
  AGENT_TOKEN_EXPIRY_DAYS_OPTIONS,
  MCP_RESOURCE_PATH,
  type AgentRateLimit,
} from "@/lib/constants/agent-access";
import { DEFAULT_AGENT_TOKEN_SCOPES } from "@/lib/constants/agent-access-ui";
import { SITE_URL } from "@/lib/constants/site-config";
import { LEGACY_HOSTS } from "@/lib/rebrand-redirect";
import type { McpBearerTokenFailure } from "@/types";

// ── Gating ──────────────────────────────────────────────────────────────────

const ENV_FLAG_ON = "1";
const VERCEL_PREVIEW_ENV = "preview";

/**
 * True when CAREEROTTER_ENABLED is "1". The OAuth cleanup cron is gated on
 * this alone, so rows keep getting cleaned up while the OAuth flag is off.
 */
export function isCareerotterEnabled(): boolean {
  return process.env.CAREEROTTER_ENABLED === ENV_FLAG_ON;
}

/**
 * True only when both CAREEROTTER_ENABLED and CAREEROTTER_MCP_OAUTH_ENABLED
 * are "1" and this isn't a Vercel preview. On a preview the issuer would still
 * be the production origin, and previews may share the production database,
 * so tokens would work against unreviewed code. Read at call time so runtime
 * env decides.
 */
export function isMcpOAuthEnabled(): boolean {
  return (
    isCareerotterEnabled() &&
    process.env.CAREEROTTER_MCP_OAUTH_ENABLED === ENV_FLAG_ON &&
    process.env.VERCEL_ENV !== VERCEL_PREVIEW_ENV
  );
}

// ── Secrets and identifiers ─────────────────────────────────────────────────

export const AGENT_OAUTH_PREFIXES = {
  accessToken: "co_oat_",
  refreshToken: "co_ort_",
  authorizationCode: "co_code_",
  clientSecret: "co_cs_",
  clientId: "co_client_",
} as const;

// Random bytes behind a client_id. It's a public identifier, so 128 bits is
// plenty; base64url of 16 bytes is the 22 characters the client_id CHECK wants.
export const AGENT_OAUTH_CLIENT_ID_BYTES = 16;

// RFC 7591 §3.2.1: 0 means the client secret never expires.
export const AGENT_OAUTH_CLIENT_SECRET_NEVER_EXPIRES = 0;

// ── Lifetimes ───────────────────────────────────────────────────────────────

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

/**
 * Every expiry is computed in the database with now(); these mirror the
 * interval constants in migration 045 for display and for tests.
 */
export const AGENT_OAUTH_LIFETIME_SECONDS = {
  // Capped at the grant's expiry. Revocation is checked on every request, so a
  // short lifetime would buy little and multiply refreshes.
  accessToken: 24 * SECONDS_PER_HOUR,
  // From the refresh that issued it, capped at the grant's expiry.
  refreshTokenIdle: 30 * SECONDS_PER_DAY,
  authorizationCode: 5 * SECONDS_PER_MINUTE,
  // Concurrent refreshes by one client within this window of the first get a
  // new pair instead of revoking the grant (RFC 9700 §4.14.2). Each reissue
  // supersedes the pairs issued before it, so only the latest stays live.
  refreshGraceWindow: SECONDS_PER_MINUTE,
  // A grant with less than this left is refused at exchange and refresh, so
  // expires_in is never 0 and no dead refresh token is issued.
  minGrantRemaining: SECONDS_PER_MINUTE,
  // Clients that never complete an authorization are deleted after this.
  unusedClient: 24 * SECONDS_PER_HOUR,
  // Grants that never expire are revoked after this long unused.
  idleGrant: 30 * SECONDS_PER_DAY,
  // Codes and tokens stay this long past their expiry before cleanup.
  retentionAfterExpiry: SECONDS_PER_DAY,
} as const;

// ── Limits ──────────────────────────────────────────────────────────────────

export const AGENT_OAUTH_LIMITS = {
  // Active grants per user; approving an app that already has one replaces it.
  maxActiveGrantsPerUser: 10,
  // Extra token pairs per consumed refresh token inside the grace window.
  maxGraceReissues: 5,
  // Longest grant lifetime a code may carry (the grant_expires_in CHECK): the
  // longest PAT expiry option.
  grantExpiresInMaxDays: Math.max(...AGENT_TOKEN_EXPIRY_DAYS_OPTIONS),
  redirectUrisMax: 5,
  redirectUriMaxLength: 512,
  // Code points, matching char_length in the CHECK.
  clientNameMax: 100,
  clientUriMaxLength: 512,
  resourceMaxLength: 512,
  // UTF-8 bytes, not UTF-16 code units: URLs carry bytes, and a multi-byte
  // state would otherwise outgrow the URL budget below.
  stateMaxBytes: 512,
  scopeParamMaxLength: 256,
  // The canonical consent path (/oauth/consent?<query>). It's carried through
  // login, the auth callback's next and Supabase's redirect_to, each level
  // percent-encoding the one inside it; a request whose path is longer than
  // this, or whose worst-case nesting (see consentPathFitsBudget) is longer
  // than nestedRedirectMaxLength, is refused as invalid_request.
  consentPathMaxLength: 6 * 1024,
  nestedRedirectMaxLength: 8 * 1024,
  // Room kept inside nestedRedirectMaxLength for Supabase's own URL and the
  // parameters around redirect_to.
  supabaseRedirectAllowance: 512,
  requestBodyMaxBytes: 16 * 1024,
} as const;

export const AGENT_OAUTH_DEFAULT_CLIENT_NAME = "Unnamed app";

// Combining marks kept per run in a client name. Enough for any real script's
// stacked diacritics; longer runs ("zalgo" text) spill over neighbouring lines
// on the consent screen.
export const AGENT_OAUTH_CLIENT_NAME_MAX_COMBINING_MARKS = 3;

// RFC 7636: S256 only. The challenge is base64url(SHA-256), 43 characters.
export const AGENT_OAUTH_PKCE = {
  method: "S256",
  challengeLength: 43,
  verifierMinLength: 43,
  verifierMaxLength: 128,
} as const;

// ── Protocol values ─────────────────────────────────────────────────────────

export const AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS = [
  "none",
  "client_secret_basic",
  "client_secret_post",
] as const;
export type AgentOAuthTokenEndpointAuthMethod =
  (typeof AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS)[number];

export const DEFAULT_AGENT_OAUTH_AUTH_METHOD =
  "none" satisfies AgentOAuthTokenEndpointAuthMethod;

export const AGENT_OAUTH_GRANT_TYPE = {
  authorizationCode: "authorization_code",
  refreshToken: "refresh_token",
} as const;

export const AGENT_OAUTH_GRANT_TYPES = [
  AGENT_OAUTH_GRANT_TYPE.authorizationCode,
  AGENT_OAUTH_GRANT_TYPE.refreshToken,
] as const;
export type AgentOAuthGrantType = (typeof AGENT_OAUTH_GRANT_TYPES)[number];

// Registration must include this one; the refresh grant is optional.
export const REQUIRED_AGENT_OAUTH_GRANT_TYPE = AGENT_OAUTH_GRANT_TYPE.authorizationCode;

// Scope parameters are space-separated lists (RFC 6749 §3.3).
export const AGENT_OAUTH_SCOPE_SEPARATOR = " ";

export const AGENT_OAUTH_RESPONSE_TYPE = "code";

// Authorization request parameters (OAuth 2.1 §4.1.1, RFC 8707), in the order
// the canonical consent query carries them.
export const AGENT_OAUTH_AUTHORIZE_PARAMS = {
  responseType: "response_type",
  clientId: "client_id",
  redirectUri: "redirect_uri",
  state: "state",
  codeChallenge: "code_challenge",
  codeChallengeMethod: "code_challenge_method",
  resource: "resource",
  scope: "scope",
} as const;

// Authorization response parameters (OAuth 2.1 §4.1.2, RFC 9207).
export const AGENT_OAUTH_RESPONSE_PARAMS = {
  code: "code",
  state: "state",
  issuer: "iss",
  error: "error",
  errorDescription: "error_description",
} as const;

// Sent to the client when the user denies the request (OAuth 2.1 §4.1.2.1).
export const AGENT_OAUTH_ACCESS_DENIED_ERROR = "access_denied";

export const AGENT_OAUTH_CONSENT_DECISIONS = ["approve", "deny"] as const;
export type AgentOAuthConsentDecision =
  (typeof AGENT_OAUTH_CONSENT_DECISIONS)[number];

// /oauth/error?reason=… picks the card's copy; anything else shows `invalid`.
export const AGENT_OAUTH_ERROR_PAGE_REASONS = ["invalid", "unavailable"] as const;
export type AgentOAuthErrorPageReason =
  (typeof AGENT_OAUTH_ERROR_PAGE_REASONS)[number];
export const AGENT_OAUTH_ERROR_PAGE_REASON_PARAM = "reason";

// Added to the consent URL that onboarding returns to, so the consent page
// doesn't send the same user to onboarding a second time. Not part of the
// authorization request: the validator ignores it and the canonical query
// never carries it.
export const AGENT_OAUTH_ONBOARDED_PARAM = "onboarded";
export const AGENT_OAUTH_ONBOARDED_VALUE = "1";

// RFC 7591 §3.2.2 error codes from the registration endpoint.
export const AGENT_OAUTH_REGISTRATION_ERROR_CODES = [
  "invalid_redirect_uri",
  "invalid_client_metadata",
] as const;
export type AgentOAuthRegistrationErrorCode =
  (typeof AGENT_OAUTH_REGISTRATION_ERROR_CODES)[number];

export const AGENT_OAUTH_TOKEN_KIND = {
  access: "access",
  refresh: "refresh",
} as const;

export const AGENT_OAUTH_TOKEN_KINDS = [
  AGENT_OAUTH_TOKEN_KIND.access,
  AGENT_OAUTH_TOKEN_KIND.refresh,
] as const;
export type AgentOAuthTokenKind = (typeof AGENT_OAUTH_TOKEN_KINDS)[number];

export const AGENT_OAUTH_REVOKE_REASONS = [
  "user",
  "user_all",
  // The client revoked a token at the revocation endpoint (RFC 7009).
  "client",
  "replaced",
  "refresh_reuse",
  "code_reuse",
  "idle",
] as const;
export type AgentOAuthRevokeReason =
  (typeof AGENT_OAUTH_REVOKE_REASONS)[number];

// Errors the authorize handler sends back to the client's redirect_uri.
export const AGENT_OAUTH_AUTHORIZE_ERROR_CODES = [
  "invalid_request",
  "unsupported_response_type",
  "invalid_target",
] as const;
export type AgentOAuthAuthorizeErrorCode =
  (typeof AGENT_OAUTH_AUTHORIZE_ERROR_CODES)[number];

// Token and revocation request parameters (RFC 6749 §4.1.3, §6; RFC 7636
// §4.5; RFC 7009 §2.1; RFC 8707 §2.2). Each may appear at most once.
export const AGENT_OAUTH_TOKEN_PARAMS = {
  grantType: "grant_type",
  code: "code",
  redirectUri: "redirect_uri",
  codeVerifier: "code_verifier",
  refreshToken: "refresh_token",
  resource: "resource",
  scope: "scope",
  clientId: "client_id",
  clientSecret: "client_secret",
  token: "token",
  tokenTypeHint: "token_type_hint",
} as const;

// RFC 6749 §5.1.
export const AGENT_OAUTH_TOKEN_TYPE = "Bearer";

// The token and revocation endpoints accept only this body type (RFC 6749 §3.2).
export const AGENT_OAUTH_FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

// Sent with a 401 invalid_client when the client used HTTP Basic (RFC 6749 §5.2).
export const AGENT_OAUTH_BASIC_CHALLENGE = 'Basic realm="CareerOtter"';

// The token endpoint's invalid_grant description when the user is at the
// active-grant cap.
export const AGENT_OAUTH_GRANT_CAP_DESCRIPTION =
  "Too many connected apps. Remove one on your CareerOtter data page.";

// RFC 6749 §5.2, plus invalid_target from RFC 8707.
export const AGENT_OAUTH_TOKEN_ERROR_CODES = [
  "invalid_request",
  "invalid_client",
  "invalid_grant",
  "unauthorized_client",
  "unsupported_grant_type",
  "invalid_scope",
  "invalid_target",
] as const;
export type AgentOAuthTokenErrorCode =
  (typeof AGENT_OAUTH_TOKEN_ERROR_CODES)[number];

// Sent in the 401 challenge so SDK-based clients request the PAT defaults
// rather than every supported scope.
export const AGENT_OAUTH_DEFAULT_SCOPE_HINT = DEFAULT_AGENT_TOKEN_SCOPES.join(AGENT_OAUTH_SCOPE_SEPARATOR);

// error_description in the MCP route's invalid_token challenge (RFC 6750 §3).
// Values must stay within RFC 6750's error_description charset: no " or \.
export const MCP_BEARER_FAILURE_DESCRIPTIONS = {
  invalid: "The access token is invalid",
  expired: "The access token has expired",
  revoked: "The access token has been revoked",
} as const satisfies Record<McpBearerTokenFailure, string>;

// ── Redirect URIs ───────────────────────────────────────────────────────────

// RFC 8252 §7.3: http is allowed only on these hosts, with any port.
export const AGENT_OAUTH_LOOPBACK_HOSTS = [
  "127.0.0.1",
  "[::1]",
  "localhost",
] as const;

// RFC 8252 §7.1 private-use schemes (e.g. cursor://), before the denylist.
export const AGENT_OAUTH_PRIVATE_USE_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]{2,}$/;

// Schemes that execute, read local data, reach the network in a way the
// https/loopback rules already govern, or hand off to another app or browser.
export const AGENT_OAUTH_DENIED_REDIRECT_SCHEMES = [
  "javascript",
  "data",
  "file",
  "vbscript",
  "about",
  "blob",
  "filesystem",
  "http",
  "https",
  "ws",
  "wss",
  "mailto",
  "tel",
  "sms",
  "intent",
  "chrome",
  "chrome-extension",
  "moz-extension",
  "ftp",
] as const;

// ── Database (migration 045) ────────────────────────────────────────────────

export const AGENT_OAUTH_CLIENTS_TABLE = "agent_oauth_clients";
export const AGENT_OAUTH_GRANTS_TABLE = "agent_oauth_grants";
export const AGENT_OAUTH_TOKENS_TABLE = "agent_oauth_tokens";
export const AGENT_OAUTH_CODES_TABLE = "agent_oauth_codes";

export const AGENT_OAUTH_RPC = {
  createCode: "create_agent_oauth_code",
  exchangeCode: "exchange_agent_oauth_code",
  rotateRefresh: "rotate_agent_oauth_refresh",
  revokeGrant: "revoke_agent_oauth_grant",
  revokeAllGrants: "revoke_all_agent_oauth_grants",
  revokeToken: "revoke_agent_oauth_token",
  deleteExpiredRows: "delete_expired_agent_oauth_rows",
} as const;

export const AGENT_OAUTH_CREATE_CODE_OUTCOMES = [
  "ok",
  // The client was deleted between validation and approval.
  "invalid_client",
  "grant_cap",
] as const;
export type AgentOAuthCreateCodeOutcome =
  (typeof AGENT_OAUTH_CREATE_CODE_OUTCOMES)[number];

export const AGENT_OAUTH_EXCHANGE_OUTCOMES = [
  "ok",
  "invalid_grant",
  // The code was already used; the grant it produced is now revoked.
  "code_reuse",
  "grant_cap",
] as const;
export type AgentOAuthExchangeOutcome =
  (typeof AGENT_OAUTH_EXCHANGE_OUTCOMES)[number];

export const AGENT_OAUTH_ROTATE_OUTCOMES = [
  "ok",
  "invalid_grant",
  // A superseded refresh token, or a consumed one presented after the grace
  // window, after a successor was used, or past the reissue limit; the grant
  // is now revoked.
  "refresh_reuse",
] as const;
export type AgentOAuthRotateOutcome =
  (typeof AGENT_OAUTH_ROTATE_OUTCOMES)[number];

// Shared by revoke_agent_oauth_grant and revoke_agent_oauth_token.
export const AGENT_OAUTH_REVOKE_OUTCOMES = [
  "revoked",
  "already_revoked",
  "not_found",
] as const;
export type AgentOAuthRevokeOutcome =
  (typeof AGENT_OAUTH_REVOKE_OUTCOMES)[number];

// ── Rate limits ─────────────────────────────────────────────────────────────

export const AGENT_OAUTH_RATE_LIMITS = {
  // Generous: hosted clients register server-side from shared IPs.
  // Keyed by IPv4 address or IPv6 /64, and charged for every request.
  registerPerIp: { tokens: 30, window: "10 m", keyPrefix: "oauth-register:ip:" },
  registerPerIpDaily: { tokens: 100, window: "1 d", keyPrefix: "oauth-register:ip-daily:" },
  // Charged only for a registration that passed validation and is about to be
  // stored, so malformed requests can't spend it.
  registerGlobal: { tokens: 2000, window: "1 d", keyPrefix: "oauth-register:global" },
  // Charged only after client authentication succeeds, so a caller presenting
  // another client's id with a bad secret can't drain that client's quota. A
  // public client (auth method none) proves nothing but its public id, so its
  // bucket is split per caller IP (IPv6 by /64): see perClientKey in
  // lib/auth/oauth/token-endpoint.ts.
  tokenPerClient: { tokens: 60, window: "1 m", keyPrefix: "oauth-token:client:" },
  // Counts only failed client authentication, since hosted clients share IPs.
  // A failed authentication is charged here and nowhere else. It is checked,
  // without charging, before the client lookup, so an IP over it can't keep
  // making database queries.
  tokenAuthFailPerIp: { tokens: 600, window: "1 m", keyPrefix: "oauth-token-auth-fail:" },
  // co_oat_ failures at /api/mcp. Bounds database lookups rather than
  // guessing (tokens carry 256 bits); kept apart from the PAT lockout.
  oauthFailPerIp: { tokens: 600, window: "1 m", keyPrefix: "mcp-oauth-fail:" },
  // Same numbers as a PAT, keyed by grant id.
  perGrant: { ...AGENT_RATE_LIMITS.perToken, keyPrefix: "mcp-oauth-grant:" },
} as const satisfies Record<string, AgentRateLimit>;

// Rate-limit checks and the token endpoint's side-effect-free lookups (the
// client, the code, the refresh token) are abandoned after these, and the
// request fails closed with 503. The lookups are aborted, not just abandoned.
// The mutating functions are never aborted from here: their lock waits are
// bounded in the database instead (AGENT_OAUTH_DB_LOCK_TIMEOUT_SECONDS).
export const AGENT_OAUTH_DEADLINES_MS = {
  rateLimit: 2_000,
  dbRead: 5_000,
} as const;

// `set lock_timeout` on migration 045's functions that wait for the per-user
// advisory lock or a row lock, so a stuck lock fails the call (503) instead of
// holding the request until the platform kills it.
export const AGENT_OAUTH_DB_LOCK_TIMEOUT_SECONDS = 3;

// delete_expired_agent_oauth_rows removes at most batchSize rows per rule per
// call, so a backlog can't outrun the statement timeout. The cron calls it
// again while a rule filled its batch, up to maxRounds calls per run; anything
// left waits for the next day.
export const AGENT_OAUTH_CLEANUP = {
  batchSize: 5000,
  maxRounds: 10,
} as const;

// The error code of a 503 from the registration, token and revocation
// endpoints (RFC 6749 §4.1.2.1), sent with Retry-After.
export const AGENT_OAUTH_UNAVAILABLE_ERROR = "temporarily_unavailable";

// Body of a 429 from the registration, token and revocation endpoints.
export const AGENT_OAUTH_RATE_LIMITED_ERROR = {
  error: "invalid_request",
  error_description: "rate limited",
} as const;

// ── Endpoints ───────────────────────────────────────────────────────────────

const PROTECTED_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";

export const AGENT_OAUTH_PATHS = {
  protectedResourceMetadata: `${PROTECTED_RESOURCE_METADATA_PATH}${MCP_RESOURCE_PATH}`,
  protectedResourceMetadataRoot: PROTECTED_RESOURCE_METADATA_PATH,
  authorizationServerMetadata: "/.well-known/oauth-authorization-server",
  register: "/api/oauth/register",
  authorize: "/oauth/authorize",
  consent: "/oauth/consent",
  error: "/oauth/error",
  consentDecision: "/api/oauth/authorize",
  token: "/api/oauth/token",
  revoke: "/api/oauth/revoke",
  cleanupCron: "/api/cron/agent-oauth-cleanup",
} as const;

// ── Response headers ────────────────────────────────────────────────────────

const CORS_ALLOW_HEADERS = "MCP-Protocol-Version, Authorization, Content-Type";

// The .well-known documents.
export const AGENT_OAUTH_METADATA_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
} as const;

// Registration, token and revocation, so browser-based OAuth flows can finish.
export const AGENT_OAUTH_ENDPOINT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
} as const;

export const AGENT_OAUTH_METADATA_CACHE_CONTROL = "public, max-age=60";

// Token and revocation responses (RFC 6749 §5.1).
export const AGENT_OAUTH_NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
} as const;

// ── Origins and resources ───────────────────────────────────────────────────

/** The issuer: SITE_URL, which is an origin with no trailing slash. */
export const AGENT_OAUTH_ISSUER = SITE_URL;

const ORIGIN_PROTOCOLS: readonly string[] = ["http:", "https:"];
const EXTRA_ORIGINS_SEPARATOR = ",";
const HOSTNAME_WILDCARD = "*";

function toOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`CAREEROTTER_MCP_EXTRA_ORIGINS: "${value}" is not a URL`, {
      cause: error,
    });
  }

  const isBareOrigin =
    ORIGIN_PROTOCOLS.includes(url.protocol) &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";
  if (!isBareOrigin) {
    throw new Error(
      `CAREEROTTER_MCP_EXTRA_ORIGINS: "${value}" must be an http(s) origin with no path, query or credentials`
    );
  }
  // URL accepts "*" in a hostname, but origins are matched exactly, so a
  // wildcard would never match and almost certainly means a misconfiguration.
  if (url.hostname.includes(HOSTNAME_WILDCARD)) {
    throw new Error(
      `CAREEROTTER_MCP_EXTRA_ORIGINS: "${value}" contains a wildcard; list each origin separately`
    );
  }
  return url.origin;
}

/**
 * The origins the MCP resource may be reached on: siteUrl first, then each
 * comma-separated entry of extraOrigins, normalized by URL (lowercase host,
 * default port dropped) and de-duplicated. Throws on an entry that isn't a
 * bare http(s) origin, so a misconfiguration fails loudly rather than being
 * ignored.
 */
export function parseAcceptedMcpOrigins(
  siteUrl: string,
  extraOrigins: string | undefined
): string[] {
  const extras = (extraOrigins ?? "")
    .split(EXTRA_ORIGINS_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .map(toOrigin);
  return Array.from(new Set([new URL(siteUrl).origin, ...extras]));
}

/** SITE_URL plus CAREEROTTER_MCP_EXTRA_ORIGINS, read at call time. */
export function getAcceptedMcpOrigins(): string[] {
  return parseAcceptedMcpOrigins(
    SITE_URL,
    process.env.CAREEROTTER_MCP_EXTRA_ORIGINS
  );
}

const TRAILING_DOT = /\.$/;

/** Lowercase and without a trailing dot, which names the same host in DNS. */
export function bareHostname(hostname: string): string {
  return hostname.toLowerCase().replace(TRAILING_DOT, "");
}

/**
 * Every hostname that serves this app or redirects to it: the accepted MCP
 * origins' hosts and the legacy hosts that 301 here. An OAuth redirect must
 * never land on one of them, where page analytics would capture the code.
 */
export function getOwnHostnames(): string[] {
  const originHosts = getAcceptedMcpOrigins().map((origin) => new URL(origin).hostname);
  return Array.from(new Set([...originHosts, ...LEGACY_HOSTS].map(bareHostname)));
}

/** The MCP resource URL on an origin: `<origin>/api/mcp`. */
export function mcpResourceUrl(origin: string): string {
  return `${origin}${MCP_RESOURCE_PATH}`;
}

/**
 * The resource stored when an authorization request has no `resource`
 * parameter, and the one advertised when the request origin isn't accepted.
 */
export const CANONICAL_MCP_RESOURCE = mcpResourceUrl(SITE_URL);

/** Every accepted MCP resource URL, one per accepted origin. */
export function getAcceptedMcpResources(): string[] {
  return getAcceptedMcpOrigins().map(mcpResourceUrl);
}
