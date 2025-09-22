import { createClient } from "@/lib/supabase/server";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

export async function checkRoastRateLimit(userId: string): Promise<RateLimitResult> {
  const supabase = await createClient();
  
  // Define limits
  const HOURLY_LIMIT = 3;
  const DAILY_LIMIT = 10;
  
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Check hourly usage
  const { data: hourlyRoasts, error: hourlyError } = await supabase
    .from("roasts")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", hourAgo.toISOString())
    .limit(HOURLY_LIMIT + 1);
    
  if (hourlyError) {
    console.error("Error checking hourly rate limit:", hourlyError);
    // Be permissive on error
    return { allowed: true, remaining: HOURLY_LIMIT, resetAt: new Date(now.getTime() + 60 * 60 * 1000), limit: HOURLY_LIMIT };
  }
  
  const hourlyCount = hourlyRoasts?.length || 0;
  
  // If hourly limit exceeded
  if (hourlyCount >= HOURLY_LIMIT) {
    // Calculate when the oldest roast in the hour window will expire
    const oldestInHour = hourlyRoasts[0];
    const { data: oldestRoast } = await supabase
      .from("roasts")
      .select("created_at")
      .eq("id", oldestInHour.id)
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
  
  // Check daily usage
  const { data: dailyRoasts, error: dailyError } = await supabase
    .from("roasts")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", dayAgo.toISOString())
    .limit(DAILY_LIMIT + 1);
    
  if (dailyError) {
    console.error("Error checking daily rate limit:", dailyError);
    // Be permissive on error
    return { allowed: true, remaining: HOURLY_LIMIT - hourlyCount, resetAt: new Date(now.getTime() + 60 * 60 * 1000), limit: HOURLY_LIMIT };
  }
  
  const dailyCount = dailyRoasts?.length || 0;
  
  // If daily limit exceeded
  if (dailyCount >= DAILY_LIMIT) {
    // Calculate when the oldest roast in the day window will expire
    const oldestInDay = dailyRoasts[0];
    const { data: oldestRoast } = await supabase
      .from("roasts")
      .select("created_at")
      .eq("id", oldestInDay.id)
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