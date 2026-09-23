/**
 * What the token and revocation endpoints share: reading the form body, RFC
 * 6749 §5.2 error responses, and client authentication with its rate limits.
 *
 * Rate limits (both endpoints share both buckets; every check fails closed
 * with 503):
 * - Failed authentication, per IP (an IPv6 client by its /64). Checked
 *   without charging before the client lookup, so an IP over it gets 429
 *   without touching the database, and charged when authentication fails. A
 *   failure is never charged to the client_id it named. Successful requests
 *   aren't charged here, because hosted clients share IPs; an IP over the
 *   limit is refused even for a client that would have authenticated.
 * - Per client, charged only after authentication succeeds. A confidential
 *   client proved its secret, so its bucket is keyed on its client_id alone.
 *   A public client (auth method none) proved only that it knows a public
 *   client_id, so its bucket is keyed on the client_id and the caller's IP:
 *   someone else sending that id can exhaust only their own IP's slice, never
 *   the real client's.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateClient } from "@/lib/auth/oauth/clients";
import { isFormContentType, oauthJson } from "@/lib/auth/oauth/http";
import {
  checkOAuthRateLimit,
  oauthRateLimitedResponse,
  oauthUnavailableResponse,
  peekOAuthRateLimit,
} from "@/lib/auth/oauth/rate-limit";
import {
  AGENT_OAUTH_BASIC_CHALLENGE,
  AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  AGENT_OAUTH_FORM_CONTENT_TYPE,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_NO_STORE_HEADERS,
  AGENT_OAUTH_RATE_LIMITS,
  AGENT_OAUTH_TOKEN_PARAMS,
  type AgentOAuthTokenErrorCode,
} from "@/lib/constants/agent-oauth";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import { clientIp, rateLimitIpKey, readBodyWithinLimit } from "@/lib/http/request";
import { createRateLimiter } from "@/lib/redis/client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type {
  AgentOAuthClientAuthentication,
  AgentOAuthClientRecord,
  AgentOAuthTokenError,
  OAuthLimitVerdict,
  TokenEndpointName,
  TokenEndpointStep,
} from "@/types";

/** CORS plus no-store (RFC 6749 §5.1), on every token and revocation response. */
export const TOKEN_ENDPOINT_HEADERS = {
  ...AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  ...AGENT_OAUTH_NO_STORE_HEADERS,
} as const;

const MESSAGES = {
  contentType: `Content-Type must be ${AGENT_OAUTH_FORM_CONTENT_TYPE}`,
  tooLarge: `Request body must be at most ${AGENT_OAUTH_LIMITS.requestBodyMaxBytes} bytes`,
  unreadable: "Request body could not be read",
  repeated: "Request parameters must not be repeated",
  invalidClient: "Client authentication failed",
  unavailable: "The authorization server is temporarily unavailable",
} as const;

const RATE_LIMIT_LOG = { action: "mcp_oauth_token_rate_limit_error" } as const;
const SINGLE_VALUED_PARAMS: readonly string[] = Object.values(AGENT_OAUTH_TOKEN_PARAMS);
const PUBLIC_CLIENT_IP_KEY_SEPARATOR = ":ip:";

const perClientLimiter = createRateLimiter(
  AGENT_OAUTH_RATE_LIMITS.tokenPerClient.tokens,
  AGENT_OAUTH_RATE_LIMITS.tokenPerClient.window
);
const authFailPerIpLimiter = createRateLimiter(
  AGENT_OAUTH_RATE_LIMITS.tokenAuthFailPerIp.tokens,
  AGENT_OAUTH_RATE_LIMITS.tokenAuthFailPerIp.window
);

// ── responses ──────────────────────────────────────────────────────────────

/** An RFC 6749 §5.2 error body with the endpoint headers; 400 unless given. */
export function tokenErrorResponse(
  error: AgentOAuthTokenErrorCode,
  description: string,
  status: number = HTTP_STATUS.BAD_REQUEST,
  extraHeaders: Readonly<Record<string, string>> = {}
): Response {
  const body: AgentOAuthTokenError = { error, error_description: description };
  return oauthJson(body, status, { ...TOKEN_ENDPOINT_HEADERS, ...extraHeaders });
}

/** 503 temporarily_unavailable with Retry-After. */
export function tokenEndpointUnavailable(): Response {
  return oauthUnavailableResponse(MESSAGES.unavailable, TOKEN_ENDPOINT_HEADERS);
}

// ── body ───────────────────────────────────────────────────────────────────

/**
 * The first parameter sent more than once (RFC 6749 §3.2), as its error: a
 * repeated resource is invalid_target (we serve one resource, RFC 8707 §2),
 * anything else invalid_request.
 */
function repeatedParamResponse(form: URLSearchParams): Response | null {
  const repeated = SINGLE_VALUED_PARAMS.find((name) => form.getAll(name).length > 1);
  if (repeated === undefined) return null;
  const error = repeated === AGENT_OAUTH_TOKEN_PARAMS.resource ? "invalid_target" : "invalid_request";
  return tokenErrorResponse(error, `${MESSAGES.repeated}: ${repeated}`);
}

/**
 * The form-encoded body within the 16 KB cap, with no repeated parameter.
 * A wrong content type or unreadable body is 400 invalid_request; an
 * oversize one is 413.
 */
