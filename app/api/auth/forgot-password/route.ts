import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    loggerService.error("NEXT_PUBLIC_APP_URL is not configured", null, {
      category: LogCategory.API,
      action: "forgot_password_missing_env",
    });
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
    });

    if (error) {
      loggerService.error("Error sending password reset email", error, {
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
