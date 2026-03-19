import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    const { user, error: adminError } = await requireAdmin();
    if (adminError) return adminError;
    userId = user.id;

    const supabase = await createClient();

    // Get all subscription plans
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("name");

    if (error) {
      loggerService.error('Error fetching subscription plans', error, {
        category: LogCategory.DATABASE,
        userId: userId,
        action: 'debug_plans_fetch_error',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Format for easy reading
    const formattedPlans = plans?.map(plan => ({
      id: plan.id,
      name: plan.name,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      stripe_monthly_price_id: plan.stripe_monthly_price_id || "❌ MISSING",
      stripe_yearly_price_id: plan.stripe_yearly_price_id || "❌ MISSING",
      has_stripe_config: !!(plan.stripe_monthly_price_id || plan.stripe_yearly_price_id)
    }));

    const missingStripeConfig = formattedPlans?.filter(p => !p.has_stripe_config) || [];

    loggerService.info('Debug plans retrieved', {
      category: LogCategory.BUSINESS,
      userId: userId,
      action: 'debug_plans_retrieved',
      duration: Date.now() - startTime,
      metadata: {
        totalPlans: plans?.length || 0,
        missingStripeConfigCount: missingStripeConfig.length,
        planNames: plans?.map(p => p.name) || []
      }
    });

    return NextResponse.json({
      total_plans: plans?.length || 0,
      plans: formattedPlans,
      missing_stripe_config: missingStripeConfig,
      message: "Check which plans are missing Stripe price IDs above"
    }, { status: 200 });

  } catch (error) {
    loggerService.error('Debug plans error', error, {
      category: LogCategory.API,
      userId: userId,
      action: 'debug_plans_error',
      duration: Date.now() - startTime
    });
    return NextResponse.json({ 
      error: "Internal server error"
    }, { status: 500 });
  }
}
