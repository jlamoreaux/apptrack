import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();

    // Get the most recent resume for the user
    const { data: resume, error } = await supabase
      .from("user_resumes")
      .select("*")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching current resume:", error);
      return NextResponse.json({ error: "Failed to fetch current resume" }, { status: 500 });
    }

    if (!resume) {
      return NextResponse.json({ error: "No resume found" }, { status: 404 });
    }

    return NextResponse.json({ resume });

  } catch (error) {
    console.error("Current resume GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}