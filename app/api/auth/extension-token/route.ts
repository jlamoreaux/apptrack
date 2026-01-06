import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { signExtensionToken } from "@/lib/auth/extension-auth";
import { checkAuthRateLimit } from "@/lib/auth/auth-rate-limit";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

/**
 * POST /api/auth/extension-token
 *
 * Generate a JWT token for the browser extension.
 * Requires an existing session (user must be logged in via web app).
 *
 * Response:
 * - 200: { token, expiresAt, user: { id, email, name } }
 * - 401: Not authenticated
 * - 500: Token generation failed
 */
export async function POST() {
  const startTime = Date.now();

  try {
    // Verify user is authenticated via session
    const user = await getUser();

    if (!user) {
      loggerService.warn("Extension token requested without session", {
        category: LogCategory.AUTH,
        action: "extension_token_no_session",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check rate limit (use user ID as identifier)
    const rateLimitResult = await checkAuthRateLimit(user.id, "extension_token");
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response!;
    }

    if (!user.email) {
      loggerService.warn("Extension token requested for user without email", {
        category: LogCategory.AUTH,
        action: "extension_token_no_email",
        userId: user.id,
      });
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    // Generate extension token
    const result = await signExtensionToken(user.id, user.email);

    loggerService.info("Extension token generated", {
      category: LogCategory.AUTH,
      action: "extension_token_generated",
      userId: user.id,
      duration: Date.now() - startTime,
      metadata: {
        expiresAt: result.expiresAt,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    loggerService.error("Failed to generate extension token", error, {
      category: LogCategory.AUTH,
      action: "extension_token_error",
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: "Failed to generate extension token" },
      { status: 500 }
    );
  }
}
