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

    // Get recent AI feature activity from all AI feature tables
    const activities = [];

    try {
      // Get recent resume analyses
      const { data: resumeAnalyses } = await supabase
        .from("resume_analysis")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (resumeAnalyses) {
        activities.push(...resumeAnalyses.map(item => ({
          id: item.id,
          feature_name: "resume_analysis",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Get recent interview prep
      const { data: interviewPreps } = await supabase
        .from("interview_prep")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (interviewPreps) {
        activities.push(...interviewPreps.map(item => ({
          id: item.id,
          feature_name: "interview_prep",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Get recent career advice
      const { data: careerAdvice } = await supabase
        .from("career_advice")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (careerAdvice) {
        activities.push(...careerAdvice.map(item => ({
          id: item.id,
          feature_name: "career_advice",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Get recent cover letters
      const { data: coverLetters } = await supabase
        .from("cover_letters")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (coverLetters) {
        activities.push(...coverLetters.map(item => ({
          id: item.id,
          feature_name: "cover_letter",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Get recent job fit analyses
      const { data: jobFitAnalyses } = await supabase
        .from("job_fit_analysis")
        .select("id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (jobFitAnalyses) {
        activities.push(...jobFitAnalyses.map(item => ({
          id: item.id,
          feature_name: "job_fit_analysis",
          created_at: item.created_at,
          success: true,
          metadata: {}
        })));
      }

      // Sort all activities by creation date and limit
      const sortedActivities = activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, Math.min(limit, 50));

      return NextResponse.json({ activities: sortedActivities });

    } catch (error) {
      console.error("Error fetching recent activity:", error);
      return NextResponse.json({ error: "Failed to fetch recent activity" }, { status: 500 });
    }

  } catch (error) {
    console.error("Recent activity GET error:", error);
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}