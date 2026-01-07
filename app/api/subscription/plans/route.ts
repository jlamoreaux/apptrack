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
      loggerService.warn('Unauthorized subscription plans access', {
        category: LogCategory.SECURITY,
        action: 'subscription_plans_unauthorized',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get subscription plans
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("price_monthly", { ascending: true });

    if (error) {
      loggerService.error('Error fetching subscription plans', error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: 'subscription_plans_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Failed to fetch subscription plans" }, { status: 500 });
    }

    loggerService.info('Subscription plans retrieved', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'subscription_plans_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        planCount: plans?.length || 0,
        planNames: plans?.map(p => p.name) || []
      }
    });
    
    return NextResponse.json({ plans });

  } catch (error) {
    loggerService.error('Subscription plans GET error', error, {
      category: LogCategory.API,
      action: 'subscription_plans_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}