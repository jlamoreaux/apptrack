import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RateLimitService, type AIFeature } from "@/lib/services/rate-limit.service";
import { getUserSubscriptionTier } from "@/lib/middleware/rate-limit.middleware";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      loggerService.warn('Unauthorized AI usage access attempt', {
        category: LogCategory.SECURITY,
        action: 'ai_usage_unauthorized'
      });
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const feature = searchParams.get('feature') as AIFeature | null;
    
    // Get user's subscription tier
    const subscriptionTier = await getUserSubscriptionTier(user.id);

    // Get rate limit service instance
    const rateLimitService = RateLimitService.getInstance();

    // Get usage stats
    if (feature) {
      // Get stats for specific feature
      const stats = await rateLimitService.getUsageStats(
        user.id,
        feature,
        subscriptionTier
      );
      
      loggerService.info('AI usage stats retrieved for feature', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'ai_usage_stats_feature_retrieved',
        duration: Date.now() - startTime,
        metadata: {
          feature,
          subscriptionTier,
          usage: stats.usage,
          limit: stats.limit
        }
      });
      
      return NextResponse.json(stats);
    } else {
      // Get stats for all features
      const allStats = await rateLimitService.getAllUsageStats(
        user.id,
        subscriptionTier
      );
      
      loggerService.info('AI usage stats retrieved for all features', {
        category: LogCategory.BUSINESS,
        userId: user.id,
        action: 'ai_usage_stats_all_retrieved',
        duration: Date.now() - startTime,
        metadata: {
          subscriptionTier,
          featuresCount: Object.keys(allStats).length
        }
      });
      
      return NextResponse.json(allStats);
    }
  } catch (error) {
    loggerService.error('Error fetching usage stats', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'ai_usage_stats_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json(
      { error: "Failed to fetch usage statistics" },
      { status: 500 }
    );
  }
}