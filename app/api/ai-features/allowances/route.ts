import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIFeatureUsageService } from "@/lib/services/ai-feature-usage.service";

/**
 * GET /api/ai-features/allowances
 * Get all AI feature allowances for authenticated user
 * Shows how many free tries remain for each feature
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get all allowances
    const allowances = await AIFeatureUsageService.getAllAllowances(user.id);

    // Get user's subscription tier
    const { data: userData } = await supabase
      .from("users")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      allowances,
      subscriptionTier: userData?.subscription_tier || "free",
      hasAnyFreeTries: Object.values(allowances).some(a => a.canUse),
    });
  } catch (error) {
    console.error("Get allowances error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
