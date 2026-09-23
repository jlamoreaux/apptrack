/**
 * OAuth 2.0 dynamic client registration (RFC 7591) for the MCP server.
 *
 * POST /api/oauth/register -> 201 with the client's information; the
 *                             client_secret (confidential clients only) is
 *                             returned here and never again
 * OPTIONS                  -> CORS preflight
 *
 * 404 unless isMcpOAuthEnabled(). Rate limited per IP (an IPv6 client by its
 * /64), every request, per 10 minutes and per day; then, only for a
 * registration that passed validation, globally per day. Every limit fails
 * closed (503) when Redis is unavailable, because registration isn't
 * latency-sensitive and failing open would remove the only bound on rows.
 * Validation and storage live in lib/auth/oauth/clients.ts. Secrets are never
 * logged.
 */

import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { registerClient, validateClientRegistration } from "@/lib/auth/oauth/clients";
import {
  isJsonContentType,
  oauthJson,
  oauthNotFound,
  oauthPreflight,
} from "@/lib/auth/oauth/http";
import { trackAfterResponse } from "@/lib/careerotter/domain-result";
import { MCP_UNAVAILABLE_RETRY_AFTER_SECONDS } from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_CLIENT_SECRET_NEVER_EXPIRES,
  AGENT_OAUTH_DEADLINES_MS,
  AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  AGENT_OAUTH_LIMITS,
  AGENT_OAUTH_NO_STORE_HEADERS,
  AGENT_OAUTH_RATE_LIMITED_ERROR,
  AGENT_OAUTH_RATE_LIMITS,
  AGENT_OAUTH_RESPONSE_TYPE,
  isMcpOAuthEnabled,
  type AgentOAuthRegistrationErrorCode,
} from "@/lib/constants/agent-oauth";
import {
  clientIp,
  rateLimitIpKey,
  readBodyWithinLimit,
  retryAfterSeconds,
} from "@/lib/http/request";
import { createRateLimiter } from "@/lib/redis/client";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { withTimeout } from "@/lib/utils/with-timeout";
import type { RegisteredClient } from "@/types";

export const runtime = "nodejs";

const HTTP = {
  created: 201,
  badRequest: 400,
  payloadTooLarge: 413,
  tooManyRequests: 429,
  internalError: 500,
  unavailable: 503,
} as const;

const RESPONSE_HEADERS = {
  ...AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  ...AGENT_OAUTH_NO_STORE_HEADERS,
} as const;

const MESSAGES = {
  contentType: "Content-Type must be application/json",
  tooLarge: `Request body must be at most ${AGENT_OAUTH_LIMITS.requestBodyMaxBytes} bytes`,
  invalidJson: "Request body must be valid JSON",
  unreadable: "Request body could not be read",
  unavailable: "Registration is temporarily unavailable",
  serverError: "Registration failed",
} as const;

type RegistrationLimit = "per_ip" | "per_ip_daily" | "global";

type LimitVerdict =
  | { kind: "allowed" }
  | { kind: "limited"; retryAfterSeconds: number }
  | { kind: "unavailable" };

const perIpLimiter = createRateLimiter(
  AGENT_OAUTH_RATE_LIMITS.registerPerIp.tokens,
  AGENT_OAUTH_RATE_LIMITS.registerPerIp.window
);
const perIpDailyLimiter = createRateLimiter(
  AGENT_OAUTH_RATE_LIMITS.registerPerIpDaily.tokens,
  AGENT_OAUTH_RATE_LIMITS.registerPerIpDaily.window
);
const globalLimiter = createRateLimiter(
  AGENT_OAUTH_RATE_LIMITS.registerGlobal.tokens,
  AGENT_OAUTH_RATE_LIMITS.registerGlobal.window
);

export async function POST(request: Request): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  const ipLimited = await perIpLimitResponse(rateLimitIpKey(clientIp(request.headers)));
  if (ipLimited !== null) return ipLimited;
  if (!isJsonContentType(request.headers)) {
    return rejected("invalid_client_metadata", MESSAGES.contentType);
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const validation = validateClientRegistration(body.value);
  if (!validation.ok) return rejected(validation.error, validation.description);
  const globalLimited = await globalLimitResponse();
  if (globalLimited !== null) return globalLimited;

  const result = await registerClient(createAdminClient(), validation.registration);
  if (!result.ok) return serverError();
  trackRegistration(result.client);
  return oauthJson(registrationResponseBody(result.client), HTTP.created, RESPONSE_HEADERS);
}

export async function OPTIONS(): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  return oauthPreflight(AGENT_OAUTH_ENDPOINT_CORS_HEADERS);
}

// ── body ───────────────────────────────────────────────────────────────────

async function readJsonBody(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const read = await readBodyWithinLimit(request, AGENT_OAUTH_LIMITS.requestBodyMaxBytes);
  if (!read.ok) {
    const response =
      read.reason === "too_large"
        ? registrationError("invalid_client_metadata", MESSAGES.tooLarge, HTTP.payloadTooLarge)
        : rejected("invalid_client_metadata", MESSAGES.unreadable);
    return { ok: false, response };
  }
  try {
    const value: unknown = JSON.parse(read.text);
    return { ok: true, value };
  } catch {
    return { ok: false, response: rejected("invalid_client_metadata", MESSAGES.invalidJson) };
  }
}

// ── rate limits ────────────────────────────────────────────────────────────

type RateLimiter = NonNullable<ReturnType<typeof createRateLimiter>>;

