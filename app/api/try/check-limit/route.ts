import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { getClientIP } from "@/lib/utils/fingerprint";

/**
 * Check if a user (identified by fingerprint + IP) can use a pre-registration AI feature
 * Rate limit: 1 use per feature per 24 hours per browser/IP combination
 */
export async function POST(request: NextRequest) {
  try {
    const { featureType, fingerprint } = await request.json();

    if (!featureType || !fingerprint) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const ipAddress = getClientIP(request);
    const supabase = createServiceRoleClient();

    // Check usage in last 24 hours for this fingerprint + feature combination
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("ai_preview_usage")
      .select("*")
      .eq("fingerprint", fingerprint)
      .eq("feature_type", featureType)
      .gte("used_at", twentyFourHoursAgo);

    if (error) {
      console.error("Rate limit check error:", error);
      return NextResponse.json(
        { error: "Failed to check rate limit" },
        { status: 500 }
      );
    }

    const usedCount = data?.length || 0;
    const canUse = usedCount === 0;

    // Calculate reset time (24 hours from first use)
    let resetAt: string | null = null;
    if (data && data.length > 0) {
      const firstUse = new Date(data[0].used_at);
      resetAt = new Date(firstUse.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }

    return NextResponse.json({
      canUse,
      usedCount,
      resetAt,
    });
  } catch (error) {
    console.error("Check limit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
