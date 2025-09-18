import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get all subscription plans
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    return NextResponse.json({
      total_plans: plans?.length || 0,
      plans: formattedPlans,
      missing_stripe_config: formattedPlans?.filter(p => !p.has_stripe_config) || [],
      message: "Check which plans are missing Stripe price IDs above"
    }, { status: 200 });

  } catch (error) {
    console.error("Debug plans error:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}