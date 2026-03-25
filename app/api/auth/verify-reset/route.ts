import { NextRequest, NextResponse } from "next/server";
import { createCallbackClient } from "@/lib/supabase/server-client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

/**
 * Handles password reset link clicks.
 * Verifies the OTP token server-side and redirects to /reset-password
 * with a valid session established via cookies.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.apptrack.ing";

  if (!tokenHash) {
    return NextResponse.redirect(
      new URL("/auth/error?message=Missing reset token", requestUrl.origin)
    );
  }

  try {
    const { supabase, cookiesToSet } = createCallbackClient(request);

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });

    if (error) {
      loggerService.error("Error verifying reset token", error, {
        category: LogCategory.AUTH,
        action: "verify_reset_error",
        metadata: { errorMessage: error.message },
      });
      return NextResponse.redirect(
        new URL("/auth/error?message=Invalid or expired reset link", requestUrl.origin)
      );
    }

    const response = NextResponse.redirect(new URL("/reset-password", appUrl));
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  } catch (error) {
    loggerService.error("Error in verify-reset", error, {
      category: LogCategory.API,
      action: "verify_reset_exception",
    });
    return NextResponse.redirect(
      new URL("/auth/error?message=Could not verify reset link", requestUrl.origin)
    );
  }
}
