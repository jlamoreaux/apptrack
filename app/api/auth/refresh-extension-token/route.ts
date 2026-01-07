import { NextRequest, NextResponse } from "next/server";
import {
  verifyExtensionToken,
  signExtensionToken,
  isInRefreshWindow,
} from "@/lib/auth/extension-auth";
import { createRateLimiter } from "@/lib/redis/client";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

// Rate limiter: 20 token refreshes per minute per user
const rateLimiter = createRateLimiter(20, "1 m");

/**
 * Extract token from Authorization header or request body
 */
async function extractToken(request: NextRequest): Promise<string | null> {
  // Try Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Fall back to request body
  try {
    const body = await request.json();
    return body.token || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/refresh-extension-token
 *
 * Refresh an extension token before it expires.
 * Accepts token via Authorization header (preferred) or request body.
 *
 * Request:
 * - Header: Authorization: Bearer <token>
 * - OR Body: { token: string }
 *
 * Response:
 * - 200: { token, expiresAt } (new token if in refresh window)
 * - 200: { token, expiresAt, message: "Token not yet eligible for refresh" } (same token info if not in window)
 * - 401: Token invalid, expired, or revoked
 * - 500: Refresh failed
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const token = await extractToken(request);

    if (!token) {
      loggerService.warn("Extension token refresh without token", {
        category: LogCategory.AUTH,
        action: "extension_token_refresh_no_token",
      });
      return NextResponse.json(
        { error: "Token is required" },
        { status: 401 }
      );
    }

    // Verify the current token
    const verified = await verifyExtensionToken(token);

    if (!verified) {
      loggerService.warn("Extension token refresh with invalid token", {
        category: LogCategory.AUTH,
        action: "extension_token_refresh_invalid",
      });
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check rate limit
    if (rateLimiter) {
      const result = await rateLimiter.limit(verified.userId);
      if (!result.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }

    // Calculate days until expiry for logging
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (verified.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if token is in refresh window
    if (!isInRefreshWindow(verified.expiresAt)) {
      loggerService.debug("Extension token not in refresh window", {
        category: LogCategory.AUTH,
        action: "extension_token_refresh_not_eligible",
        userId: verified.userId,
        duration: Date.now() - startTime,
        metadata: {
          daysUntilExpiry,
          expiresAt: verified.expiresAt.toISOString(),
        },
      });

      // Return current token info without issuing new token
      return NextResponse.json({
        token,
        expiresAt: verified.expiresAt.toISOString(),
        message: "Token not yet eligible for refresh",
      });
    }

    // Generate new token
    const result = await signExtensionToken(verified.userId, verified.email);

    loggerService.info("Extension token refreshed", {
      category: LogCategory.AUTH,
      action: "extension_token_refreshed",
      userId: verified.userId,
      duration: Date.now() - startTime,
      metadata: {
        oldExpiresAt: verified.expiresAt.toISOString(),
        newExpiresAt: result.expiresAt,
        daysUntilOldExpiry: daysUntilExpiry,
      },
    });

    return NextResponse.json({
      token: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    loggerService.error("Failed to refresh extension token", error, {
      category: LogCategory.AUTH,
      action: "extension_token_refresh_error",
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}
