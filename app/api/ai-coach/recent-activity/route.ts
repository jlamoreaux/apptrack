import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Get recent AI feature activity
    const { data: activities, error } = await supabase
      .from("ai_feature_usage")
      .select("id, feature_name, created_at, success, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 50)); // Cap at 50 for performance

    if (error) {
      console.error("Error fetching recent activity:", error);
      return NextResponse.json({ error: "Failed to fetch recent activity" }, { status: 500 });
    }

    return NextResponse.json({ activities });

  } catch (error) {
    console.error("Recent activity GET error:", error);
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}