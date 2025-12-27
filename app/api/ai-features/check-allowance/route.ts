import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIFeatureUsageService, type AIFeatureType } from "@/lib/services/ai-feature-usage.service";

/**
 * GET /api/ai-features/check-allowance?feature=job_fit
 * Check if authenticated user can use an AI feature
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get feature type from query params
    const searchParams = request.nextUrl.searchParams;
    const featureType = searchParams.get("feature") as AIFeatureType;

    if (!featureType) {
      return NextResponse.json(
        { error: "Feature type is required" },
        { status: 400 }
      );
    }

    // Validate feature type
    const validFeatures = ["resume_analysis", "job_fit", "cover_letter", "interview_prep"];
    if (!validFeatures.includes(featureType)) {
      return NextResponse.json(
        { error: "Invalid feature type" },
        { status: 400 }
      );
    }

    // Check allowance
    const allowance = await AIFeatureUsageService.checkAllowance(user.id, featureType);

    return NextResponse.json(allowance);
  } catch (error) {
    console.error("Check allowance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
