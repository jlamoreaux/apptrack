import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RateLimitService, type AIFeature } from "@/lib/services/rate-limit.service";
import { getUserSubscriptionTier } from "@/lib/middleware/rate-limit.middleware";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const feature = searchParams.get('feature') as AIFeature | null;
    
    // Get user's subscription tier
    const subscriptionTier = await getUserSubscriptionTier(user.id);

    // Get rate limit service instance
    const rateLimitService = RateLimitService.getInstance();

    // Get usage stats
    if (feature) {
      // Get stats for specific feature
      const stats = await rateLimitService.getUsageStats(
        user.id,
        feature,
        subscriptionTier
      );
      return NextResponse.json(stats);
    } else {
      // Get stats for all features
      const allStats = await rateLimitService.getAllUsageStats(
        user.id,
        subscriptionTier
      );
      return NextResponse.json(allStats);
    }
  } catch (error) {
    console.error("Error fetching usage stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage statistics" },
      { status: 500 }
    );
  }
}