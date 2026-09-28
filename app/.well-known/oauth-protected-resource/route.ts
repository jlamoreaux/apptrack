import {
  metadataPreflightResponse,
  protectedResourceMetadataResponse,
} from "@/lib/auth/oauth/metadata";

/**
 * Protected resource metadata (RFC 9728) for /api/mcp. Served at
 * /.well-known/oauth-protected-resource/api/mcp and at the root
 * /.well-known/oauth-protected-resource fallback, with the same body.
 * 404 unless isMcpOAuthEnabled().
 */

// Read the OAuth flag and the request origin at request time.
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return protectedResourceMetadataResponse(request);
}

export function OPTIONS(): Response {
  return metadataPreflightResponse();
}
