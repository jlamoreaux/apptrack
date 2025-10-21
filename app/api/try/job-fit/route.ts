import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateJobFitAnalysis,
  createPreviewAnalysis,
  type JobFitInput,
} from "@/lib/ai/job-fit-generator";
import { getClientIP } from "@/lib/utils/fingerprint";
import { encryptContent } from "@/lib/utils/encryption";

/**
 * POST /api/try/job-fit
 * Generate job fit analysis for anonymous users (pre-registration)
 *
 * Rate limited to 1 use per 24 hours per fingerprint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobDescription, userBackground, targetRole, fingerprint } = body;

    // Validate required fields
    if (!jobDescription || !userBackground || !fingerprint) {
      return NextResponse.json(
        { error: "Missing required fields: jobDescription, userBackground, fingerprint" },
        { status: 400 }
      );
    }

    // Validate input lengths
    if (jobDescription.length < 100) {
      return NextResponse.json(
        { error: "Job description must be at least 100 characters" },
        { status: 400 }
      );
    }

    if (userBackground.length < 50) {
      return NextResponse.json(
        { error: "User background must be at least 50 characters" },
        { status: 400 }
      );
    }

    const ipAddress = getClientIP(request);
    const supabase = await createClient();

    // Check rate limit - 1 use per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: existingUsage, error: usageError } = await supabase
      .from("ai_preview_usage")
      .select("*")
      .eq("fingerprint", fingerprint)
      .eq("feature_type", "job_fit")
      .gte("used_at", twentyFourHoursAgo);

    if (usageError) {
      console.error("Error checking usage:", usageError);
      return NextResponse.json(
        { error: "Failed to check usage limits" },
        { status: 500 }
      );
    }

    if (existingUsage && existingUsage.length > 0) {
      const firstUse = new Date(existingUsage[0].used_at);
      const resetTime = new Date(firstUse.getTime() + 24 * 60 * 60 * 1000);

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "You've already used your free job fit analysis. Sign up to get 1 more free try!",
          resetAt: resetTime.toISOString(),
        },
        { status: 429 }
      );
    }

    // Generate AI analysis
    const input: JobFitInput = {
      jobDescription,
      userBackground,
      targetRole: targetRole || undefined,
    };

    let fullAnalysis;
    try {
      fullAnalysis = await generateJobFitAnalysis(input);
    } catch (aiError) {
      console.error("AI generation error:", aiError);
      return NextResponse.json(
        { error: "Failed to generate job fit analysis. Please try again." },
        { status: 500 }
      );
    }

    // Create preview version (partial content for anonymous users)
    const previewContent = createPreviewAnalysis(fullAnalysis);

    // Encrypt full content
    const encryptedContent = encryptContent(JSON.stringify(fullAnalysis));

    // Store session in database
    const { data: session, error: sessionError } = await supabase
      .from("ai_preview_sessions")
      .insert({
        session_fingerprint: fingerprint,
        feature_type: "job_fit",
        input_data: input,
        preview_content: previewContent,
        full_content_encrypted: encryptedContent,
        ip_address: ipAddress,
        user_agent: request.headers.get("user-agent"),
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Error storing session:", sessionError);
      return NextResponse.json(
        { error: "Failed to store analysis" },
        { status: 500 }
      );
    }

    // Track usage
    const { error: trackError } = await supabase
      .from("ai_preview_usage")
      .insert({
        fingerprint,
        ip_address: ipAddress,
        feature_type: "job_fit",
      });

    if (trackError) {
      console.error("Error tracking usage:", trackError);
      // Don't fail the request if tracking fails
    }

    // Return session ID and preview content
    return NextResponse.json({
      sessionId: session.id,
      preview: previewContent,
      message: "Analysis generated successfully. Sign up to see full results!",
    });
  } catch (error) {
    console.error("Job fit API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
