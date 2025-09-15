import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { RateLimitService } from "@/lib/services/rate-limit.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const feature = searchParams.get("feature");

    if (!feature) {
      return NextResponse.json(
        { error: "Feature name is required" },
        { status: 400 }
      );
    }

    const rateLimitService = new RateLimitService();
    const stats = await rateLimitService.getUsageStats(user.id, feature);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Usage stats error:", error);
    return NextResponse.json(
      { error: "Failed to get usage stats" },
      { status: 500 }
    );
  }
}