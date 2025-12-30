import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService, LogCategory } from "@/lib/services/logger.service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch job fit analyses for this user, ordered by most recent first
    const { data: analyses, error } = await supabase
      .from("job_fit_analysis")
      .select(`
        *,
        applications:application_id (
          id,
          company,
          role
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50); // Limit to last 50 analyses

    if (error) {
      loggerService.error("Error fetching job fit analyses", LogCategory.DATABASE, {
        error,
        userId: user.id
      });
      return NextResponse.json(
        { error: "Failed to fetch analyses" },
        { status: 500 }
      );
    }

    // Parse analysis_result from JSON string to object
    const parsedAnalyses = (analyses || []).map(analysis => {
      let parsedResult = analysis.analysis_result;

      if (typeof analysis.analysis_result === 'string') {
        try {
          parsedResult = JSON.parse(analysis.analysis_result);
        } catch (error) {
          loggerService.error('Failed to parse job fit analysis result', LogCategory.DATABASE, {
            error,
            analysisId: analysis.id
          });
          parsedResult = { error: 'Failed to parse analysis result', raw: analysis.analysis_result };
        }
      }

      return {
        ...analysis,
        analysis_result: parsedResult
      };
    });

    return NextResponse.json({ analyses: parsedAnalyses });
  } catch (error) {
    loggerService.error("Job fit history error", LogCategory.API, { error });
    return NextResponse.json(
      { error: "Failed to fetch analyses" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Analysis ID is required" },
        { status: 400 }
      );
    }

    // Delete the analysis, ensuring it belongs to the user
    const { error } = await supabase
      .from("job_fit_analysis")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      loggerService.error("Error deleting job fit analysis", LogCategory.DATABASE, {
        error,
        analysisId: id,
        userId: user.id
      });
      return NextResponse.json(
        { error: "Failed to delete analysis" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error("Job fit delete error", LogCategory.API, { error });
    return NextResponse.json(
      { error: "Failed to delete analysis" },
      { status: 500 }
    );
  }
}
