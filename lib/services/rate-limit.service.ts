import { createClient } from "@/lib/supabase/server";
import { redis, isRedisAvailable } from "@/lib/redis/client";
import { Ratelimit } from "@upstash/ratelimit";

export type AIFeature = 
  | 'resume_analysis' 
  | 'interview_prep' 
  | 'cover_letter' 
  | 'career_advice' 
  | 'job_fit_analysis';

export type SubscriptionTier = 'free' | 'pro' | 'ai_coach';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export interface UsageStats {
  feature: AIFeature;
  hourlyUsed: number;
  hourlyLimit: number;
  hourlyRemaining: number;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  resetAt: {
    hourly: Date;
    daily: Date;
  };
}

export class RateLimitService {
  private static instance: RateLimitService;
  private rateLimiters: Map<string, Ratelimit> = new Map();

  private constructor() {
    // Initialize rate limiters if Redis is available
    if (isRedisAvailable()) {
      this.initializeRateLimiters();
    }
  }

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  private initializeRateLimiters() {
    if (!redis) return;

    // Create rate limiters for different time windows
    // We'll create them dynamically based on user limits
  }

  /**
   * Check if a user can use an AI feature
   */
  public async checkLimit(
    userId: string,
    feature: AIFeature,
    subscriptionTier: SubscriptionTier = 'free'
  ): Promise<RateLimitResult> {
    try {
      // Get user's limits from database (with overrides)
      const limits = await this.getUserLimits(userId, feature, subscriptionTier);
      
      if (!limits) {
        // If no limits found, deny by default
        return {
          allowed: false,
          limit: 0,
          remaining: 0,
          reset: new Date(Date.now() + 3600000),
        };
      }

      // If Redis is available, use it for real-time rate limiting
      if (redis) {
        return await this.checkRedisLimit(userId, feature, limits);
      }

      // Fallback to database-only rate limiting
      return await this.checkDatabaseLimit(userId, feature, limits);
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // On error, be permissive but log it
      return {
        allowed: true,
        limit: 100,
        remaining: 100,
        reset: new Date(Date.now() + 3600000),
      };
    }
  }

