/**
 * CareerOtter OAuth 2.1 authorization server for the MCP server.
 *
 * The lists, lifetimes, limits and function outcomes here mirror
 * schemas/migrations/045_mcp_oauth.sql; __tests__/constants/agent-oauth.test.ts
 * guards against drift. Scopes are the PAT scopes (AGENT_TOKEN_SCOPES).
 */

import {
  AGENT_RATE_LIMITS,
  MCP_BASE_PATH,
  type AgentRateLimit,
} from "@/lib/constants/agent-access";
import {
  DEFAULT_AGENT_TOKEN_SCOPES,
  MCP_ENDPOINT_PATH,
} from "@/lib/constants/agent-access-ui";
import { SITE_URL } from "@/lib/constants/site-config";

// ── Gating ──────────────────────────────────────────────────────────────────

const ENV_FLAG_ON = "1";
const VERCEL_PREVIEW_ENV = "preview";

/**
 * True only when both CAREEROTTER_ENABLED and CAREEROTTER_MCP_OAUTH_ENABLED
 * are "1" and this isn't a Vercel preview. On a preview the issuer would still
 * be the production origin, and previews may share the production database,
 * so tokens would work against unreviewed code. Read at call time so runtime
 * env decides.
 */
export function isMcpOAuthEnabled(): boolean {
  return (
    process.env.CAREEROTTER_ENABLED === ENV_FLAG_ON &&
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
  // new pair instead of revoking the grant (RFC 9700 §4.14.2).
  refreshGraceWindow: 60,
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
  redirectUrisMax: 5,
  redirectUriMaxLength: 512,
  // Code points, matching char_length in the CHECK.
  clientNameMax: 100,
  clientUriMaxLength: 512,
  resourceMaxLength: 512,
  stateMaxLength: 512,
  scopeParamMaxLength: 256,
  requestBodyMaxBytes: 16 * 1024,
} as const;

export const AGENT_OAUTH_DEFAULT_CLIENT_NAME = "Unnamed app";

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

export const AGENT_OAUTH_GRANT_TYPES = [
  "authorization_code",
  "refresh_token",
] as const;
export type AgentOAuthGrantType = (typeof AGENT_OAUTH_GRANT_TYPES)[number];

// Registration must include this one; the refresh grant is optional.
export const REQUIRED_AGENT_OAUTH_GRANT_TYPE =
  "authorization_code" satisfies AgentOAuthGrantType;

export const AGENT_OAUTH_RESPONSE_TYPE = "code";

export const AGENT_OAUTH_TOKEN_KINDS = ["access", "refresh"] as const;
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
export const AGENT_OAUTH_DEFAULT_SCOPE_HINT = DEFAULT_AGENT_TOKEN_SCOPES.join(" ");

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

// ── Database functions (migration 045) ──────────────────────────────────────

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
  // A consumed refresh token came back after the grace window; the grant is
  // now revoked.
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
  registerPerIp: { tokens: 30, window: "10 m", keyPrefix: "oauth-register:ip:" },
  registerGlobal: { tokens: 2000, window: "1 d", keyPrefix: "oauth-register:global" },
  tokenPerClient: { tokens: 60, window: "1 m", keyPrefix: "oauth-token:client:" },
  // Counts only failed client authentication, since hosted clients share IPs.
  tokenAuthFailPerIp: { tokens: 600, window: "1 m", keyPrefix: "oauth-token-auth-fail:" },
  // co_oat_ failures at /api/mcp. Bounds database lookups rather than
  // guessing (tokens carry 256 bits); kept apart from the PAT lockout.
  oauthFailPerIp: { tokens: 600, window: "1 m", keyPrefix: "mcp-oauth-fail:" },
  // Same numbers as a PAT, keyed by grant id.
  perGrant: { ...AGENT_RATE_LIMITS.perToken, keyPrefix: "mcp-oauth-grant:" },
} as const satisfies Record<string, AgentRateLimit>;

// ── Endpoints ───────────────────────────────────────────────────────────────

export const MCP_RESOURCE_PATH = `${MCP_BASE_PATH}${MCP_ENDPOINT_PATH}`;

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

const ORIGIN_PROTOCOLS: readonly string[] = ["http:", "https:"];
const EXTRA_ORIGINS_SEPARATOR = ",";

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
