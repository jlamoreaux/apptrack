/**
 * What the token and revocation endpoints share: reading the form body, RFC
 * 6749 §5.2 error responses, and client authentication with its rate limits.
 *
 * Rate limits: a failed client authentication is charged only to the
 * requesting IP's failed-auth bucket (an IPv6 client by its /64), never to the
 * client_id it named, so a caller can't drain another client's quota by
 * sending its id with a bad secret. A request that authenticated is charged
 * to its client's bucket and never to the IP's, because hosted clients share
 * IPs. Both endpoints share both buckets. Every check fails closed (503).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateClient, type ClientAuthentication } from "@/lib/auth/oauth/clients";
import { isFormContentType, oauthJson } from "@/lib/auth/oauth/http";
import {
  checkOAuthRateLimit,
  oauthRateLimitedResponse,
  oauthUnavailableResponse,
  type OAuthLimitVerdict,
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
import type { AgentOAuthClientRecord, AgentOAuthTokenError } from "@/types";

/** Which endpoint is asking, for logs. */
export type TokenEndpointName = "token" | "revoke";

export type TokenEndpointStep<T> = { ok: true; value: T } | { ok: false; response: Response };

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

/** A form parameter's value, with an empty one read as absent. */
export function formParam(form: URLSearchParams, name: string): string | null {
  const value = form.get(name);
  return value === null || value === "" ? null : value;
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

/** Charges the failed-auth bucket for this IP, then answers 401 (or 429/503). */
async function failedAuthentication(
  failure: Extract<ClientAuthentication, { kind: "invalid_client" }>,
  headers: Headers,
  endpoint: TokenEndpointName
): Promise<Response> {
  loggerService.warn("OAuth client authentication failed", {
    category: LogCategory.SECURITY,
    action: "mcp_oauth_client_auth_failed",
    metadata: { reason: failure.reason, endpoint },
  });
  const ipKey = `${AGENT_OAUTH_RATE_LIMITS.tokenAuthFailPerIp.keyPrefix}${rateLimitIpKey(clientIp(headers))}`;
  const verdict = await checkOAuthRateLimit(authFailPerIpLimiter, ipKey, Date.now(), RATE_LIMIT_LOG);
  if (verdict.kind !== "allowed") return limitFailure(verdict, "auth_fail_per_ip", endpoint);
  const challenge: Record<string, string> = failure.usedBasic
    ? { "WWW-Authenticate": AGENT_OAUTH_BASIC_CHALLENGE }
    : {};
  return tokenErrorResponse("invalid_client", MESSAGES.invalidClient, HTTP_STATUS.UNAUTHORIZED, challenge);
}

/**
 * Authenticate the client (RFC 6749 §2.3) and charge the matching rate-limit
 * bucket. On success the client's own bucket has been charged; on failure the
 * response is ready to send: 401 invalid_client (with a Basic challenge when
 * Basic was used), 429, or 503 when the database or Redis is unavailable.
 */
export async function authenticateEndpointClient(
  admin: SupabaseClient,
  headers: Headers,
  form: URLSearchParams,
  endpoint: TokenEndpointName
): Promise<TokenEndpointStep<AgentOAuthClientRecord>> {
  const authentication = await authenticateClient(admin, headers, form);
  if (!authentication.ok) {
    const response =
      authentication.kind === "unavailable"
        ? tokenEndpointUnavailable()
        : await failedAuthentication(authentication, headers, endpoint);
    return { ok: false, response };
  }
  const client = authentication.client;
  const clientKey = `${AGENT_OAUTH_RATE_LIMITS.tokenPerClient.keyPrefix}${client.client_id}`;
  const verdict = await checkOAuthRateLimit(perClientLimiter, clientKey, Date.now(), RATE_LIMIT_LOG);
  if (verdict.kind !== "allowed") {
    return { ok: false, response: limitFailure(verdict, "per_client", endpoint) };
  }
  return { ok: true, value: client };
}
