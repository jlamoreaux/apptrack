import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
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
      console.error("Failed to decrypt session content:", decryptError);
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
      console.error("Failed to update session:", updateError);
      // Don't fail the request - user still gets their content
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
