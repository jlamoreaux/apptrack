import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RateLimitService } from "@/lib/services/rate-limit.service";
import { getUserSubscriptionTier } from "@/lib/middleware/rate-limit.middleware";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.warn('Unauthorized rate limit check', {
        category: LogCategory.SECURITY,
        action: 'rate_limit_check_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get feature from query params
    const { searchParams } = new URL(request.url);
    const feature = searchParams.get('feature');
    
    if (!feature) {
      loggerService.warn('Rate limit check missing feature', {
        category: LogCategory.API,
        userId: user.id,
        action: 'rate_limit_check_missing_feature',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Feature parameter is required" },
        { status: 400 }
      );
    }

    // Get user's subscription tier
    const subscriptionTier = await getUserSubscriptionTier(user.id);

    // Create rate limit service instance
    const rateLimitService = new RateLimitService();

    // Check rate limit
    const result = await rateLimitService.checkLimit(
      user.id,
      feature as any,
      subscriptionTier
    );

    loggerService.info('Rate limit checked', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'rate_limit_checked',
      duration: Date.now() - startTime,
      metadata: {
        feature,
        subscriptionTier,
        allowed: result.allowed,
        remaining: result.remaining,
        limit: result.limit,
        resetAt: result.resetAt
      }
    });
    
    return NextResponse.json(result);
  } catch (error) {
    loggerService.error('Error checking rate limit', error, {
      category: LogCategory.API,
      action: 'rate_limit_check_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to check rate limit" },
      { status: 500 }
    );
  }
}