/**
 * Charges the 10-minute per-IP bucket, then the daily one, for every request.
 * `ipKey` is the client's rate-limit key (an IPv6 client's /64). Null when
 * the request may proceed.
 */
async function perIpLimitResponse(ipKey: string): Promise<Response | null> {
  const now = Date.now();
  const perIpKey = `${AGENT_OAUTH_RATE_LIMITS.registerPerIp.keyPrefix}${ipKey}`;
  const perIp = await checkLimit(perIpLimiter, perIpKey, now);
  if (perIp.kind !== "allowed") return limitFailure(perIp, "per_ip");
  const dailyKey = `${AGENT_OAUTH_RATE_LIMITS.registerPerIpDaily.keyPrefix}${ipKey}`;
  const daily = await checkLimit(perIpDailyLimiter, dailyKey, now);
  if (daily.kind !== "allowed") return limitFailure(daily, "per_ip_daily");
  return null;
}

/**
 * Charges the global bucket. Called only for a valid registration about to be
 * stored, so neither an IP over its own limit nor a malformed request spends
 * the global quota. Null when the request may proceed.
 */
async function globalLimitResponse(): Promise<Response | null> {
  const globalKey = AGENT_OAUTH_RATE_LIMITS.registerGlobal.keyPrefix;
  const global = await checkLimit(globalLimiter, globalKey, Date.now());
  if (global.kind !== "allowed") return limitFailure(global, "global");
  return null;
}

/** Fails closed: no Redis, an error or a slow answer is `unavailable`. */
async function checkLimit(
  limiter: RateLimiter | null,
  key: string,
  now: number
): Promise<LimitVerdict> {
  if (limiter === null) {
    return limiterUnavailable("Registration rate limiter is not configured", undefined);
  }
  try {
    const outcome = await withTimeout(limiter.limit(key), AGENT_OAUTH_DEADLINES_MS.rateLimit);
    if (outcome.timedOut) return limiterUnavailable("Registration rate limiter timed out", undefined);
    if (outcome.value.success) return { kind: "allowed" };
    return { kind: "limited", retryAfterSeconds: retryAfterSeconds(outcome.value.reset, now) };
  } catch (error) {
    return limiterUnavailable("Registration rate limiter failed", error);
  }
}

function limiterUnavailable(message: string, error: unknown): LimitVerdict {
  loggerService.error(message, error, {
    category: LogCategory.SECURITY,
    action: "mcp_oauth_register_rate_limit_error",
  });
  return { kind: "unavailable" };
}

function limitFailure(
  verdict: Exclude<LimitVerdict, { kind: "allowed" }>,
  limit: RegistrationLimit
): Response {
  if (verdict.kind === "unavailable") {
    return oauthJson(
      { error: "temporarily_unavailable", error_description: MESSAGES.unavailable },
      HTTP.unavailable,
      { ...RESPONSE_HEADERS, "Retry-After": String(MCP_UNAVAILABLE_RETRY_AFTER_SECONDS) }
    );
  }
  loggerService.warn("OAuth client registration rate limited", {
    category: LogCategory.SECURITY,
    action: "mcp_oauth_register_rate_limited",
    metadata: { limit },
  });
  return oauthJson(AGENT_OAUTH_RATE_LIMITED_ERROR, HTTP.tooManyRequests, {
    ...RESPONSE_HEADERS,
    "Retry-After": String(verdict.retryAfterSeconds),
  });
}

// ── responses ──────────────────────────────────────────────────────────────

function registrationError(
  error: AgentOAuthRegistrationErrorCode,
  description: string,
  status: number
): Response {
  return oauthJson({ error, error_description: description }, status, RESPONSE_HEADERS);
}

function serverError(): Response {
  return oauthJson(
    { error: "server_error", error_description: MESSAGES.serverError },
    HTTP.internalError,
    RESPONSE_HEADERS
  );
}

/** A 400 in the RFC 7591 §3.2.2 shape, with a security log. */
function rejected(error: AgentOAuthRegistrationErrorCode, description: string): Response {
  loggerService.warn("OAuth client registration rejected", {
    category: LogCategory.SECURITY,
    action: "mcp_oauth_register_rejected",
    metadata: { error, description },
  });
  return registrationError(error, description, HTTP.badRequest);
}

/** RFC 7591 §3.2.1. Only the fields we store are echoed. */
function registrationResponseBody(client: RegisteredClient): Record<string, unknown> {
  const secret =
    client.clientSecret === null
      ? {}
      : {
          client_secret: client.clientSecret,
          client_secret_expires_at: AGENT_OAUTH_CLIENT_SECRET_NEVER_EXPIRES,
        };
  return {
    client_id: client.clientId,
    client_id_issued_at: client.clientIdIssuedAt,
    ...secret,
    redirect_uris: client.redirectUris,
    grant_types: client.grantTypes,
    response_types: [AGENT_OAUTH_RESPONSE_TYPE],
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
    client_name: client.clientName,
  };
}

// captureServerEvent never rejects, and trackAfterResponse logs a failure to
// schedule. There's no user yet, so the client id is the distinct id, without
// a person profile.
function trackRegistration(client: RegisteredClient): void {
  trackAfterResponse({ action: CAREEROTTER_EVENT_NAMES.MCP_OAUTH_CLIENT_REGISTERED }, () =>
    captureServerEvent(client.clientId, CAREEROTTER_EVENT_NAMES.MCP_OAUTH_CLIENT_REGISTERED, {
      auth_method: client.tokenEndpointAuthMethod,
      redirect_kinds: Array.from(new Set(client.redirectKinds)).sort(),
      $process_person_profile: false,
    })
  );
}