  /**
   * Track usage of an AI feature
   */
  public async trackUsage(
    userId: string,
    feature: AIFeature,
    success: boolean = true,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const supabase = await createClient();
      
      // Log to database for analytics
      await supabase.from('ai_usage_tracking').insert({
        user_id: userId,
        feature_name: feature,
        success,
        metadata: metadata || {},
        used_at: new Date().toISOString(),
      });

      // Increment Redis counters if available
      if (redis) {
        const hourlyKey = `usage:${userId}:${feature}:hourly`;
        const dailyKey = `usage:${userId}:${feature}:daily`;
        
        await Promise.all([
          redis.incr(hourlyKey),
          redis.incr(dailyKey),
          redis.expire(hourlyKey, 3600), // 1 hour
          redis.expire(dailyKey, 86400), // 24 hours
        ]);
      }
    } catch (error) {
      console.error('Failed to track usage:', error);
      // Don't throw - we don't want tracking failures to break the app
    }
  }

  /**
   * Get usage statistics for a user
   */
  public async getUsageStats(
    userId: string,
    feature: AIFeature,
    subscriptionTier: SubscriptionTier
  ): Promise<UsageStats> {
    const limits = await this.getUserLimits(userId, feature, subscriptionTier);
    
    let hourlyUsed = 0;
    let dailyUsed = 0;

    if (redis) {
      // Get from Redis if available
      const hourlyKey = `usage:${userId}:${feature}:hourly`;
      const dailyKey = `usage:${userId}:${feature}:daily`;
      
      const [hourlyCount, dailyCount] = await Promise.all([
        redis.get<number>(hourlyKey),
        redis.get<number>(dailyKey),
      ]);
      
      hourlyUsed = hourlyCount || 0;
      dailyUsed = dailyCount || 0;
    } else {
      // Fallback to database
      const supabase = await createClient();
      
      // Get hourly usage
      const hourAgo = new Date(Date.now() - 3600000);
      const { count: hourlyCount } = await supabase
        .from('ai_usage_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature_name', feature)
        .eq('success', true)
        .gte('used_at', hourAgo.toISOString());
      
      // Get daily usage
      const dayAgo = new Date(Date.now() - 86400000);
      const { count: dailyCount } = await supabase
        .from('ai_usage_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature_name', feature)
        .eq('success', true)
        .gte('used_at', dayAgo.toISOString());
      
      hourlyUsed = hourlyCount || 0;
      dailyUsed = dailyCount || 0;
    }

    return {
      feature,
      hourlyUsed,
      hourlyLimit: limits?.hourly_limit || 0,
      hourlyRemaining: Math.max(0, (limits?.hourly_limit || 0) - hourlyUsed),
      dailyUsed,
      dailyLimit: limits?.daily_limit || 0,
      dailyRemaining: Math.max(0, (limits?.daily_limit || 0) - dailyUsed),
      resetAt: {
        hourly: new Date(Date.now() + 3600000),
        daily: new Date(Date.now() + 86400000),
      },
    };
  }

  /**
   * Get all usage stats for a user
   */
  public async getAllUsageStats(
    userId: string,
    subscriptionTier: SubscriptionTier
  ): Promise<UsageStats[]> {
    const features: AIFeature[] = [
      'resume_analysis',
      'interview_prep',
      'cover_letter',
      'career_advice',
      'job_fit_analysis',
    ];

    return await Promise.all(
      features.map(feature => this.getUsageStats(userId, feature, subscriptionTier))
    );
  }

  /**
   * Private helper methods
   */
  private async getUserLimits(
    userId: string,
    feature: AIFeature,
    subscriptionTier: SubscriptionTier
  ): Promise<{ daily_limit: number; hourly_limit: number } | null> {
    try {
      const supabase = await createClient();
      
      // First check for user-specific overrides
      const { data: override } = await supabase
        .from('ai_user_limit_overrides')
        .select('daily_limit, hourly_limit')
        .eq('user_id', userId)
        .eq('feature_name', feature)
        .or('expires_at.is.null,expires_at.gt.now()')
        .single();
      
      if (override) {
        return override;
      }

      // Get default limits for tier
      const { data: limits } = await supabase
        .from('ai_feature_limits')
        .select('daily_limit, hourly_limit')
        .eq('feature_name', feature)
        .eq('subscription_tier', subscriptionTier)
        .single();
      
      return limits;
    } catch (error) {
      console.error('Failed to get user limits:', error);
      return null;
    }
  }

  private async checkRedisLimit(
    userId: string,
    feature: AIFeature,
    limits: { daily_limit: number; hourly_limit: number }
  ): Promise<RateLimitResult> {
    if (!redis) {
      return this.checkDatabaseLimit(userId, feature, limits);
    }

    const hourlyKey = `usage:${userId}:${feature}:hourly`;
    const dailyKey = `usage:${userId}:${feature}:daily`;
    
    // Get current usage
    const [hourlyCount, dailyCount] = await Promise.all([
      redis.get<number>(hourlyKey),
      redis.get<number>(dailyKey),
    ]);
    
    const hourlyUsed = hourlyCount || 0;
    const dailyUsed = dailyCount || 0;
    
    // Check if limits exceeded
    const hourlyExceeded = hourlyUsed >= limits.hourly_limit;
    const dailyExceeded = dailyUsed >= limits.daily_limit;
    
    if (hourlyExceeded || dailyExceeded) {
      // Determine which limit was hit and when it resets
      const resetTime = hourlyExceeded 
        ? new Date(Date.now() + 3600000) 
        : new Date(Date.now() + 86400000);
      
      return {
        allowed: false,
        limit: hourlyExceeded ? limits.hourly_limit : limits.daily_limit,
        remaining: 0,
        reset: resetTime,
        retryAfter: Math.ceil((resetTime.getTime() - Date.now()) / 1000),
      };
    }

    // Calculate remaining
    const remaining = Math.min(
      limits.hourly_limit - hourlyUsed,
      limits.daily_limit - dailyUsed
    );

    return {
      allowed: true,
      limit: limits.daily_limit,
      remaining,
      reset: new Date(Date.now() + 3600000),
    };
  }

  private async checkDatabaseLimit(
    userId: string,
    feature: AIFeature,
    limits: { daily_limit: number; hourly_limit: number }
  ): Promise<RateLimitResult> {
    const supabase = await createClient();
    
    // Check hourly usage
    const hourAgo = new Date(Date.now() - 3600000);
    const { count: hourlyCount } = await supabase
      .from('ai_usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature_name', feature)
      .eq('success', true)
      .gte('used_at', hourAgo.toISOString());
    
    // Check daily usage
    const dayAgo = new Date(Date.now() - 86400000);
    const { count: dailyCount } = await supabase
      .from('ai_usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature_name', feature)
      .eq('success', true)
      .gte('used_at', dayAgo.toISOString());
    
    const hourlyUsed = hourlyCount || 0;
    const dailyUsed = dailyCount || 0;
    
    // Check limits
    if (hourlyUsed >= limits.hourly_limit) {
      return {
        allowed: false,
        limit: limits.hourly_limit,
        remaining: 0,
        reset: new Date(Date.now() + 3600000),
        retryAfter: 3600,
      };
    }
    
    if (dailyUsed >= limits.daily_limit) {
      return {
        allowed: false,
        limit: limits.daily_limit,
        remaining: 0,
        reset: new Date(Date.now() + 86400000),
        retryAfter: 86400,
      };
    }
    
    const remaining = Math.min(
      limits.hourly_limit - hourlyUsed,
      limits.daily_limit - dailyUsed
    );
    
    return {
      allowed: true,
      limit: limits.daily_limit,
      remaining,
      reset: new Date(Date.now() + 3600000),
    };
  }
}

// Export singleton instance
export const rateLimitService = RateLimitService.getInstance();