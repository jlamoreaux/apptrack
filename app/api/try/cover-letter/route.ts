import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { generateCoverLetter } from "@/lib/ai-coach/functions";
import { getClientIP } from "@/lib/utils/fingerprint";
import { encryptContent } from "@/lib/utils/encryption";
import { loggerService, LogCategory } from "@/lib/services/logger.service";

/**
 * POST /api/try/cover-letter
 * Generate cover letter for anonymous users (pre-registration)
 *
 * Rate limited to 1 use per 24 hours per fingerprint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobDescription, userBackground, companyName, roleName, fingerprint } = body;

    // Validate required fields
    if (!jobDescription || !userBackground || !companyName || !fingerprint) {
      return NextResponse.json(
        { error: "Missing required fields: jobDescription, userBackground, companyName, fingerprint" },
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
    const supabase = createServiceRoleClient();

    // Check rate limit - 1 use per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: existingUsage, error: usageError } = await supabase
      .from("ai_preview_usage")
      .select("*")
      .eq("fingerprint", fingerprint)
      .eq("feature_type", "cover_letter")
      .gte("used_at", twentyFourHoursAgo);

    if (usageError) {
      loggerService.error("Error checking usage", LogCategory.DATABASE, { error: usageError, fingerprint });
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
          message: "You've already used your free cover letter generator. Sign up to get 1 more free try!",
          resetAt: resetTime.toISOString(),
        },
        { status: 429 }
      );
    }

    // Generate AI cover letter using existing infrastructure
    let fullCoverLetter: string;
    try {
      fullCoverLetter = await generateCoverLetter(
        jobDescription,
        userBackground,
        companyName,
        userBackground // Using userBackground as resumeText parameter
      );
    } catch (aiError) {
      loggerService.error("AI generation error", LogCategory.API, { error: aiError, fingerprint });
      return NextResponse.json(
        { error: "Failed to generate cover letter. Please try again." },
        { status: 500 }
      );
    }

    // Create preview version (first ~300 characters)
    const previewLength = 300;
    const previewContent = {
      text: fullCoverLetter.length > previewLength
        ? fullCoverLetter.substring(0, previewLength) + "..."
        : fullCoverLetter,
      isPreview: fullCoverLetter.length > previewLength,
    };

    // Encrypt full content
    const encryptedContent = encryptContent(fullCoverLetter);

    // Store session in database
    const { data: session, error: sessionError } = await supabase
      .from("ai_preview_sessions")
      .insert({
        session_fingerprint: fingerprint,
        feature_type: "cover_letter",
        input_data: {
          jobDescription,
          userBackground,
          companyName,
          roleName: roleName || null,
        },
        preview_content: previewContent,
        full_content_encrypted: encryptedContent,
        ip_address: ipAddress,
        user_agent: request.headers.get("user-agent"),
      })
      .select()
      .single();

    if (sessionError) {
      loggerService.error("Error storing session", LogCategory.DATABASE, { error: sessionError, fingerprint });
      return NextResponse.json(
        { error: "Failed to store cover letter" },
        { status: 500 }
      );
    }

    // Track usage
    const { error: trackError } = await supabase
      .from("ai_preview_usage")
      .insert({
        fingerprint,
        ip_address: ipAddress,
        feature_type: "cover_letter",
      });

    if (trackError) {
      loggerService.error("Error tracking usage", LogCategory.DATABASE, { error: trackError, fingerprint });
      // Don't fail the request if tracking fails
    }

    // Return session ID and preview content
    return NextResponse.json({
      sessionId: session.id,
      preview: previewContent,
      message: "Cover letter generated successfully. Sign up to see the full version!",
    });
  } catch (error) {
    loggerService.error("Cover letter API error", LogCategory.API, { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
