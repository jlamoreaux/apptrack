/**
 * Browser fingerprinting utility for rate limiting anonymous users
 * Uses FingerprintJS Pro for reliable browser identification
 *
 * Note: FingerprintJS Pro requires API key in NEXT_PUBLIC_FINGERPRINT_API_KEY
 * For development, falls back to simple fingerprint based on user agent
 */

// Type for fingerprint result
export interface FingerprintResult {
  visitorId: string;
  confidence: number;
  timestamp: number;
}

/**
 * Generate a browser fingerprint
 * Uses FingerprintJS Pro if API key is available, otherwise generates simple fallback
 */
export async function getFingerprint(): Promise<string> {
  // Check if we're in browser environment
  if (typeof window === "undefined") {
    return "server-side-render";
  }

  // Check if FingerprintJS API key is configured
  const apiKey = process.env.NEXT_PUBLIC_FINGERPRINT_API_KEY;

  if (apiKey) {
    // Use FingerprintJS Pro (full implementation)
    try {
      const FingerprintJS = (await import("@fingerprintjs/fingerprintjs-pro")).default;

      const fp = await FingerprintJS.load({
        apiKey,
        endpoint: "https://fp.apptrack.ing", // Custom endpoint if needed
      });

      const result = await fp.get();
      return result.visitorId;
    } catch (error) {
      console.error("FingerprintJS error, falling back to simple fingerprint:", error);
      return getSimpleFingerprint();
    }
  } else {
    // Development fallback - simple fingerprint
    return getSimpleFingerprint();
  }
}

/**
 * Simple fingerprint for development/fallback
 * Combines user agent, screen resolution, timezone, and language
 */
function getSimpleFingerprint(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const components = [
    navigator.userAgent,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.language,
    navigator.platform,
  ];

  const fingerprint = components.join("|");

  // Simple hash function
  return simpleHash(fingerprint);
}

/**
 * Simple hash function for fingerprint
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get client IP address from request headers
 * For use in API routes
 */
export function getClientIP(request: Request): string {
  // Try various headers where IP might be stored
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip"); // Cloudflare

  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, first one is the client
    return forwardedFor.split(",")[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback
  return "unknown";
}