export async function readTokenEndpointForm(
  request: Request
): Promise<TokenEndpointStep<URLSearchParams>> {
  if (!isFormContentType(request.headers)) {
    return { ok: false, response: tokenErrorResponse("invalid_request", MESSAGES.contentType) };
  }
  const read = await readBodyWithinLimit(request, AGENT_OAUTH_LIMITS.requestBodyMaxBytes);
  if (!read.ok) {
    const response =
      read.reason === "too_large"
        ? tokenErrorResponse("invalid_request", MESSAGES.tooLarge, HTTP_STATUS.PAYLOAD_TOO_LARGE)
        : tokenErrorResponse("invalid_request", MESSAGES.unreadable);
    return { ok: false, response };
  }
  const form = new URLSearchParams(read.text);
  const repeated = repeatedParamResponse(form);
  return repeated === null ? { ok: true, value: form } : { ok: false, response: repeated };
}

// ── client authentication ──────────────────────────────────────────────────

function limitFailure(
  verdict: Exclude<OAuthLimitVerdict, { kind: "allowed" }>,
  bucket: "per_client" | "auth_fail_per_ip",
  endpoint: TokenEndpointName
): Response {
  if (verdict.kind === "unavailable") return tokenEndpointUnavailable();
  loggerService.warn("OAuth token endpoint rate limited", {
    category: LogCategory.SECURITY,
    action: "mcp_oauth_token_rate_limited",
    metadata: { bucket, endpoint },
  });
  return oauthRateLimitedResponse(verdict.retryAfterSeconds, TOKEN_ENDPOINT_HEADERS);
}

/** The failed-auth bucket's key for the caller's IP (an IPv6 client by its /64). */
function authFailKey(ipKey: string): string {
  return `${AGENT_OAUTH_RATE_LIMITS.tokenAuthFailPerIp.keyPrefix}${ipKey}`;
}

/**
 * The per-client bucket's key: the client_id for a confidential client; for a
 * public one, the client_id and the caller's IP key, since anyone can present
 * a public client_id.
 */
function perClientKey(client: AgentOAuthClientRecord, ipKey: string): string {
  const base = `${AGENT_OAUTH_RATE_LIMITS.tokenPerClient.keyPrefix}${client.client_id}`;
  return client.token_endpoint_auth_method === "none"
    ? `${base}${PUBLIC_CLIENT_IP_KEY_SEPARATOR}${ipKey}`
    : base;
}

/** Charges the failed-auth bucket for this IP, then answers 401 (or 429/503). */
async function failedAuthentication(
  failure: Extract<AgentOAuthClientAuthentication, { kind: "invalid_client" }>,
  ipKey: string,
  endpoint: TokenEndpointName
): Promise<Response> {
  loggerService.warn("OAuth client authentication failed", {
    category: LogCategory.SECURITY,
    action: "mcp_oauth_client_auth_failed",
    metadata: { reason: failure.reason, endpoint },
  });
  const verdict = await checkOAuthRateLimit(authFailPerIpLimiter, authFailKey(ipKey), Date.now(), RATE_LIMIT_LOG);
  if (verdict.kind !== "allowed") return limitFailure(verdict, "auth_fail_per_ip", endpoint);
  const challenge: Record<string, string> = failure.usedBasic
    ? { "WWW-Authenticate": AGENT_OAUTH_BASIC_CHALLENGE }
    : {};
  return tokenErrorResponse("invalid_client", MESSAGES.invalidClient, HTTP_STATUS.UNAUTHORIZED, challenge);
}

/**
 * Authenticate the client (RFC 6749 §2.3) and charge the matching rate-limit
 * bucket. An IP already over its failed-auth limit is refused (429) before the
 * client is looked up. On success the client's own bucket has been charged; on
 * failure the response is ready to send: 401 invalid_client (with a Basic
 * challenge when Basic was used), 429, or 503 when the database or Redis is
 * unavailable.
 */
export async function authenticateEndpointClient(
  admin: SupabaseClient,
  headers: Headers,
  form: URLSearchParams,
  endpoint: TokenEndpointName
): Promise<TokenEndpointStep<AgentOAuthClientRecord>> {
  const ipKey = rateLimitIpKey(clientIp(headers));
  const failures = await peekOAuthRateLimit(authFailPerIpLimiter, authFailKey(ipKey), Date.now(), RATE_LIMIT_LOG);
  if (failures.kind !== "allowed") {
    return { ok: false, response: limitFailure(failures, "auth_fail_per_ip", endpoint) };
  }
  const authentication = await authenticateClient(admin, headers, form);
  if (!authentication.ok) {
    const response =
      authentication.kind === "unavailable"
        ? tokenEndpointUnavailable()
        : await failedAuthentication(authentication, ipKey, endpoint);
    return { ok: false, response };
  }
  const client = authentication.client;
  const verdict = await checkOAuthRateLimit(perClientLimiter, perClientKey(client, ipKey), Date.now(), RATE_LIMIT_LOG);
  if (verdict.kind !== "allowed") {
    return { ok: false, response: limitFailure(verdict, "per_client", endpoint) };
  }
  return { ok: true, value: client };
}
