import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { sendPasswordResetEmail } from "@/lib/email/transactional";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.apptrack.ing";

  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error) {
      loggerService.error("Error generating password reset link", error, {
        category: LogCategory.AUTH,
        action: "forgot_password_error",
        duration: Date.now() - startTime,
        metadata: {
          emailDomain: email.split("@")[1] || "unknown",
          errorMessage: error.message,
        },
      });

      // Return success even on error to prevent email enumeration
      return NextResponse.json({ success: true });
    }

    const token = data.properties?.hashed_token;

    if (token) {
      // Link to our own verify-reset endpoint which verifies the token
      // server-side, sets session cookies, and redirects to /reset-password.
      const resetUrl = `${appUrl}/api/auth/verify-reset?token=${token}`;
      await sendPasswordResetEmail({ email, resetUrl });
    }

    loggerService.info("Password reset email sent", {
      category: LogCategory.AUTH,
      action: "forgot_password_sent",
      duration: Date.now() - startTime,
      metadata: { emailDomain: email.split("@")[1] || "unknown" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error("Error in forgot-password", error, {
      category: LogCategory.API,
      action: "forgot_password_exception",
      duration: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
