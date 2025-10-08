import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  RateLimitService,
  type AIFeature,
} from "@/lib/services/rate-limit.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export interface RateLimitOptions {
  feature: AIFeature;
  skipTracking?: boolean;
  request: NextRequest;
}

/**
 * Rate limiting middleware for AI features
 * Use this to wrap API routes that need rate limiting
 */
export async function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions
): Promise<NextResponse> {
  const request = options.request;
  const startTime = Date.now();

  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      loggerService.warn('Rate limit check failed - unauthorized', {
        category: LogCategory.SECURITY,
        action: 'rate_limit_unauthorized',
        metadata: {
          feature: options.feature,
          error: authError?.message
        }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's subscription tier
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("subscription_plans(name)")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const planName = subscription?.subscription_plans?.name?.toLowerCase();
    const subscriptionTier =
      planName?.includes("ai") || planName?.includes("coach")
        ? "ai_coach"
        : planName?.includes("pro")
        ? "pro"
        : "free";

    // Create rate limit service instance
    const rateLimitService = RateLimitService.getInstance();

    // Check rate limit
    const rateLimitResult = await rateLimitService.checkLimit(
      user.id,
      options.feature,
      subscriptionTier as any
    );


    // Add rate limit headers
    const headers = new Headers();
    headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
    headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
    headers.set("X-RateLimit-Reset", rateLimitResult.reset.toISOString());

    if (!rateLimitResult.allowed) {
      if (rateLimitResult.retryAfter) {
        headers.set("Retry-After", rateLimitResult.retryAfter.toString());
      }

      loggerService.warn('Rate limit exceeded', {
        category: LogCategory.SECURITY,
        userId: user.id,
        action: 'rate_limit_exceeded',
        metadata: {
          feature: options.feature,
          limit: rateLimitResult.limit,
          used: rateLimitResult.limit - rateLimitResult.remaining,
          subscriptionTier,
          resetAt: rateLimitResult.reset.toISOString()
        }
      });

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `You have exceeded the ${
            rateLimitResult.limit
          } requests limit for this feature. Please try again after ${rateLimitResult.reset.toLocaleTimeString()}.`,
          limit: rateLimitResult.limit,
          remaining: 0,
          resetAt: rateLimitResult.reset.toISOString(),
        },
        {
          status: 429,
          headers,
        }
      );
    }

    // Track usage (but not if explicitly skipped)
    if (!options.skipTracking) {
      // Track asynchronously to not block the request
      rateLimitService
        .trackUsage(user.id, options.feature, true)
        .catch((err) => {
          loggerService.error('Failed to track rate limit usage', err, {
            category: LogCategory.PERFORMANCE,
            userId: user.id,
            action: 'rate_limit_track_error',
            metadata: {
              feature: options.feature
            }
          });
        });
    }

    // Call the actual handler
    const response = await handler(request);
    
    const duration = Date.now() - startTime;

    // Log successful rate limit check
    loggerService.debug('Rate limit check passed', {
      category: LogCategory.API,
      userId: user.id,
      action: 'rate_limit_success',
      duration,
      metadata: {
        feature: options.feature,
        subscriptionTier,
        remaining: rateLimitResult.remaining,
        limit: rateLimitResult.limit
      }
    });

    // Add rate limit headers to successful response
    const newHeaders = new Headers(response.headers);
    headers.forEach((value, key) => {
      newHeaders.set(key, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    loggerService.error('Rate limit middleware error', error, {
      category: LogCategory.API,
      action: 'rate_limit_error',
      duration: Date.now() - startTime,
      metadata: {
        feature: options.feature
      }
    });

    // On error, be permissive but log it
    return handler(request);
  }
}

/**
 * Helper function to extract subscription tier from user
 */
export async function getUserSubscriptionTier(
  userId: string
): Promise<"free" | "pro" | "ai_coach"> {
  try {
    const supabase = await createClient();

    const { data: subscription, error } = await supabase
      .from("user_subscriptions")
      .select("subscription_plans(name)")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      loggerService.error('Failed to get user subscription for rate limit', error, {
        category: LogCategory.DATABASE,
        userId,
        action: 'get_subscription_error',
        metadata: {
          context: 'rate_limit'
        }
      });
    }

    const planName = subscription?.subscription_plans?.name?.toLowerCase();


    if (planName?.includes("ai") || planName?.includes("coach")) {
      return "ai_coach";
    } else if (planName?.includes("pro")) {
      return "pro";
    }

    return "free";
  } catch (error) {
    loggerService.error('Error getting user subscription tier', error, {
      category: LogCategory.DATABASE,
      userId,
      action: 'get_subscription_tier_error'
    });
    return "free";
  }
}
