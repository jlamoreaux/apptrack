import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { getClientIP } from "@/lib/utils/fingerprint";

/**
 * Track usage of a pre-registration AI feature
 * Called after successfully generating AI content
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

    // Insert usage record
    const { error } = await supabase.from("ai_preview_usage").insert({
      fingerprint,
      ip_address: ipAddress,
      feature_type: featureType,
    });

    if (error) {
      console.error("Track usage error:", error);
      return NextResponse.json(
        { error: "Failed to track usage" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Track usage error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
