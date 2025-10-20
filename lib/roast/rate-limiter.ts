import { createClient } from "@/lib/supabase/server";
import { ROAST_CONSTANTS } from "@/lib/constants/roast";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

async function getUserSubscriptionTier(userId: string): Promise<'free' | 'pro' | 'ai_coach'> {
  const supabase = await createClient();
  
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("subscription_tier")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();
    
  return subscription?.subscription_tier || 'free';
}

export async function checkRoastRateLimit(userId: string, version?: string): Promise<RateLimitResult> {
  const supabase = await createClient();
  
  // Get user's subscription tier
  const tier = await getUserSubscriptionTier(userId);
  
  // Define limits based on tier
  const DAILY_LIMIT = tier === 'free' 
    ? ROAST_CONSTANTS.RATE_LIMIT.FREE_USER_PER_DAY
    : ROAST_CONSTANTS.RATE_LIMIT.PRO_USER_PER_DAY;
    
  const HOURLY_LIMIT = ROAST_CONSTANTS.RATE_LIMIT.PER_HOUR;
  
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Build query for version-specific rate limiting
  let hourlyQuery = supabase
    .from("roasts")
    .select("id, metadata")
    .eq("user_id", userId)
    .gte("created_at", hourAgo.toISOString());
    
  let dailyQuery = supabase
    .from("roasts")
    .select("id, metadata")
    .eq("user_id", userId)
    .gte("created_at", dayAgo.toISOString());
  
  // Check hourly usage (for the specific version if provided)
  const { data: hourlyRoasts, error: hourlyError } = await hourlyQuery;
    
  if (hourlyError) {
    console.error("Error checking hourly rate limit:", hourlyError);
    // Be permissive on error
    return { allowed: true, remaining: HOURLY_LIMIT, resetAt: new Date(now.getTime() + 60 * 60 * 1000), limit: HOURLY_LIMIT };
  }
  
  // Filter by version if specified
  const hourlyCount = version 
    ? hourlyRoasts?.filter(r => (r.metadata as any)?.version === version).length || 0
    : hourlyRoasts?.length || 0;
  
  // If hourly limit exceeded
  if (hourlyCount >= HOURLY_LIMIT) {
    // Calculate when the oldest roast in the hour window will expire
    const relevantHourlyRoasts = version 
      ? hourlyRoasts?.filter(r => (r.metadata as any)?.version === version)
      : hourlyRoasts;
      
    const oldestInHour = relevantHourlyRoasts?.[0];
    const { data: oldestRoast } = await supabase
      .from("roasts")
      .select("created_at")
      .eq("id", oldestInHour?.id || '')
      .single();
      
    const resetAt = oldestRoast 
      ? new Date(new Date(oldestRoast.created_at).getTime() + 60 * 60 * 1000)
      : new Date(now.getTime() + 60 * 60 * 1000);
      
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt,
      limit: HOURLY_LIMIT
    };
  }
  
  // Check daily usage (for the specific version if provided)
  const { data: dailyRoasts, error: dailyError } = await dailyQuery;
    
  if (dailyError) {
    console.error("Error checking daily rate limit:", dailyError);
    // Be permissive on error
    return { allowed: true, remaining: HOURLY_LIMIT - hourlyCount, resetAt: new Date(now.getTime() + 60 * 60 * 1000), limit: HOURLY_LIMIT };
  }
  
  // Filter by version if specified
  const dailyCount = version 
    ? dailyRoasts?.filter(r => (r.metadata as any)?.version === version).length || 0
    : dailyRoasts?.length || 0;
  
  // If daily limit exceeded
  if (dailyCount >= DAILY_LIMIT) {
    // Calculate when the oldest roast in the day window will expire
    const relevantDailyRoasts = version 
      ? dailyRoasts?.filter(r => (r.metadata as any)?.version === version)
      : dailyRoasts;
      
    const oldestInDay = relevantDailyRoasts?.[0];
    const { data: oldestRoast } = await supabase
      .from("roasts")
      .select("created_at")
      .eq("id", oldestInDay?.id || '')
      .single();
      
    const resetAt = oldestRoast
      ? new Date(new Date(oldestRoast.created_at).getTime() + 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt,
      limit: DAILY_LIMIT
    };
  }
  
  // Calculate remaining based on the more restrictive limit
  const hourlyRemaining = HOURLY_LIMIT - hourlyCount;
  const dailyRemaining = DAILY_LIMIT - dailyCount;
  const remaining = Math.min(hourlyRemaining, dailyRemaining);
  
  return {
    allowed: true,
    remaining,
    resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    limit: hourlyRemaining < dailyRemaining ? HOURLY_LIMIT : DAILY_LIMIT
  };
}

// New function for guest rate limiting
export async function checkGuestRoastRateLimit(ipHash: string, browserFingerprint: string, version?: string): Promise<RateLimitResult> {
  const supabase = await createClient();
  
  const DAILY_LIMIT = ROAST_CONSTANTS.RATE_LIMIT.GUEST_PER_DAY;
  const HOURLY_LIMIT = Math.min(ROAST_CONSTANTS.RATE_LIMIT.PER_HOUR, DAILY_LIMIT);
  
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Check hourly usage for guests
  const { data: hourlyRoasts } = await supabase
    .from("roasts")
    .select("id, metadata")
    .or(`ip_hash.eq.${ipHash},browser_fingerprint.eq.${browserFingerprint}`)
    .gte("created_at", hourAgo.toISOString());
    
  const hourlyCount = version 
    ? hourlyRoasts?.filter(r => (r.metadata as any)?.version === version).length || 0
    : hourlyRoasts?.length || 0;
  
  if (hourlyCount >= HOURLY_LIMIT) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt: new Date(now.getTime() + 60 * 60 * 1000),
      limit: HOURLY_LIMIT
    };
  }
  
  // Check daily usage for guests
  const { data: dailyRoasts } = await supabase
    .from("roasts")
    .select("id, metadata")
    .or(`ip_hash.eq.${ipHash},browser_fingerprint.eq.${browserFingerprint}`)
    .gte("created_at", dayAgo.toISOString());
    
  const dailyCount = version 
    ? dailyRoasts?.filter(r => (r.metadata as any)?.version === version).length || 0
    : dailyRoasts?.length || 0;
  
  if (dailyCount >= DAILY_LIMIT) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      limit: DAILY_LIMIT
    };
  }
  
  const hourlyRemaining = HOURLY_LIMIT - hourlyCount;
  const dailyRemaining = DAILY_LIMIT - dailyCount;
  const remaining = Math.min(hourlyRemaining, dailyRemaining);
  
  return {
    allowed: true,
    remaining,
    resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    limit: hourlyRemaining < dailyRemaining ? HOURLY_LIMIT : DAILY_LIMIT
  };
}