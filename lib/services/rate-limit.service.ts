import { createClient } from "@/lib/supabase/server";
import { redis, isRedisAvailable } from "@/lib/redis/client";
import { Ratelimit } from "@upstash/ratelimit";

export type AIFeature =
  | 'resume_analysis'
  | 'interview_prep'
  | 'cover_letter'
  | 'career_advice'
  | 'job_fit_analysis'
  | 'resume_upload';

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
   * Track usage of an AI feature (Redis only for privacy)
   */
  public async trackUsage(
    userId: string,
    feature: AIFeature,
    success: boolean = true,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!redis) {
      // No Redis available, skip tracking
      return;
    }
    
    try {
      // Increment usage counters in Redis only
      const hourlyKey = `usage:${userId}:${feature}:hourly`;
      const dailyKey = `usage:${userId}:${feature}:daily`;
      
      // Also track aggregated counts for the cron job
      const hourlyAggKey = `usage:agg:${feature}:hourly:${new Date().toISOString().slice(0, 13)}`;
      const dailyAggKey = `usage:agg:${feature}:daily:${new Date().toISOString().slice(0, 10)}`;
      
      // Calculate TTL to align with reset times
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(nextHour.getHours() + 1);
      const hourlyTTL = Math.ceil((nextHour.getTime() - now.getTime()) / 1000);
      
      const nextDay = new Date(now);
      nextDay.setHours(24, 0, 0, 0);
      const dailyTTL = Math.ceil((nextDay.getTime() - now.getTime()) / 1000);
      
      await Promise.all([
        // User-specific counters for rate limiting
        redis.incr(hourlyKey),
        redis.incr(dailyKey),
        redis.expire(hourlyKey, hourlyTTL),
        redis.expire(dailyKey, dailyTTL),
        
        // Aggregated counters for statistics
        redis.incr(hourlyAggKey),
        redis.incr(dailyAggKey),
        redis.expire(hourlyAggKey, 86400), // Keep for 24 hours
        redis.expire(dailyAggKey, 172800), // Keep for 48 hours
        
        // Track unique users
        redis.sadd(`usage:users:${feature}:hourly:${new Date().toISOString().slice(0, 13)}`, userId),
        redis.sadd(`usage:users:${feature}:daily:${new Date().toISOString().slice(0, 10)}`, userId),
        redis.expire(`usage:users:${feature}:hourly:${new Date().toISOString().slice(0, 13)}`, 86400),
        redis.expire(`usage:users:${feature}:daily:${new Date().toISOString().slice(0, 10)}`, 172800),
      ]);
      
      // Track success rate
      if (success) {
        await redis.incr(`usage:success:${feature}:daily:${new Date().toISOString().slice(0, 10)}`);
      }
    } catch (error) {
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
    let useDatabase = !redis;

    if (redis) {
      // Get from Redis if available
      try {
        const hourlyKey = `usage:${userId}:${feature}:hourly`;
        const dailyKey = `usage:${userId}:${feature}:daily`;
        
        const [hourlyCount, dailyCount] = await Promise.all([
          redis.get<number>(hourlyKey),
          redis.get<number>(dailyKey),
        ]);
        
        hourlyUsed = hourlyCount || 0;
        dailyUsed = dailyCount || 0;
      } catch (redisError) {
        useDatabase = true;
      }
    }
    
    // If Redis failed or not available, use database
    if (useDatabase) {
      // Fallback to database
      const supabase = await createClient();
      
      // Calculate time boundaries to match reset times
      const now = new Date();
      
      // Start of current hour
      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0);
      
      // Start of current day (midnight)
      const currentDayStart = new Date(now);
      currentDayStart.setHours(0, 0, 0, 0);
      
      // Get hourly usage (from start of current hour)
      const { count: hourlyCount } = await supabase
        .from('ai_usage_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature_name', feature)
        .eq('success', true)
        .gte('used_at', currentHourStart.toISOString());
      
      // Get daily usage (from start of current day)
      const { count: dailyCount } = await supabase
        .from('ai_usage_tracking')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature_name', feature)
        .eq('success', true)
        .gte('used_at', currentDayStart.toISOString());
      
      hourlyUsed = hourlyCount || 0;
      dailyUsed = dailyCount || 0;
    }

    // Calculate accurate reset times
    const now = new Date();
    
    // Hourly reset: next hour boundary
    const hourlyReset = new Date(now);
    hourlyReset.setMinutes(0, 0, 0);
    hourlyReset.setHours(hourlyReset.getHours() + 1);
    
    // Daily reset: next day at midnight (local time)
    const dailyReset = new Date(now);
    dailyReset.setHours(24, 0, 0, 0);

    return {
      feature,
      hourlyUsed,
      hourlyLimit: limits?.hourly_limit || 0,
      hourlyRemaining: Math.max(0, (limits?.hourly_limit || 0) - hourlyUsed),
      dailyUsed,
      dailyLimit: limits?.daily_limit || 0,
      dailyRemaining: Math.max(0, (limits?.daily_limit || 0) - dailyUsed),
      resetAt: {
        hourly: hourlyReset,
        daily: dailyReset,
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
      const { data: limits, error: limitsError } = await supabase
        .from('ai_feature_limits')
        .select('daily_limit, hourly_limit')
        .eq('feature_name', feature)
        .eq('subscription_tier', subscriptionTier)
        .single();
      
      if (limitsError) {
      } else {
      }
      
      return limits;
    } catch (error) {
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

    try {
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
        // Calculate accurate reset times
        const now = new Date();
        
        const hourlyReset = new Date(now);
        hourlyReset.setMinutes(0, 0, 0);
        hourlyReset.setHours(hourlyReset.getHours() + 1);
        
        const dailyReset = new Date(now);
        dailyReset.setHours(24, 0, 0, 0);
        
        // Determine which limit was hit and when it resets
        const resetTime = hourlyExceeded ? hourlyReset : dailyReset;
        const retryAfterMs = resetTime.getTime() - now.getTime();
        
        return {
          allowed: false,
          limit: hourlyExceeded ? limits.hourly_limit : limits.daily_limit,
          remaining: 0,
          reset: resetTime,
          retryAfter: Math.ceil(retryAfterMs / 1000),
        };
      }
      
      // Calculate TTL to align with reset times
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(nextHour.getHours() + 1);
      const hourlyTTL = Math.ceil((nextHour.getTime() - now.getTime()) / 1000);
      
      const nextDay = new Date(now);
      nextDay.setHours(24, 0, 0, 0);
      const dailyTTL = Math.ceil((nextDay.getTime() - now.getTime()) / 1000);
      
      // Increment usage counters
      await Promise.all([
        redis.incr(hourlyKey),
        redis.incr(dailyKey),
        redis.expire(hourlyKey, hourlyTTL), // TTL until next hour boundary
        redis.expire(dailyKey, dailyTTL), // TTL until next day boundary
      ]);
      
      // Return success with remaining counts
      const hourlyResetTime = new Date(now);
      hourlyResetTime.setMinutes(0, 0, 0);
      hourlyResetTime.setHours(hourlyResetTime.getHours() + 1);
      
      return {
        allowed: true,
        limit: Math.min(limits.hourly_limit, limits.daily_limit),
        remaining: Math.min(
          limits.hourly_limit - hourlyUsed - 1,
          limits.daily_limit - dailyUsed - 1
        ),
        reset: hourlyResetTime, // Next hourly reset
        retryAfter: 0,
      };
    } catch (error) {
      // Fall back to database check if Redis fails
      return this.checkDatabaseLimit(userId, feature, limits);
    }
  }

  private async checkDatabaseLimit(
    userId: string,
    feature: AIFeature,
    limits: { daily_limit: number; hourly_limit: number }
  ): Promise<RateLimitResult> {
    const supabase = await createClient();
    
    // Calculate time boundaries to match reset times
    const now = new Date();
    
    // Start of current hour
    const currentHourStart = new Date(now);
    currentHourStart.setMinutes(0, 0, 0);
    
    // Start of current day (midnight)
    const currentDayStart = new Date(now);
    currentDayStart.setHours(0, 0, 0, 0);
    
    // Check hourly usage (from start of current hour)
    const { count: hourlyCount } = await supabase
      .from('ai_usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature_name', feature)
      .eq('success', true)
      .gte('used_at', currentHourStart.toISOString());
    
    // Check daily usage (from start of current day)
    const { count: dailyCount } = await supabase
      .from('ai_usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feature_name', feature)
      .eq('success', true)
      .gte('used_at', currentDayStart.toISOString());
    
    const hourlyUsed = hourlyCount || 0;
    const dailyUsed = dailyCount || 0;
    
    // Calculate accurate reset times
    const hourlyReset = new Date(now);
    hourlyReset.setMinutes(0, 0, 0);
    hourlyReset.setHours(hourlyReset.getHours() + 1);
    
    const dailyReset = new Date(now);
    dailyReset.setHours(24, 0, 0, 0);
    
    // Check limits
    if (hourlyUsed >= limits.hourly_limit) {
      const retryAfterMs = hourlyReset.getTime() - now.getTime();
      return {
        allowed: false,
        limit: limits.hourly_limit,
        remaining: 0,
        reset: hourlyReset,
        retryAfter: Math.ceil(retryAfterMs / 1000),
      };
    }
    
    if (dailyUsed >= limits.daily_limit) {
      const retryAfterMs = dailyReset.getTime() - now.getTime();
      return {
        allowed: false,
        limit: limits.daily_limit,
        remaining: 0,
        reset: dailyReset,
        retryAfter: Math.ceil(retryAfterMs / 1000),
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
      reset: hourlyReset, // Next reset is at hour boundary
    };
  }
}

// Export singleton instance
export const rateLimitService = RateLimitService.getInstance();