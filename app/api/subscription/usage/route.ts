import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get usage tracking data
    const { data: usage, error } = await supabase
      .from("usage_tracking")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error("Error fetching usage tracking:", error);
      return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
    }

    // Return default usage if no record exists
    const usageData = usage || {
      user_id: user.id,
      applications_count: 0,
      ai_features_used: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({ usage: usageData });

  } catch (error) {
    console.error("Usage tracking GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}