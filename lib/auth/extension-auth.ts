import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createClient } from "@/lib/supabase/server-client";
import { getUser } from "@/lib/supabase/queries";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

// Extension token expiry in days (default 7)
const TOKEN_EXPIRY_DAYS = parseInt(
  process.env.EXTENSION_TOKEN_EXPIRY_DAYS || "7",
  10
);

// Refresh window: allow refresh when token expires within this many days
const REFRESH_WINDOW_DAYS = 3;

interface ExtensionTokenPayload extends JWTPayload {
  sub: string; // user ID
  email: string;
  type: "extension";
  v: number; // token version for revocation
}

interface ExtensionTokenResult {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface VerifiedToken {
  userId: string;
  email: string;
  tokenVersion: number;
  expiresAt: Date;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  source: "session" | "extension";
}

/**
 * Get the JWT secret for extension tokens
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.EXTENSION_JWT_SECRET;
  if (!secret) {
    throw new Error("EXTENSION_JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Get user's extension token version from profiles table
 * Returns 1 if not set (default)
 */
async function getTokenVersion(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("extension_token_version")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return 1; // Default version
    }

    return data.extension_token_version ?? 1;
  } catch {
    return 1;
  }
}

/**
 * Get user profile (name) from profiles table
 */
async function getUserProfile(
  userId: string
): Promise<{ full_name: string | null } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    if (error) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Sign and create a new extension token for a user
 */
export async function signExtensionToken(
  userId: string,
  email: string
): Promise<ExtensionTokenResult> {
  const tokenVersion = await getTokenVersion(userId);
  const profile = await getUserProfile(userId);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  const token = await new SignJWT({
    email,
    type: "extension",
    v: tokenVersion,
  } as ExtensionTokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getJwtSecret());

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: userId,
      email,
      name: profile?.full_name ?? null,
    },
  };
}

/**
 * Verify an extension token and return the payload
 * Returns null if token is invalid, expired, or revoked
 */
export async function verifyExtensionToken(
  token: string
): Promise<VerifiedToken | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    // Validate token type
    if (payload.type !== "extension") {
      loggerService.warn("Invalid extension token type", {
        category: LogCategory.SECURITY,
        action: "extension_token_invalid_type",
      });
      return null;
    }

    const userId = payload.sub;
    const email = payload.email;
    const tokenVersion = payload.v;

    // Validate required claims with proper type checking
    if (
      !userId ||
      typeof email !== "string" ||
      typeof tokenVersion !== "number"
    ) {
      loggerService.warn("Extension token missing required claims", {
        category: LogCategory.SECURITY,
        action: "extension_token_missing_claims",
        metadata: {
          hasUserId: !!userId,
          hasEmail: typeof email === "string",
          hasVersion: typeof tokenVersion === "number",
        },
      });
      return null;
    }

    // Verify token version matches current version in database
    const currentVersion = await getTokenVersion(userId);
    if (tokenVersion !== currentVersion) {
      loggerService.info("Extension token revoked (version mismatch)", {
        category: LogCategory.SECURITY,
        action: "extension_token_revoked",
        userId,
        metadata: {
          tokenVersion,
          currentVersion,
        },
      });
      return null;
    }

    // Validate exp claim - jose should have already validated this but double-check
    const exp = payload.exp;
    if (typeof exp !== "number") {
      loggerService.warn("Extension token missing exp claim", {
        category: LogCategory.SECURITY,
        action: "extension_token_missing_exp",
      });
      return null;
    }

    return {
      userId,
      email,
      tokenVersion,
      expiresAt: new Date(exp * 1000),
    };
  } catch (error) {
    // Token is invalid or expired
    loggerService.debug("Extension token verification failed", {
      category: LogCategory.SECURITY,
      action: "extension_token_verification_failed",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return null;
  }
}

/**
 * Check if a token is within the refresh window
 * Returns true if the token expires within REFRESH_WINDOW_DAYS
 */
export function isInRefreshWindow(expiresAt: Date): boolean {
  const now = new Date();
  const refreshThreshold = new Date();
  refreshThreshold.setDate(refreshThreshold.getDate() + REFRESH_WINDOW_DAYS);

  return expiresAt <= refreshThreshold && expiresAt > now;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Get authenticated user from either session cookie or extension Bearer token
 * Checks session first, then falls back to Bearer token
 */
export async function getAuthenticatedUser(
  request: Request
): Promise<AuthenticatedUser | null> {
  // First, try session-based auth (existing Supabase session)
  const sessionUser = await getUser();
  if (sessionUser) {
    return {
      id: sessionUser.id,
      email: sessionUser.email ?? "",
      source: "session",
    };
  }

  // Fall back to Bearer token auth for extension
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }

  const verified = await verifyExtensionToken(token);
  if (!verified) {
    return null;
  }

  return {
    id: verified.userId,
    email: verified.email,
    source: "extension",
  };
}

/**
 * Increment user's extension token version to revoke all existing tokens
 * Call this on logout, password change, or "sign out all devices"
 */
export async function revokeExtensionTokens(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Get current version
    const currentVersion = await getTokenVersion(userId);

    // Increment version
    const { error } = await supabase
      .from("profiles")
      .update({ extension_token_version: currentVersion + 1 })
      .eq("id", userId);

    if (error) {
      loggerService.error("Failed to revoke extension tokens", error, {
        category: LogCategory.SECURITY,
        action: "extension_token_revocation_failed",
        userId,
      });
      return false;
    }

    loggerService.info("Extension tokens revoked", {
      category: LogCategory.SECURITY,
      action: "extension_tokens_revoked",
      userId,
      metadata: {
        newVersion: currentVersion + 1,
      },
    });

    return true;
  } catch (error) {
    loggerService.error("Error revoking extension tokens", error, {
      category: LogCategory.SECURITY,
      action: "extension_token_revocation_error",
      userId,
    });
    return false;
  }
}
