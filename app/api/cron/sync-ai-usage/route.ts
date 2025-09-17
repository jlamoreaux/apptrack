import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redis } from "@/lib/redis/client";
import { type AIFeature } from "@/lib/services/rate-limit.service";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Cron job to calculate and store aggregated AI usage statistics
 * Runs every hour to process Redis counters into database aggregates
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (!redis) {
      console.log("Redis not available, skipping stats aggregation");
      return NextResponse.json({ 
        success: true, 
        message: "Redis not available, skipping stats aggregation" 
      });
    }
    
    const supabase = await createClient();
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
    
    const statsToInsert = [];
    
    // Process each feature
    for (const feature of features) {
      try {
        // Get hourly stats from Redis
        const hourlyCountKey = `usage:agg:${feature}:hourly:${currentHour}`;
        const hourlyUsersKey = `usage:users:${feature}:hourly:${currentHour}`;
        
        const hourlyCount = await redis.get(hourlyCountKey) || 0;
        const hourlyUsers = await redis.scard(hourlyUsersKey) || 0;
        
        // Get daily stats from Redis
        const dailyCountKey = `usage:agg:${feature}:daily:${currentDate}`;
        const dailyUsersKey = `usage:users:${feature}:daily:${currentDate}`;
        const dailySuccessKey = `usage:success:${feature}:daily:${currentDate}`;
        
        const dailyCount = await redis.get(dailyCountKey) || 0;
        const dailyUsers = await redis.scard(dailyUsersKey) || 0;
        const dailySuccess = await redis.get(dailySuccessKey) || 0;
        
        // Calculate failed requests (total - successful)
        const dailyFailed = Number(dailyCount) - Number(dailySuccess);
        
        // Prepare hourly stats record
        if (Number(hourlyCount) > 0) {
          statsToInsert.push({
            feature_name: feature,
            stat_date: currentDate,
            stat_hour: currentHourNum,
            total_requests: Number(hourlyCount),
            unique_users: Number(hourlyUsers),
            successful_requests: Number(hourlyCount), // Assume all are successful for hourly
            failed_requests: 0,
          });
        }
        
        // Prepare daily summary record (stat_hour = null for daily summaries)
        if (Number(dailyCount) > 0) {
          statsToInsert.push({
            feature_name: feature,
            stat_date: currentDate,
            stat_hour: null, // NULL indicates daily summary
            total_requests: Number(dailyCount),
            unique_users: Number(dailyUsers),
            successful_requests: Number(dailySuccess),
            failed_requests: dailyFailed > 0 ? dailyFailed : 0,
          });
        }
      } catch (error) {
        console.error(`Failed to process stats for ${feature}:`, error);
      }
    }
    
    // Insert aggregated stats to database
    if (statsToInsert.length > 0) {
      const { error } = await supabase
        .from('ai_usage_stats')
        .upsert(statsToInsert, {
          onConflict: 'feature_name,stat_date,stat_hour',
        });
      
      if (error) {
        console.error("Failed to insert aggregated stats:", error);
        return NextResponse.json(
          { error: "Failed to insert stats", details: error },
          { status: 500 }
        );
      }
    }
    
    console.log(`AI usage stats aggregation completed: ${statsToInsert.length} records processed`);
    
    return NextResponse.json({
      success: true,
      processed: statsToInsert.length,
      timestamp: now.toISOString()
    });
  } catch (error) {
    console.error("AI usage stats aggregation failed:", error);
    return NextResponse.json(
      { 
        error: "Failed to aggregate AI usage stats",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}