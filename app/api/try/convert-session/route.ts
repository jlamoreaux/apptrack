import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptContent } from "@/lib/utils/encryption";

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

    // Load the session
    const { data: session, error: sessionError } = await supabase
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
      console.error("Failed to decrypt session content:", decryptError);
      return NextResponse.json(
        { error: "Failed to decrypt session content" },
        { status: 500 }
      );
    }

    // Update session to mark as converted
    const { error: updateError } = await supabase
      .from("ai_preview_sessions")
      .update({
        user_id: user.id,
        converted_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Failed to update session:", updateError);
      // Don't fail the request - user still gets their content
    }

    // Track conversion in PostHog
    if (typeof window !== "undefined" && window.posthog) {
      window.posthog.capture("preview_session_converted", {
        feature_type: session.feature_type,
        session_id: sessionId,
        user_id: user.id,
      });
    }

    // Return full content and input data
    return NextResponse.json({
      success: true,
      analysis: fullContent,
      featureType: session.feature_type,
      inputData: session.input_data,
    });
  } catch (error) {
    console.error("Convert session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
