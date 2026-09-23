/**
 * OAuth 2.0 dynamic client registration (RFC 7591) for the MCP server.
 *
 * POST /api/oauth/register -> 201 with the client's information; the
 *                             client_secret (confidential clients only) is
 *                             returned here and never again
 * OPTIONS                  -> CORS preflight
 *
 * 404 unless isMcpOAuthEnabled(). Rate limited per IP and globally; both
 * limits fail closed (503) when Redis is unavailable, because registration
 * isn't latency-sensitive and failing open would remove the only bound on
 * rows. Validation and storage live in lib/auth/oauth/clients.ts. Secrets are
 * never logged.
 */

import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { registerClient, type RegisteredClient } from "@/lib/auth/oauth/clients";
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
import { clientIp, readBodyWithinLimit } from "@/lib/http/request";
import { createRateLimiter } from "@/lib/redis/client";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { withTimeout } from "@/lib/utils/with-timeout";

export const runtime = "nodejs";

const HTTP = {
  created: 201,
  badRequest: 400,
  payloadTooLarge: 413,
  tooManyRequests: 429,
  internalError: 500,
  unavailable: 503,
} as const;

const MS_PER_SECOND = 1000;
const MIN_RETRY_AFTER_SECONDS = 1;
const REGISTERED_ACTION = "mcp_oauth_client_registered";

const RESPONSE_HEADERS = {
  ...AGENT_OAUTH_ENDPOINT_CORS_HEADERS,
  ...AGENT_OAUTH_NO_STORE_HEADERS,
} as const;

const MESSAGES = {
  contentType: "Content-Type must be application/json",
  tooLarge: `Request body must be at most ${AGENT_OAUTH_LIMITS.requestBodyMaxBytes} bytes`,
  invalidJson: "Request body must be valid JSON",
  unavailable: "Registration is temporarily unavailable",
  serverError: "Registration failed",
} as const;

type RegistrationLimit = "per_ip" | "global";

type LimitVerdict =
  | { kind: "allowed" }
  | { kind: "limited"; retryAfterSeconds: number }
  | { kind: "unavailable" };

const perIpLimiter = createRateLimiter(
  AGENT_OAUTH_RATE_LIMITS.registerPerIp.tokens,
  AGENT_OAUTH_RATE_LIMITS.registerPerIp.window
);
const globalLimiter = createRateLimiter(
  AGENT_OAUTH_RATE_LIMITS.registerGlobal.tokens,
  AGENT_OAUTH_RATE_LIMITS.registerGlobal.window
);

export async function POST(request: Request): Promise<Response> {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  const limited = await rateLimitResponse(clientIp(request.headers));
  if (limited !== null) return limited;
  if (!isJsonContentType(request.headers)) {
    return rejected("invalid_client_metadata", MESSAGES.contentType);
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const result = await registerClient(createAdminClient(), body.value);
  if (!result.ok) {
    return result.kind === "db" ? serverError() : rejected(result.error, result.description);
  }
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
  const text = await readBodyWithinLimit(request, AGENT_OAUTH_LIMITS.requestBodyMaxBytes);
  if (text === null) {
    const tooLarge = registrationError(
      "invalid_client_metadata",
      MESSAGES.tooLarge,
      HTTP.payloadTooLarge
    );
    return { ok: false, response: tooLarge };
  }
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false, response: rejected("invalid_client_metadata", MESSAGES.invalidJson) };
  }
}

// ── rate limits ────────────────────────────────────────────────────────────

type RateLimiter = NonNullable<ReturnType<typeof createRateLimiter>>;

/**
 * Charges the per-IP bucket, then the global one, so one IP over its limit
 * doesn't spend the global quota. Null when the request may proceed.
 */
async function rateLimitResponse(ip: string): Promise<Response | null> {
  const now = Date.now();
  const perIpKey = `${AGENT_OAUTH_RATE_LIMITS.registerPerIp.keyPrefix}${ip}`;
  const perIp = await checkLimit(perIpLimiter, perIpKey, now);
  if (perIp.kind !== "allowed") return limitFailure(perIp, "per_ip");
  const globalKey = AGENT_OAUTH_RATE_LIMITS.registerGlobal.keyPrefix;
  const global = await checkLimit(globalLimiter, globalKey, now);
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
    const seconds = Math.ceil((outcome.value.reset - now) / MS_PER_SECOND);
    return { kind: "limited", retryAfterSeconds: Math.max(seconds, MIN_RETRY_AFTER_SECONDS) };
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
  trackAfterResponse({ action: REGISTERED_ACTION }, () =>
    captureServerEvent(client.clientId, CAREEROTTER_EVENT_NAMES.MCP_OAUTH_CLIENT_REGISTERED, {
      auth_method: client.tokenEndpointAuthMethod,
      redirect_kinds: Array.from(new Set(client.redirectKinds)).sort(),
      $process_person_profile: false,
    })
  );
}
