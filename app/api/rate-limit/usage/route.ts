import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { RateLimitService } from "@/lib/services/rate-limit.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    if (!user) {
      loggerService.warn('Unauthorized rate limit usage access', {
        category: LogCategory.SECURITY,
        action: 'rate_limit_usage_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const feature = searchParams.get("feature");

    if (!feature) {
      loggerService.warn('Rate limit usage missing feature', {
        category: LogCategory.API,
        userId: user.id,
        action: 'rate_limit_usage_missing_feature',
        duration: Date.now() - startTime
      });
      return NextResponse.json(
        { error: "Feature name is required" },
        { status: 400 }
      );
    }

    const rateLimitService = new RateLimitService();
    const stats = await rateLimitService.getUsageStats(user.id, feature);

    loggerService.info('Rate limit usage stats retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'rate_limit_usage_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        feature,
        currentUsage: stats.currentUsage,
        resetAt: stats.resetAt,
        totalRequests: stats.totalRequests,
        windowType: stats.windowType
      }
    });
    
    return NextResponse.json(stats);
  } catch (error) {
    loggerService.error('Usage stats error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'rate_limit_usage_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to get usage stats" },
      { status: 500 }
    );
  }
}