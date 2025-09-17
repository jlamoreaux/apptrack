import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { type AIFeature } from "@/lib/services/rate-limit.service";
import { redis } from "@/lib/redis/client";

interface AggregatedUsage {
  feature: AIFeature;
  hourlyTotal: number;
  dailyTotal: number;
  uniqueUsersHourly: number;
  uniqueUsersDaily: number;
  successRate: number;
  lastUsed: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Check admin access
    const isAdmin = await AdminService.isAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }
    
    // Calculate time boundaries
    const now = new Date();
    const currentHour = now.toISOString().slice(0, 13);
    const currentDate = now.toISOString().slice(0, 10);
    const currentHourNum = now.getHours();
    
    const features: AIFeature[] = [
      'resume_analysis',
      'interview_prep',
      'cover_letter',
      'career_advice',
      'job_fit_analysis',
    ];
    
    const aggregatedData: AggregatedUsage[] = [];
    
    for (const feature of features) {
      let hourlyTotal = 0;
      let dailyTotal = 0;
      let uniqueUsersHourly = 0;
      let uniqueUsersDaily = 0;
      let successRate = 100;
      
      // Get real-time current hour data from Redis
      if (redis) {
        try {
          const hourlyCountKey = `usage:agg:${feature}:hourly:${currentHour}`;
          const hourlyUsersKey = `usage:users:${feature}:hourly:${currentHour}`;
          
          hourlyTotal = Number(await redis.get(hourlyCountKey) || 0);
          uniqueUsersHourly = Number(await redis.scard(hourlyUsersKey) || 0);
          
          // Get daily totals from Redis
          const dailyCountKey = `usage:agg:${feature}:daily:${currentDate}`;
          const dailyUsersKey = `usage:users:${feature}:daily:${currentDate}`;
          const dailySuccessKey = `usage:success:${feature}:daily:${currentDate}`;
          
          dailyTotal = Number(await redis.get(dailyCountKey) || 0);
          uniqueUsersDaily = Number(await redis.scard(dailyUsersKey) || 0);
          const dailySuccess = Number(await redis.get(dailySuccessKey) || 0);
          
          if (dailyTotal > 0) {
            successRate = Math.round((dailySuccess / dailyTotal) * 1000) / 10;
          }
        } catch (redisError) {
          console.error(`Redis error for ${feature}:`, redisError);
        }
      }
      
      // If Redis data is not available or incomplete, fall back to database
      if (hourlyTotal === 0 && dailyTotal === 0) {
        // Get latest stats from database
        const { data: dbStats } = await supabase
          .from('ai_usage_stats')
          .select('*')
          .eq('feature_name', feature)
          .eq('stat_date', currentDate)
          .order('stat_hour', { ascending: false, nullsFirst: false });
        
        if (dbStats && dbStats.length > 0) {
          // Find current hour stats
          const currentHourStats = dbStats.find(s => s.stat_hour === currentHourNum);
          if (currentHourStats) {
            hourlyTotal = currentHourStats.total_requests;
            uniqueUsersHourly = currentHourStats.unique_users;
          }
          
          // Find daily summary (stat_hour = null)
          const dailyStats = dbStats.find(s => s.stat_hour === null);
          if (dailyStats) {
            dailyTotal = dailyStats.total_requests;
            uniqueUsersDaily = dailyStats.unique_users;
            if (dailyStats.total_requests > 0) {
              successRate = Math.round((dailyStats.successful_requests / dailyStats.total_requests) * 1000) / 10;
            }
          }
        }
      }
      
      // Get last usage time from recent stats
      const { data: lastUsedData } = await supabase
        .from('ai_usage_stats')
        .select('created_at')
        .eq('feature_name', feature)
        .gt('total_requests', 0)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      aggregatedData.push({
        feature,
        hourlyTotal,
        dailyTotal,
        uniqueUsersHourly,
        uniqueUsersDaily,
        successRate,
        lastUsed: lastUsedData?.created_at || null,
      });
    }
    
    // Calculate system-wide totals
    let systemHourlyTotal = 0;
    let systemDailyTotal = 0;
    let systemUniqueUsersHourly = 0;
    let systemUniqueUsersDaily = 0;
    
    // Sum up from features
    for (const data of aggregatedData) {
      systemHourlyTotal += data.hourlyTotal;
      systemDailyTotal += data.dailyTotal;
      // Note: This is an approximation as users might use multiple features
      systemUniqueUsersHourly = Math.max(systemUniqueUsersHourly, data.uniqueUsersHourly);
      systemUniqueUsersDaily = Math.max(systemUniqueUsersDaily, data.uniqueUsersDaily);
    }
    
    const systemTotals = {
      hourlyTotal: systemHourlyTotal,
      dailyTotal: systemDailyTotal,
      uniqueUsersHourly: systemUniqueUsersHourly,
      uniqueUsersDaily: systemUniqueUsersDaily,
    };
    
    // Calculate accurate reset times
    const hourlyReset = new Date(now);
    hourlyReset.setMinutes(0, 0, 0);
    hourlyReset.setHours(hourlyReset.getHours() + 1);
    
    const dailyReset = new Date(now);
    dailyReset.setHours(24, 0, 0, 0);
    
    return NextResponse.json({
      features: aggregatedData,
      systemTotals,
      resetTimes: {
        hourly: hourlyReset.toISOString(),
        daily: dailyReset.toISOString(),
      },
      currentTime: now.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching aggregated AI usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI usage statistics" },
      { status: 500 }
    );
  }
}