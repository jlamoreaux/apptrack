import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { decryptContent } from "@/lib/utils/encryption";
import { loggerService, LogCategory } from "@/lib/services/logger.service";

/**
 * POST /api/try/unlock-with-email
 * Unlock full results for a session after email was captured
 * No auth required — just needs valid sessionId + email that was captured
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, email } = await request.json();

    if (!sessionId || !email) {
      return NextResponse.json(
        { error: "Session ID and email are required" },
        { status: 400 }
      );
    }

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

    // Verify the session hasn't expired
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Session has expired" },
        { status: 410 }
      );
    }

    // Verify the email is in audience_members (proves they provided their email)
    const { data: audienceMember, error: audienceError } = await serviceClient
      .from("audience_members")
      .select("id")
      .eq("email", email)
      .single();

    if (audienceError || !audienceMember) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 403 }
      );
    }

    // Decrypt full content
    let fullContent;
    try {
      const decryptedString = decryptContent(session.full_content_encrypted);
      fullContent = JSON.parse(decryptedString);
    } catch (decryptError) {
      loggerService.error("Failed to decrypt session content", decryptError, { category: LogCategory.SECURITY, sessionId });
      return NextResponse.json(
        { error: "Failed to decrypt session content" },
        { status: 500 }
      );
    }

    // Do NOT mark as converted — that's for authenticated users only

    return NextResponse.json({
      success: true,
      analysis: fullContent,
      featureType: session.feature_type,
    });
  } catch (error) {
    loggerService.error("Unlock with email error", error, { category: LogCategory.API });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
