/**
 * Protected resource metadata (RFC 9728) for /api/mcp, the same handlers as
 * the root /.well-known/oauth-protected-resource fallback.
 * 404 unless isMcpOAuthEnabled().
 */

export { GET, OPTIONS } from "@/app/.well-known/oauth-protected-resource/route";

// Next.js reads segment config only as a literal in the route file itself.
// Read the OAuth flag and the request origin at request time.
export const dynamic = "force-dynamic";
