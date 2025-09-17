import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RateLimitService } from "@/lib/services/rate-limit.service";
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

    // Get feature from query params
    const { searchParams } = new URL(request.url);
    const feature = searchParams.get('feature');
    
    if (!feature) {
      return NextResponse.json(
        { error: "Feature parameter is required" },
        { status: 400 }
      );
    }

    // Get user's subscription tier
    const subscriptionTier = await getUserSubscriptionTier(user.id);

    // Create rate limit service instance
    const rateLimitService = new RateLimitService();

    // Check rate limit
    const result = await rateLimitService.checkLimit(
      user.id,
      feature as any,
      subscriptionTier
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error checking rate limit:", error);
    return NextResponse.json(
      { error: "Failed to check rate limit" },
      { status: 500 }
    );
  }
}
