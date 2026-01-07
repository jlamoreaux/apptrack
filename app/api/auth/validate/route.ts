import { NextResponse } from "next/server";
import { verifyExtensionToken } from "@/lib/auth/extension-auth";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

/**
 * GET /api/auth/validate
 *
 * Validate an extension Bearer token and return user info.
 * Used by the browser extension to verify tokens are still valid.
 *
 * Request:
 * - Authorization: Bearer <token>
 *
 * Response:
 * - 200: { userId, email }
 * - 401: Invalid or expired token
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 401 }
      );
    }

    // Verify the token
    const verified = await verifyExtensionToken(token);

    if (!verified) {
      loggerService.debug("Token validation failed", {
        category: LogCategory.AUTH,
        action: "extension_token_validation_failed",
        duration: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    loggerService.debug("Token validated successfully", {
      category: LogCategory.AUTH,
      action: "extension_token_validated",
      userId: verified.userId,
      duration: Date.now() - startTime,
    });

    return NextResponse.json({
      userId: verified.userId,
      email: verified.email,
    });
  } catch (error) {
    loggerService.error("Token validation error", error, {
      category: LogCategory.AUTH,
      action: "extension_token_validation_error",
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: "Token validation failed" },
      { status: 500 }
    );
  }
}
