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

    const { data: analyses, error } = await supabase
      .from("job_fit_analysis")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching job fit analyses:", error);
      return NextResponse.json({ error: "Failed to fetch job fit analyses" }, { status: 500 });
    }

    return NextResponse.json({ analyses: analyses || [] });

  } catch (error) {
    console.error("Job fit analysis history GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobDescription, analysisResult, fitScore } = await request.json();

    if (!jobDescription || !analysisResult || typeof fitScore !== 'number') {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: analysis, error } = await supabase
      .from("job_fit_analysis")
      .insert({
        user_id: user.id,
        job_description: jobDescription,
        analysis_result: analysisResult,
        fit_score: fitScore,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating job fit analysis:", error);
      return NextResponse.json({ error: "Failed to create job fit analysis" }, { status: 500 });
    }

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error("Job fit analysis history POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}