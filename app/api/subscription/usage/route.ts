import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const user = await getUser();
    
    if (!user) {
      loggerService.warn('Unauthorized usage tracking access', {
        category: LogCategory.SECURITY,
        action: 'subscription_usage_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get usage tracking data
    const { data: usage, error } = await supabase
      .from("usage_tracking")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      loggerService.error('Error fetching usage tracking', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'subscription_usage_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
    }

    // Return default usage if no record exists
    const usageData = usage || {
      user_id: user.id,
      applications_count: 0,
      ai_features_used: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    loggerService.info('Usage data retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'subscription_usage_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        hasUsageRecord: !!usage,
        applicationsCount: usageData.applications_count,
        aiFeaturesUsed: usageData.ai_features_used
      }
    });
    
    return NextResponse.json({ usage: usageData });

  } catch (error) {
    loggerService.error('Usage tracking GET error', error, {
      category: LogCategory.API,
      userId: user?.id,
      action: 'subscription_usage_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}