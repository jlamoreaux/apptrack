import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { decryptContent } from "@/lib/utils/encryption";
import { loggerService, LogCategory } from "@/lib/services/logger.service";

/**
 * POST /api/try/convert-session
 * Transfer a preview session to an authenticated user's account
 * Called after user signs up to unlock full AI analysis
 */
export async function POST(request: NextRequest) {
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

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Use service role client for database operations (RLS requires service_role)
    const serviceClient = createServiceRoleClient();

    // Load the session
    const { data: session, error: sessionError } = await serviceClient
      .from("ai_preview_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check if already converted
    if (session.converted_at) {
      return NextResponse.json(
        { error: "Session already converted" },
        { status: 400 }
      );
    }

    // Decrypt full content
    let fullContent;
    try {
      const decryptedString = decryptContent(session.full_content_encrypted);
      fullContent = JSON.parse(decryptedString);
    } catch (decryptError) {
      loggerService.error("Failed to decrypt session content", LogCategory.SECURITY, { error: decryptError, sessionId });
      return NextResponse.json(
        { error: "Failed to decrypt session content" },
        { status: 500 }
      );
    }

    // Update session to mark as converted
    const { error: updateError } = await serviceClient
      .from("ai_preview_sessions")
      .update({
        user_id: user.id,
        converted_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      loggerService.error("Failed to update session", LogCategory.DATABASE, { error: updateError, sessionId });
      // Don't fail the request - user still gets their content
    }

    // Save to AI coach history so user can access in /ai-coach
    try {
      if (session.feature_type === 'job_fit') {
        // Extract fit score from analysis
        const fitScore = typeof fullContent === 'object' ?
          (fullContent.fitScore || fullContent.overallScore || 0) : 0;

        await serviceClient.from('job_fit_analysis').insert({
          user_id: user.id,
          application_id: null,
          job_description: session.input_data?.jobDescription || '',
          analysis_result: JSON.stringify(fullContent),
          fit_score: fitScore,
        });
      } else if (session.feature_type === 'cover_letter') {
        // fullContent is the cover letter text
        const coverLetterText = typeof fullContent === 'string' ?
          fullContent : (fullContent.text || JSON.stringify(fullContent));

        await serviceClient.from('cover_letters').insert({
          user_id: user.id,
          application_id: null,
          job_description: session.input_data?.jobDescription || '',
          company_name: session.input_data?.companyName || null,
          role_name: session.input_data?.roleName || null,
          cover_letter: coverLetterText,
        });
      } else if (session.feature_type === 'interview_prep') {
        await serviceClient.from('interview_prep').insert({
          user_id: user.id,
          job_description: session.input_data?.jobDescription || null,
          resume_text: session.input_data?.userBackground || null,
          prep_content: fullContent,
        });
      }
    } catch (historyError) {
      loggerService.error("Failed to save to AI coach history", LogCategory.DATABASE, { error: historyError, sessionId, userId: user.id });
      // Log but don't fail the request - conversion still succeeded
    }

    // Return full content and input data
    return NextResponse.json({
      success: true,
      analysis: fullContent,
      featureType: session.feature_type,
      inputData: session.input_data,
    });
  } catch (error) {
    loggerService.error("Convert session error", LogCategory.API, { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
