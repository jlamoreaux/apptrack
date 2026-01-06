import { createRateLimiter, isRedisAvailable } from "@/lib/redis/client";
import { NextResponse } from "next/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

/**
 * Rate limiter for authentication endpoints
 *
 * Limits:
 * - Extension token generation: 10 requests per minute per user
 * - Extension token refresh: 20 requests per minute per user
 *
 * When Redis is unavailable, requests are allowed (fail-open for availability).
 */

// Rate limiters for different auth operations
const extensionTokenLimiter = createRateLimiter(10, "1 m");
const extensionRefreshLimiter = createRateLimiter(20, "1 m");

export type AuthRateLimitType = "extension_token" | "extension_refresh";

interface RateLimitCheckResult {
  allowed: boolean;
  response?: NextResponse;
}

/**
 * Check rate limit for an authentication operation.
 *
 * @param identifier - User ID or IP address to rate limit
 * @param type - Type of auth operation
 * @returns Result indicating if the request is allowed
 */
export async function checkAuthRateLimit(
  identifier: string,
  type: AuthRateLimitType
): Promise<RateLimitCheckResult> {
  // If Redis is not available, allow the request (fail-open)
  if (!isRedisAvailable()) {
    return { allowed: true };
  }

  const limiter =
    type === "extension_token" ? extensionTokenLimiter : extensionRefreshLimiter;

  if (!limiter) {
    return { allowed: true };
  }

  try {
    const result = await limiter.limit(identifier);

    if (!result.success) {
      loggerService.warn("Auth rate limit exceeded", {
        category: LogCategory.SECURITY,
        action: `rate_limit_${type}`,
        metadata: {
          identifier,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
        },
      });

      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: "Too many requests",
            retryAfter,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(result.limit),
              "X-RateLimit-Remaining": String(result.remaining),
              "X-RateLimit-Reset": String(result.reset),
            },
          }
        ),
      };
    }

    return { allowed: true };
  } catch (error) {
    // On rate limit check failure, allow the request (fail-open)
    loggerService.error("Rate limit check failed", error, {
      category: LogCategory.SYSTEM,
      action: `rate_limit_error_${type}`,
    });
    return { allowed: true };
  }
}
