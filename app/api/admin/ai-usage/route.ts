import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { AdminService } from "@/lib/services/admin.service";
import { type AIFeature } from "@/lib/services/rate-limit.service";
import { redis } from "@/lib/redis/client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

interface AggregatedUsage {
  feature: AIFeature;
  hourlyTotal: number;
  dailyTotal: number;
  allTimeTotal: number;
  uniqueUsersHourly: number;
  uniqueUsersDaily: number;
  uniqueUsersAllTime: number;
  successRate: number;
  lastUsed: string | null;
}

// Map feature names to DB values — different tables use different names
// ai_feature_usage, ai_trial_results, ai_guest_sessions use feature_name
// ai_preview_sessions, ai_preview_usage use feature_type (with shorter names like "job_fit")
const FEATURE_TO_DB_NAMES: Record<string, string[]> = {
  resume_analysis: ['resume_analysis'],
  interview_prep: ['interview_prep'],
  cover_letter: ['cover_letter'],
  career_advice: ['career_advice', 'career_chat'],
  job_fit_analysis: ['job_fit_analysis', 'job_fit'],
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let user: any = null;

  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    user = authUser;

    if (authError || !user) {
      loggerService.warn('Unauthorized admin AI usage access attempt', {
        category: LogCategory.SECURITY,
        action: 'admin_ai_usage_unauthorized',
        metadata: { error: authError?.message }
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin access
    const isAdmin = await AdminService.isAdmin(user.id);
    if (!isAdmin) {
      loggerService.logSecurityEvent('admin_access_denied', 'high', {
        endpoint: '/api/admin/ai-usage',
        attemptedBy: user.id
      }, { userId: user.id });
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const now = new Date();
    const currentHour = now.toISOString().slice(0, 13);
    const currentDate = now.toISOString().slice(0, 10);

    const features: AIFeature[] = [
      'resume_analysis',
      'interview_prep',
      'cover_letter',
      'career_advice',
      'job_fit_analysis',
    ];

    const aggregatedData: AggregatedUsage[] = [];
    const adminSupabase = createAdminClient();

    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    for (const feature of features) {
      let hourlyTotal = 0;
      let dailyTotal = 0;
      let uniqueUsersHourly = 0;
      let uniqueUsersDaily = 0;
      let successRate = 100;
      const dbFeatureNames = FEATURE_TO_DB_NAMES[feature] || [feature];

      // Get real-time current hour/day data from Redis
      if (redis) {
        try {
          hourlyTotal = Number(await redis.get(`usage:agg:${feature}:hourly:${currentHour}`) || 0);
          uniqueUsersHourly = Number(await redis.scard(`usage:users:${feature}:hourly:${currentHour}`) || 0);
          dailyTotal = Number(await redis.get(`usage:agg:${feature}:daily:${currentDate}`) || 0);
          uniqueUsersDaily = Number(await redis.scard(`usage:users:${feature}:daily:${currentDate}`) || 0);
          const dailySuccess = Number(await redis.get(`usage:success:${feature}:daily:${currentDate}`) || 0);

          if (dailyTotal > 0) {
            successRate = Math.round((dailySuccess / dailyTotal) * 1000) / 10;
          }
        } catch (redisError) {
          loggerService.error(`Redis error for AI usage feature ${feature}`, redisError, {
            category: LogCategory.CACHE, userId: user.id, action: 'admin_ai_usage_redis_error',
            metadata: { feature, currentHour, currentDate }
          });
        }
      }

      // DB fallback for hourly/daily if Redis has no data
      if (hourlyTotal === 0 && dailyTotal === 0) {
        const { data: hourlyRows } = await adminSupabase
          .from('ai_feature_usage')
          .select('user_id')
          .in('feature_name', dbFeatureNames)
          .gte('created_at', hourStart.toISOString());

        if (hourlyRows && hourlyRows.length > 0) {
          hourlyTotal = hourlyRows.length;
          uniqueUsersHourly = new Set(hourlyRows.map(r => r.user_id)).size;
        }

        const { data: dailyRows } = await adminSupabase
          .from('ai_feature_usage')
          .select('user_id')
          .in('feature_name', dbFeatureNames)
          .gte('created_at', dayStart.toISOString());

        if (dailyRows && dailyRows.length > 0) {
          dailyTotal = dailyRows.length;
          uniqueUsersDaily = new Set(dailyRows.map(r => r.user_id)).size;
        }
      }

      // All-time totals aggregated from all tracking tables:
      // 1. ai_feature_usage - registered user usage (has usage_count per row)
      // 2. ai_trial_results - trial/free-tier results
      // 3. ai_guest_sessions - pre-registration guest usage
      let allTimeTotal = 0;
      const allTimeUserIds = new Set<string>();
      let lastUsedTime: string | null = null;

      // ai_feature_usage (registered users)
      const { data: featureRows } = await adminSupabase
        .from('ai_feature_usage')
        .select('user_id, usage_count, created_at')
        .in('feature_name', dbFeatureNames);

      if (featureRows && featureRows.length > 0) {
        allTimeTotal += featureRows.reduce((sum, r) => sum + (r.usage_count || 1), 0);
        featureRows.forEach(r => allTimeUserIds.add(r.user_id));
        const maxDate = featureRows.reduce((max, r) => r.created_at > max ? r.created_at : max, '');
        if (maxDate) lastUsedTime = maxDate;
      }

      // ai_trial_results (trial usage)
      const { data: trialRows } = await adminSupabase
        .from('ai_trial_results')
        .select('user_id, created_at')
        .in('feature_name', dbFeatureNames);

      if (trialRows && trialRows.length > 0) {
        allTimeTotal += trialRows.length;
        trialRows.forEach(r => { if (r.user_id) allTimeUserIds.add(r.user_id); });
        const maxDate = trialRows.reduce((max, r) => r.created_at > max ? r.created_at : max, '');
        if (maxDate && (!lastUsedTime || maxDate > lastUsedTime)) lastUsedTime = maxDate;
      }

      // ai_guest_sessions (pre-registration guests, uses feature_name)
      const { data: guestRows } = await adminSupabase
        .from('ai_guest_sessions')
        .select('ip_hash, session_started_at')
        .in('feature_name', dbFeatureNames);

      let uniqueAnonymous = 0;

      if (guestRows && guestRows.length > 0) {
        allTimeTotal += guestRows.length;
        uniqueAnonymous += new Set(guestRows.map(r => r.ip_hash)).size;
        const maxDate = guestRows.reduce((max, r) => r.session_started_at > max ? r.session_started_at : max, '');
        if (maxDate && (!lastUsedTime || maxDate > lastUsedTime)) lastUsedTime = maxDate;
      }

      // ai_preview_sessions (pre-registration previews, uses feature_type)
      const { data: previewSessionRows } = await adminSupabase
        .from('ai_preview_sessions')
        .select('session_fingerprint, created_at')
        .in('feature_type', dbFeatureNames);

      if (previewSessionRows && previewSessionRows.length > 0) {
        allTimeTotal += previewSessionRows.length;
        uniqueAnonymous += new Set(previewSessionRows.map(r => r.session_fingerprint)).size;
        const maxDate = previewSessionRows.reduce((max, r) => r.created_at > max ? r.created_at : max, '');
        if (maxDate && (!lastUsedTime || maxDate > lastUsedTime)) lastUsedTime = maxDate;
      }

      // ai_preview_usage (pre-registration usage tracking, uses feature_type)
      const { data: previewUsageRows } = await adminSupabase
        .from('ai_preview_usage')
        .select('fingerprint, used_at')
        .in('feature_type', dbFeatureNames);

      if (previewUsageRows && previewUsageRows.length > 0) {
        allTimeTotal += previewUsageRows.length;
        uniqueAnonymous += new Set(previewUsageRows.map(r => r.fingerprint)).size;
        const maxDate = previewUsageRows.reduce((max, r) => r.used_at > max ? r.used_at : max, '');
        if (maxDate && (!lastUsedTime || maxDate > lastUsedTime)) lastUsedTime = maxDate;
      }

      const uniqueUsersAllTime = allTimeUserIds.size + uniqueAnonymous;

      // If Redis shows current activity, override lastUsed with appropriate time
      if (hourlyTotal > 0) {
        // Used this hour — use hour start as approximate time
        lastUsedTime = hourStart.toISOString();
      } else if (dailyTotal > 0) {
        // Used earlier today — use day start as approximate time
        lastUsedTime = dayStart.toISOString();
      }

      aggregatedData.push({
        feature,
        hourlyTotal,
        dailyTotal,
        allTimeTotal,
        uniqueUsersHourly,
        uniqueUsersDaily,
        uniqueUsersAllTime,
        successRate,
        lastUsed: lastUsedTime,
      });
    }

    // Calculate system-wide totals
    const systemTotals = {
      hourlyTotal: 0,
      dailyTotal: 0,
      allTimeTotal: 0,
      uniqueUsersHourly: 0,
      uniqueUsersDaily: 0,
      uniqueUsersAllTime: 0,
    };

    for (const data of aggregatedData) {
      systemTotals.hourlyTotal += data.hourlyTotal;
      systemTotals.dailyTotal += data.dailyTotal;
      systemTotals.allTimeTotal += data.allTimeTotal;
      systemTotals.uniqueUsersHourly = Math.max(systemTotals.uniqueUsersHourly, data.uniqueUsersHourly);
      systemTotals.uniqueUsersDaily = Math.max(systemTotals.uniqueUsersDaily, data.uniqueUsersDaily);
      systemTotals.uniqueUsersAllTime = Math.max(systemTotals.uniqueUsersAllTime, data.uniqueUsersAllTime);
    }

    // Calculate reset times
    const hourlyReset = new Date(now);
    hourlyReset.setMinutes(0, 0, 0);
    hourlyReset.setHours(hourlyReset.getHours() + 1);

    const dailyReset = new Date(now);
    dailyReset.setHours(24, 0, 0, 0);

    loggerService.info('Admin AI usage data retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'admin_ai_usage_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        featureCount: features.length,
        systemHourlyTotal: systemTotals.hourlyTotal,
        systemDailyTotal: systemTotals.dailyTotal,
        systemAllTimeTotal: systemTotals.allTimeTotal,
        uniqueUsersAllTime: systemTotals.uniqueUsersAllTime,
      }
    });

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
    loggerService.error('Error fetching aggregated AI usage', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'admin_ai_usage_error',
      duration: Date.now() - startTime
    });

    return NextResponse.json(
      { error: "Failed to fetch AI usage statistics" },
      { status: 500 }
    );
  }
}
