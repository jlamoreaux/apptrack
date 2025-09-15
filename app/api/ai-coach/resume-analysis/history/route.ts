import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();

    const { data: analyses, error } = await supabase
      .from("resume_analysis")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching resume analyses:", error);
      return NextResponse.json({ error: "Failed to fetch resume analyses" }, { status: 500 });
    }

    return NextResponse.json({ analyses: analyses || [] });

  } catch (error) {
    console.error("Resume analysis history GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { resumeUrl, analysisResult } = await request.json();

    if (!resumeUrl || !analysisResult) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const { data: analysis, error } = await supabase
      .from("resume_analysis")
      .insert({
        user_id: user.id,
        resume_url: resumeUrl,
        analysis_result: analysisResult,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating resume analysis:", error);
      return NextResponse.json({ error: "Failed to create resume analysis" }, { status: 500 });
    }

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error("Resume analysis history POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}