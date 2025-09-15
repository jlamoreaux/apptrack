import { NextRequest, NextResponse } from "next/server";
import { getUser, getSubscription } from "@/lib/supabase/server";
import { RateLimitService } from "@/lib/services/rate-limit.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { feature } = await request.json();

    if (!feature) {
      return NextResponse.json(
        { error: "Feature name is required" },
        { status: 400 }
      );
    }

    // Get user's subscription
    const subscription = await getSubscription(user.id);
    let tier = 'free';
    
    if (subscription?.subscription_plans?.name === 'AI Coach') {
      tier = 'ai_coach';
    } else if (subscription?.subscription_plans?.name === 'Pro') {
      tier = 'pro';
    }

    const rateLimitService = new RateLimitService();
    const result = await rateLimitService.checkLimit(user.id, feature, tier);

    return NextResponse.json({
      allowed: result.allowed,
      remaining: result.remaining,
      limit: result.limit,
      resetsAt: result.resetsAt,
    });
  } catch (error) {
    console.error("Rate limit check error:", error);
    return NextResponse.json(
      { error: "Failed to check rate limit" },
      { status: 500 }
    );
  }
}