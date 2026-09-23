/**
 * Rate limiting for the OAuth registration, token and revocation endpoints.
 * Every check fails closed: no Redis, an error or an answer slower than the
 * deadline is `unavailable`, which the endpoint answers with 503. Failing open
 * would remove the only bound on registrations and failed authentications.
 */

import { oauthJson } from "@/lib/auth/oauth/http";
import { MCP_UNAVAILABLE_RETRY_AFTER_SECONDS } from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_DEADLINES_MS,
  AGENT_OAUTH_RATE_LIMITED_ERROR,
  AGENT_OAUTH_UNAVAILABLE_ERROR,
} from "@/lib/constants/agent-oauth";
import { HTTP_STATUS } from "@/lib/constants/http-status";
import { retryAfterSeconds } from "@/lib/http/request";
import type { createRateLimiter } from "@/lib/redis/client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { withTimeout } from "@/lib/utils/with-timeout";
import type { OAuthLimitVerdict } from "@/types";

export type OAuthRateLimiter = NonNullable<ReturnType<typeof createRateLimiter>>;

/** Where a limiter failure is logged: the endpoint's action name. */
export interface OAuthLimitLogContext {
  action: string;
}

function limiterUnavailable(
  message: string,
  error: unknown,
  log: OAuthLimitLogContext
): OAuthLimitVerdict {
  loggerService.error(message, error, { category: LogCategory.SECURITY, action: log.action });
  return { kind: "unavailable" };
}

/** Charges one request to `key` on `limiter`. Never throws. */
export async function checkOAuthRateLimit(
  limiter: OAuthRateLimiter | null,
  key: string,
  now: number,
  log: OAuthLimitLogContext
): Promise<OAuthLimitVerdict> {
  if (limiter === null) {
    return limiterUnavailable("OAuth rate limiter is not configured", undefined, log);
  }
  try {
    const outcome = await withTimeout(limiter.limit(key), AGENT_OAUTH_DEADLINES_MS.rateLimit);
    if (outcome.timedOut) return limiterUnavailable("OAuth rate limiter timed out", undefined, log);
    if (outcome.value.success) return { kind: "allowed" };
    return { kind: "limited", retryAfterSeconds: retryAfterSeconds(outcome.value.reset, now) };
  } catch (error) {
    return limiterUnavailable("OAuth rate limiter failed", error, log);
  }
}

/**
 * Whether `key` on `limiter` has any requests left, without charging one:
 * `limited` once the window's quota is spent. Never throws; fails closed like
 * checkOAuthRateLimit.
 */
export async function peekOAuthRateLimit(
  limiter: OAuthRateLimiter | null,
  key: string,
  now: number,
  log: OAuthLimitLogContext
): Promise<OAuthLimitVerdict> {
  if (limiter === null) {
    return limiterUnavailable("OAuth rate limiter is not configured", undefined, log);
  }
  try {
    const outcome = await withTimeout(limiter.getRemaining(key), AGENT_OAUTH_DEADLINES_MS.rateLimit);
    if (outcome.timedOut) return limiterUnavailable("OAuth rate limiter timed out", undefined, log);
    if (outcome.value.remaining > 0) return { kind: "allowed" };
    return { kind: "limited", retryAfterSeconds: retryAfterSeconds(outcome.value.reset, now) };
  } catch (error) {
    return limiterUnavailable("OAuth rate limiter failed", error, log);
  }
}

/** 503 temporarily_unavailable with Retry-After. */
export function oauthUnavailableResponse(
  description: string,
  headers: Readonly<Record<string, string>>
): Response {
  return oauthJson(
    { error: AGENT_OAUTH_UNAVAILABLE_ERROR, error_description: description },
    HTTP_STATUS.SERVICE_UNAVAILABLE,
    { ...headers, "Retry-After": String(MCP_UNAVAILABLE_RETRY_AFTER_SECONDS) }
  );
}

/** 429 with Retry-After and the shared "rate limited" body. */
export function oauthRateLimitedResponse(
  retryAfter: number,
  headers: Readonly<Record<string, string>>
): Response {
  return oauthJson(AGENT_OAUTH_RATE_LIMITED_ERROR, HTTP_STATUS.TOO_MANY_REQUESTS, {
    ...headers,
    "Retry-After": String(retryAfter),
  });
}
